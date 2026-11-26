-- Backend production shield (vibecoder-backend Mbak Sari playbook):
-- 1. Persistent idempotency state machine for checkout-create and sensitive mutations (in_progress/completed + request_hash + lease takeover).
-- 2. Deterministic lock ordering (ORDER BY x ASC) + row lock on recompute_balance to prevent deadlocks & lost balance updates.
-- 3. Bounded lock_timeout (3000 ms) across financial & balance-mutating SQL entrypoints.

-- ---------------------------------------------------------------- 1. idempotency_keys + RPCs
create table if not exists public.idempotency_keys (
  user_id uuid not null references auth.users (id) on delete cascade,
  scope text not null check (char_length(scope) between 1 and 64),
  key text not null check (char_length(key) between 8 and 128),
  request_hash text not null check (char_length(request_hash) between 16 and 128),
  status text not null check (status in ('in_progress', 'completed')),
  lease_id uuid not null default gen_random_uuid(),
  status_code integer check (status_code is null or status_code between 100 and 599),
  response_body jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, scope, key)
);
create index if not exists idempotency_keys_updated_idx on public.idempotency_keys (updated_at);
create index if not exists edge_rate_limits_updated_idx on public.edge_rate_limits (updated_at);
create index if not exists webhook_events_received_idx on public.webhook_events (received_at);
alter table public.idempotency_keys enable row level security;
revoke all on public.idempotency_keys from anon, authenticated;

create or replace function public.idempotency_begin(
  p_user uuid,
  p_scope text,
  p_key text,
  p_hash text,
  p_lease_sec integer default 60
) returns table (state text, status_code integer, response_body jsonb, lease_id uuid)
language plpgsql security definer set search_path = '' as $$
declare
  v_row public.idempotency_keys;
  v_lease integer := greatest(coalesce(p_lease_sec, 60), 5);
  v_lease_id uuid;
begin
  perform set_config('lock_timeout', '3000', true);
  if p_user is null or char_length(coalesce(p_scope, '')) not between 1 and 64
     or char_length(coalesce(p_key, '')) not between 8 and 128
     or char_length(coalesce(p_hash, '')) not between 16 and 128 then
    raise exception 'invalid_idempotency_input' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('idem:' || p_user::text || ':' || p_scope || ':' || p_key));

  select * into v_row
  from public.idempotency_keys
  where user_id = p_user and scope = p_scope and key = p_key
  for update;

  if not found then
    insert into public.idempotency_keys (user_id, scope, key, request_hash, status)
    values (p_user, p_scope, p_key, p_hash, 'in_progress')
    returning public.idempotency_keys.lease_id into v_lease_id;
    return query select 'acquired'::text, null::integer, null::jsonb, v_lease_id;
    return;
  end if;

  if v_row.request_hash <> p_hash then
    return query select 'payload_mismatch'::text, null::integer, null::jsonb, null::uuid;
    return;
  end if;

  if v_row.status = 'completed' then
    return query select 'completed'::text, v_row.status_code, v_row.response_body, null::uuid;
    return;
  end if;

  if v_row.updated_at < now() - make_interval(secs => v_lease) then
    update public.idempotency_keys
    set lease_id = gen_random_uuid(),
        updated_at = now()
    where user_id = p_user and scope = p_scope and key = p_key
    returning public.idempotency_keys.lease_id into v_lease_id;
    return query select 'acquired'::text, null::integer, null::jsonb, v_lease_id;
    return;
  end if;

  return query select 'in_progress'::text, null::integer, null::jsonb, null::uuid;
end $$;

create or replace function public.idempotency_complete(
  p_user uuid,
  p_scope text,
  p_key text,
  p_lease uuid,
  p_status_code integer,
  p_response jsonb
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform set_config('lock_timeout', '3000', true);
  update public.idempotency_keys
  set status = 'completed',
      status_code = p_status_code,
      response_body = p_response,
      updated_at = now()
  where user_id = p_user
    and scope = p_scope
    and key = p_key
    and status = 'in_progress'
    and lease_id = p_lease;
end $$;

create or replace function public.idempotency_release(
  p_user uuid,
  p_scope text,
  p_key text,
  p_lease uuid
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform set_config('lock_timeout', '3000', true);
  delete from public.idempotency_keys
  where user_id = p_user
    and scope = p_scope
    and key = p_key
    and status = 'in_progress'
    and lease_id = p_lease;
end $$;

revoke execute on function public.idempotency_begin(uuid, text, text, text, integer),
  public.idempotency_complete(uuid, text, text, uuid, integer, jsonb),
  public.idempotency_release(uuid, text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.idempotency_begin(uuid, text, text, text, integer),
  public.idempotency_complete(uuid, text, text, uuid, integer, jsonb),
  public.idempotency_release(uuid, text, text, uuid)
  to service_role;

-- ---------------------------------------------------------------- 2. deterministic lock ordering + lock_timeout on balances
create or replace function public.recompute_balance(p_account uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform set_config('lock_timeout', '3000', true);
  -- Serialize concurrent balance updates on the same account row.
  perform 1 from public.accounts where id = p_account for update;
  if not found then
    return;
  end if;

  perform set_config('arshif.recompute', '1', true);
  update public.accounts a set balance = a.opening_balance + coalesce((
    select sum(case
      when t.type = 'income' and t.account_id = a.id then coalesce(t.account_amount, t.amount)
      when t.type = 'expense' and t.account_id = a.id then -coalesce(t.account_amount, t.amount)
      when t.type = 'transfer' and t.account_id = a.id then -coalesce(t.account_amount, t.amount)
      when t.type = 'transfer' and t.to_account_id = a.id then coalesce(t.to_amount, t.amount)
      else 0 end)
    from public.transactions t
    where t.account_id = a.id or t.to_account_id = a.id
  ), 0)
  where a.id = p_account;
  perform set_config('arshif.recompute', '0', true);
end $$;
revoke execute on function public.recompute_balance(uuid) from public, anon, authenticated;

create or replace function public.transactions_balance_stmt() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_ids uuid[] := '{}';
  v_id uuid;
begin
  if coalesce(pg_catalog.current_setting('arshif.defer_balance', true), '0') = '1' then
    return null;
  end if;
  perform set_config('lock_timeout', '3000', true);
  if tg_op in ('INSERT', 'UPDATE') then
    v_ids := v_ids || array(select account_id from new_rows union select to_account_id from new_rows where to_account_id is not null);
  end if;
  if tg_op in ('UPDATE', 'DELETE') then
    v_ids := v_ids || array(select account_id from old_rows union select to_account_id from old_rows where to_account_id is not null);
  end if;
  -- Ascending UUID order prevents AB/BA deadlocks on concurrent opposite transfers.
  for v_id in select distinct x from unnest(v_ids) as x order by x asc loop
    perform public.recompute_balance(v_id);
  end loop;
  return null;
end $$;
revoke execute on function public.transactions_balance_stmt() from public, anon, authenticated;

-- ---------------------------------------------------------------- 3. bounded lock_timeout on debt, bill, invoice & billing locks
create or replace function public.debt_payments_apply() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  d public.debts;
begin
  perform set_config('lock_timeout', '3000', true);
  if tg_op = 'INSERT' then
    select * into d from public.debts where id = new.debt_id and user_id = new.user_id for update;
    if not found then
      raise exception 'debt_not_owned' using errcode = '42501';
    end if;
    if d.status <> 'active' then
      raise exception 'debt_closed' using errcode = 'P0001';
    end if;
    if new.amount > d.balance then
      raise exception 'payment_exceeds_balance' using errcode = 'P0001';
    end if;
    update public.debts
    set balance = greatest(0, d.balance - new.amount),
        status = case when d.balance - new.amount <= 0 then 'paid' else 'active' end
    where id = d.id and user_id = new.user_id;
    return new;
  end if;

  update public.debts
  set balance = least(principal, balance + old.amount),
      status = case when least(principal, balance + old.amount) > 0 then 'active' else 'paid' end
  where id = old.debt_id and user_id = old.user_id;
  return old;
end $$;
revoke execute on function public.debt_payments_apply() from public, anon, authenticated;

create or replace function public.bill_mark_paid(p_bill uuid, p_transaction uuid) returns table (due_date date, paid_periods date[])
language plpgsql security definer set search_path = '' as $$
declare
  b public.bills;
  v_paid date[];
begin
  perform set_config('lock_timeout', '3000', true);
  if exists (select 1 from public.profiles where id = auth.uid() and suspended_at is not null) then
    raise exception 'account_suspended' using errcode = '42501';
  end if;
  select * into b from public.bills where id = p_bill and user_id = auth.uid() for update;
  if not found then
    raise exception 'bill_not_found' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.transactions where id = p_transaction and user_id = auth.uid()) then
    raise exception 'transaction_not_owned' using errcode = '42501';
  end if;
  if b.last_paid_tx is distinct from p_transaction then
    v_paid := case when b.due_date = any (b.paid_periods) then b.paid_periods else b.paid_periods || b.due_date end;
    v_paid := v_paid[greatest(1, cardinality(v_paid) - 59):];
    update public.bills
    set paid_periods = v_paid,
        due_date = public.next_due(b.due_date, b.frequency, b.anchor_day),
        last_paid_tx = p_transaction
    where id = b.id
    returning * into b;
  end if;
  return query select b.due_date, b.paid_periods;
end $$;
revoke execute on function public.bill_mark_paid(uuid, uuid) from public, anon;
grant execute on function public.bill_mark_paid(uuid, uuid) to authenticated;

create or replace function public.invoice_mark_paid(p_invoice uuid, p_transaction uuid) returns table (status text, paid_at timestamptz, transaction_id uuid)
language plpgsql security definer set search_path = '' as $$
declare
  i public.invoices;
  t public.transactions;
begin
  perform set_config('lock_timeout', '3000', true);
  if exists (select 1 from public.profiles where id = auth.uid() and suspended_at is not null) then
    raise exception 'account_suspended' using errcode = '42501';
  end if;
  select * into i from public.invoices where id = p_invoice and user_id = auth.uid() for update;
  if not found then
    raise exception 'invoice_not_found' using errcode = 'P0002';
  end if;
  if i.kind <> 'invoice' then
    raise exception 'quote_cannot_be_paid' using errcode = 'P0001';
  end if;
  if i.status = 'paid' then
    if i.transaction_id is distinct from p_transaction and i.transaction_id is not null then
      raise exception 'invoice_already_paid' using errcode = 'P0001';
    end if;
    return query select i.status, i.paid_at, i.transaction_id;
    return;
  end if;
  select * into t from public.transactions where id = p_transaction and user_id = auth.uid();
  if not found then
    raise exception 'transaction_not_owned' using errcode = '42501';
  end if;
  if t.type <> 'income' or t.amount <> i.total or t.currency <> i.currency then
    raise exception 'transaction_mismatch' using errcode = '22023';
  end if;
  perform set_config('arshif.invoice_paying', 'on', true);
  update public.invoices
  set status = 'paid', paid_at = now(), transaction_id = t.id, account_id = t.account_id
  where id = i.id
  returning * into i;
  perform set_config('arshif.invoice_paying', 'off', true);
  return query select i.status, i.paid_at, i.transaction_id;
end $$;
revoke execute on function public.invoice_mark_paid(uuid, uuid) from public, anon;
grant execute on function public.invoice_mark_paid(uuid, uuid) to authenticated;

create or replace function public.reserve_grant(p_order uuid, p_current timestamptz) returns table (granted_from timestamptz, granted_until timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  o public.orders;
  v_base timestamptz;
begin
  perform set_config('lock_timeout', '3000', true);
  select * into o from public.orders where id = p_order;
  if not found or o.status <> 'paid' or o.user_id is null then raise exception 'order_not_paid'; end if;
  perform pg_advisory_xact_lock(hashtext('grant:' || o.user_id::text));
  select * into o from public.orders where id = p_order for update;
  if not found or o.status <> 'paid' or o.user_id is null then raise exception 'order_not_paid'; end if;
  if o.granted_until is not null then
    return query select o.granted_from, o.granted_until;
    return;
  end if;
  select greatest(now(), coalesce(p_current, now()), coalesce(max(x.granted_until), now())) into v_base
  from public.orders x where x.user_id = o.user_id and x.status = 'paid' and x.id <> o.id and x.granted_until is not null;
  update public.orders set
    granted_from = v_base,
    granted_until = v_base + case o.period
      when 'monthly' then interval '1 month'
      when 'yearly' then interval '1 year'
      else make_interval(days => o.days) end,
    updated_at = now()
  where id = o.id
  returning orders.granted_from, orders.granted_until into o.granted_from, o.granted_until;
  return query select o.granted_from, o.granted_until;
end $$;

create or replace function public.refund_shift(p_order uuid) returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare
  o public.orders;
  v_len interval;
  v_end timestamptz;
begin
  perform set_config('lock_timeout', '3000', true);
  select * into o from public.orders where id = p_order;
  if not found then raise exception 'order_not_found'; end if;
  if o.user_id is null then return null; end if;
  perform pg_advisory_xact_lock(hashtext('grant:' || o.user_id::text));
  select * into o from public.orders where id = p_order for update;
  if not found or o.status <> 'refunded' then return null; end if;
  if o.granted_from is not null and o.granted_until is not null and o.grant_error is distinct from 'refund_applied' then
    v_len := greatest(o.granted_until - greatest(o.granted_from, now()), interval '0');
    update public.orders set granted_from = granted_from - v_len, granted_until = granted_until - v_len, updated_at = now()
    where user_id = o.user_id and status = 'paid' and id <> o.id and granted_from >= o.granted_until;
    update public.orders set grant_error = 'refund_applied', updated_at = now() where id = o.id;
  end if;
  select max(granted_until) into v_end from public.orders
  where user_id = o.user_id and status = 'paid' and id <> o.id and granted_until > now();
  return v_end;
end $$;

revoke execute on function public.reserve_grant(uuid, timestamptz), public.refund_shift(uuid) from public, anon, authenticated;

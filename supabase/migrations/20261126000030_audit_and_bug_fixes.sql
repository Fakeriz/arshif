-- Audit & bug fixes (2026-11-26):
-- 1. Cross-tenant oracle & duplicate decrement fixes in debt_payments_apply / goal_deposits_apply.
-- 2. Validation for profiles.notif_prefs + safe planning_reminders / price_alerts (skipping suspended accounts).
-- 3. Safe restore_rows (UUID pre-check, direct UPDATE for owned rows to preserve paid invoices/quotas, deferred per-tx balance recompute).
-- 4. Post-lock state checks in reserve_grant / refund_shift.
-- 5. Asset symbol shape + CoinGecko crypto allowlist + 200-asset hard cap trigger + non-suspended asset_price_keys.
-- 6. Privilege revocations, explicit search_path on SQL helpers, effective_plan parity, suspended user RPC blocks,
--    Storage depth/update policies, invoice/budget payload bounds, ai_jobs 24h fail cap, edge_rate_limits, missing indexes.

-- ---------------------------------------------------------------- 1. debt_payments_apply & goal_deposits_apply
drop trigger if exists debt_payments_apply on public.debt_payments;

create or replace function public.debt_payments_apply() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  d public.debts;
begin
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

create trigger debt_payments_apply after insert or delete on public.debt_payments
  for each row execute function public.debt_payments_apply();
revoke execute on function public.debt_payments_apply() from public, anon, authenticated;

create or replace function public.goal_deposits_apply() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  g public.goals;
begin
  if tg_op = 'INSERT' then
    update public.goals set collected = collected + new.amount
    where id = new.goal_id and user_id = new.user_id
    returning * into g;
    if not found then
      raise exception 'goal_not_owned' using errcode = '42501';
    end if;
    if g.status = 'active' and g.collected >= g.target then
      update public.goals set status = 'completed', completed_at = now()
      where id = g.id and user_id = g.user_id;
      insert into public.notifications (user_id, type, title_key, message_key, vars, href)
      values (g.user_id, 'goal_reached', 'domain.notif.goalTitle', 'domain.notif.goalMessage',
              jsonb_build_object('name', g.name, 'amount', g.target, 'currency', g.currency), '/rencana/goals');
    end if;
    return new;
  end if;

  update public.goals set collected = greatest(0, collected - old.amount)
  where id = old.goal_id and user_id = old.user_id;
  return old;
end $$;

-- ---------------------------------------------------------------- 2. notif_prefs validation & safe planning/price reminders
update public.profiles
set notif_prefs = '{"bill_due":true,"budget_alert":true,"weekly_recap":true,"quota_warning":true}'::jsonb
where jsonb_typeof(notif_prefs) <> 'object'
   or pg_column_size(notif_prefs) > 1024
   or ((notif_prefs ? 'bill_due') and jsonb_typeof(notif_prefs -> 'bill_due') <> 'boolean')
   or ((notif_prefs ? 'budget_alert') and jsonb_typeof(notif_prefs -> 'budget_alert') <> 'boolean')
   or ((notif_prefs ? 'weekly_recap') and jsonb_typeof(notif_prefs -> 'weekly_recap') <> 'boolean')
   or ((notif_prefs ? 'quota_warning') and jsonb_typeof(notif_prefs -> 'quota_warning') <> 'boolean')
   or ((notif_prefs ? 'budget_80') and jsonb_typeof(notif_prefs -> 'budget_80') <> 'boolean')
   or ((notif_prefs ? 'budget_100') and jsonb_typeof(notif_prefs -> 'budget_100') <> 'boolean')
   or ((notif_prefs ? 'monthly_recap') and jsonb_typeof(notif_prefs -> 'monthly_recap') <> 'boolean')
   or ((notif_prefs ? 'debt_due') and jsonb_typeof(notif_prefs -> 'debt_due') <> 'boolean')
   or ((notif_prefs ? 'goal_pace') and jsonb_typeof(notif_prefs -> 'goal_pace') <> 'boolean')
   or ((notif_prefs ? 'price_alert') and jsonb_typeof(notif_prefs -> 'price_alert') <> 'boolean');

alter table public.profiles drop constraint if exists profiles_notif_prefs_check;
alter table public.profiles add constraint profiles_notif_prefs_check check (
  jsonb_typeof(notif_prefs) = 'object'
  and pg_column_size(notif_prefs) <= 1024
  and (not (notif_prefs ? 'bill_due') or jsonb_typeof(notif_prefs -> 'bill_due') = 'boolean')
  and (not (notif_prefs ? 'budget_alert') or jsonb_typeof(notif_prefs -> 'budget_alert') = 'boolean')
  and (not (notif_prefs ? 'weekly_recap') or jsonb_typeof(notif_prefs -> 'weekly_recap') = 'boolean')
  and (not (notif_prefs ? 'quota_warning') or jsonb_typeof(notif_prefs -> 'quota_warning') = 'boolean')
  and (not (notif_prefs ? 'budget_80') or jsonb_typeof(notif_prefs -> 'budget_80') = 'boolean')
  and (not (notif_prefs ? 'budget_100') or jsonb_typeof(notif_prefs -> 'budget_100') = 'boolean')
  and (not (notif_prefs ? 'monthly_recap') or jsonb_typeof(notif_prefs -> 'monthly_recap') = 'boolean')
  and (not (notif_prefs ? 'debt_due') or jsonb_typeof(notif_prefs -> 'debt_due') = 'boolean')
  and (not (notif_prefs ? 'goal_pace') or jsonb_typeof(notif_prefs -> 'goal_pace') = 'boolean')
  and (not (notif_prefs ? 'price_alert') or jsonb_typeof(notif_prefs -> 'price_alert') = 'boolean')
);

create or replace function public.planning_reminders(p_now timestamptz default now()) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_count integer := 0;
  v_n integer;
begin
  update public.subscriptions s
  set next_renewal = public.next_due(s.next_renewal, s.cycle, s.anchor_day)
  from public.profiles p
  where p.id = s.user_id
    and p.suspended_at is null
    and s.status = 'active'
    and s.next_renewal < (p_now at time zone p.timezone)::date;

  with local as (
    select p.id, p.notif_prefs, (p_now at time zone p.timezone)::date as today,
           extract(hour from p_now at time zone p.timezone) as hour
    from public.profiles p
    where p.suspended_at is null
  ), due as (
    select b.*, l.today, b.due_date - l.today as days
    from public.bills b join local l on l.id = b.user_id
    where l.hour >= 7
      and coalesce(l.notif_prefs -> 'bill_due', 'true'::jsonb) is distinct from 'false'::jsonb
      and not (b.due_date = any (b.paid_periods))
      and b.due_date - l.today in (0, 3)
  )
  insert into public.notifications (user_id, type, title_key, message_key, vars, href, dedupe_key)
  select user_id, 'bill_due',
         case when days = 0 then 'domain.notif.billTodayTitle' else 'domain.notif.billSoonTitle' end,
         'domain.notif.billDueMessage',
         jsonb_build_object('biller', name, 'amount', amount, 'currency', currency, 'date', due_date, 'days', days),
         '/rencana/tagihan', 'bill:' || id || ':' || due_date || ':' || days
  from due
  on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
  get diagnostics v_n = row_count;
  v_count := v_count + v_n;

  with local as (
    select p.id, (p_now at time zone p.timezone)::date as today,
           extract(hour from p_now at time zone p.timezone) as hour
    from public.profiles p
    where p.suspended_at is null
  )
  insert into public.notifications (user_id, type, title_key, message_key, vars, href, dedupe_key)
  select s.user_id, 'subscription_renewal', 'domain.notif.subTitle', 'domain.notif.subMessage',
         jsonb_build_object('name', s.name, 'amount', s.amount, 'currency', s.currency, 'date', s.next_renewal),
         '/rencana/langganan', 'sub:' || s.id || ':' || s.next_renewal
  from public.subscriptions s join local l on l.id = s.user_id
  where l.hour >= 7 and s.status = 'active' and s.next_renewal - l.today = 2
  on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
  get diagnostics v_n = row_count;
  return v_count + v_n;
end $$;
revoke execute on function public.planning_reminders(timestamptz) from public, anon, authenticated;

create or replace function public.price_alerts(p_now timestamptz default now()) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_n integer;
begin
  with hit as (
    select al.id, al.user_id, al.pct, al.base_price, al.currency, a.name, a.symbol, p.price,
           round((p.price - al.base_price) / al.base_price * 100, 1) as change_pct
    from public.asset_price_alerts al
    join public.profiles pr on pr.id = al.user_id
    join public.assets a on a.id = al.asset_id
    join public.asset_prices p on p.symbol = a.price_key and p.currency = al.currency
    where pr.suspended_at is null
      and al.triggered_at is null
      and abs(p.price - al.base_price) / al.base_price * 100 >= al.pct
  ), sent as (
    insert into public.notifications (user_id, type, title_key, message_key, vars, href, dedupe_key)
    select user_id, 'price_alert',
           case when change_pct >= 0 then 'domain.notif.priceUpTitle' else 'domain.notif.priceDownTitle' end,
           'domain.notif.priceAlertMessage',
           jsonb_build_object('name', name, 'symbol', symbol, 'change', change_pct, 'threshold', pct,
                              'price', price, 'base', base_price, 'priceCurrency', currency),
           '/aset', 'price-alert:' || id || ':' || base_price
    from hit
    on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing
    returning 1
  )
  update public.asset_price_alerts al set triggered_at = p_now from hit where al.id = hit.id;
  get diagnostics v_n = row_count;
  return v_n;
end $$;
revoke execute on function public.price_alerts(timestamptz) from public, anon, authenticated;

-- ---------------------------------------------------------------- 3. transactions_balance_stmt & restore_rows
create or replace function public.transactions_balance_stmt() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_ids uuid[] := '{}';
  v_id uuid;
begin
  if coalesce(pg_catalog.current_setting('arshif.defer_balance', true), '0') = '1' then
    return null;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    v_ids := v_ids || array(select account_id from new_rows union select to_account_id from new_rows where to_account_id is not null);
  end if;
  if tg_op in ('UPDATE', 'DELETE') then
    v_ids := v_ids || array(select account_id from old_rows union select to_account_id from old_rows where to_account_id is not null);
  end if;
  for v_id in select distinct x from unnest(v_ids) as x loop
    perform public.recompute_balance(v_id);
  end loop;
  return null;
end $$;
revoke execute on function public.transactions_balance_stmt() from public, anon, authenticated;

create or replace function public.restore_rows(p_table text, p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
set statement_timeout = '15000'
as $$
declare
  v_uid uuid := auth.uid();
  v_conflict text;
  v_ins text;
  v_ins_cols text[];
  v_upd_cols text[];
  v_upd text;
  v_sql text;
  r jsonb;
  v_clean jsonb;
  v_id_txt text;
  v_owner uuid;
  v_key_count integer;
  n integer;
  ok integer := 0;
  skipped integer := 0;
  v_err text;
  v_acc record;
begin
  if v_uid is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  if exists (select 1 from public.profiles where id = v_uid and suspended_at is not null) then
    raise exception 'account_suspended' using errcode = '42501';
  end if;

  v_conflict := case p_table
    when 'user_rates' then 'user_id, code'
    when 'net_worth_snapshots' then 'user_id, date'
    when 'budgets' then 'user_id, period_start'
    when 'accounts' then 'id' when 'limit_groups' then 'id' when 'transactions' then 'id'
    when 'transaction_items' then 'id' when 'goals' then 'id' when 'goal_deposits' then 'id'
    when 'debts' then 'id' when 'debt_payments' then 'id' when 'bills' then 'id'
    when 'subscriptions' then 'id' when 'split_bills' then 'id' when 'invoices' then 'id'
    when 'assets' then 'id' when 'asset_price_alerts' then 'id' when 'smartlog_rules' then 'id'
  end;
  if v_conflict is null then
    raise exception 'restore_table_not_allowed' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 500 then
    raise exception 'restore_bad_rows' using errcode = 'P0001';
  end if;

  select array_agg(c.column_name::text) into v_ins_cols
  from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = p_table and c.is_generated = 'NEVER' and c.column_name <> 'user_id'
    and (c.column_name = 'id' or exists (
      select 1 from information_schema.role_column_grants g
      where g.table_schema = 'public' and g.table_name = p_table and g.column_name = c.column_name
        and g.privilege_type = 'INSERT' and g.grantee in ('authenticated', 'PUBLIC')));

  select array_agg(c.column_name::text) into v_upd_cols
  from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = p_table and c.is_generated = 'NEVER'
    and c.column_name not in ('id', 'user_id') and c.column_name <> all (string_to_array(replace(v_conflict, ' ', ''), ','))
    and exists (select 1 from information_schema.role_column_grants g
                where g.table_schema = 'public' and g.table_name = p_table and g.column_name = c.column_name
                  and g.privilege_type = 'UPDATE' and g.grantee in ('authenticated', 'PUBLIC'));

  if p_table = 'transactions' then
    perform pg_catalog.set_config('arshif.defer_balance', '1', true);
  end if;

  for r in select * from jsonb_array_elements(p_rows) loop
    if jsonb_typeof(r) <> 'object' then
      skipped := skipped + 1;
      v_err := coalesce(v_err, '22023: row_not_object');
      continue;
    end if;
    select count(*) into v_key_count from jsonb_object_keys(r);
    if v_key_count < 1 or v_key_count > 64 then
      skipped := skipped + 1;
      v_err := coalesce(v_err, '22023: row_key_count');
      continue;
    end if;

    v_clean := (r - 'user_id') || jsonb_build_object('user_id', v_uid);
    select string_agg(quote_ident(k), ', ') into v_ins from jsonb_object_keys(v_clean) k where k = any (v_ins_cols);
    select string_agg(format('%1$I = excluded.%1$I', k), ', ') into v_upd from jsonb_object_keys(v_clean) k where k = any (v_upd_cols);
    if v_ins is null then
      skipped := skipped + 1;
      v_err := coalesce(v_err, 'restore_empty_row');
      continue;
    end if;

    if v_conflict = 'id' then
      v_id_txt := v_clean ->> 'id';
      if v_id_txt is not null then
        if v_id_txt !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
          skipped := skipped + 1;
          v_err := coalesce(v_err, '22P02: invalid_uuid');
          continue;
        end if;
        execute format('select user_id from public.%I where id = $1', p_table) into v_owner using v_id_txt::uuid;
      else
        v_owner := null;
      end if;

      if v_owner is not null and v_owner <> v_uid then
        skipped := skipped + 1;
        v_err := coalesce(v_err, '42501: foreign_row_id');
        continue;
      end if;

      if v_owner = v_uid then
        if v_upd is null then
          skipped := skipped + 1;
          continue;
        end if;
        begin
          v_sql := format(
            'update public.%1$I as t set %2$s from jsonb_populate_record(null::public.%1$I, $1) as excluded where t.id = $3 and t.user_id = $2',
            p_table, v_upd);
          execute v_sql using v_clean, v_uid, v_id_txt::uuid;
          get diagnostics n = row_count;
          if n = 1 then ok := ok + 1; else skipped := skipped + 1; end if;
        exception when others then
          skipped := skipped + 1;
          v_err := coalesce(v_err, sqlerrm);
        end;
        continue;
      end if;
    end if;

    begin
      if v_conflict = 'id' then
        v_sql := format(
          'insert into public.%1$I (user_id, %2$s) select $2, %2$s from jsonb_populate_record(null::public.%1$I, $1)',
          p_table, v_ins);
      else
        v_sql := format(
          'insert into public.%1$I as t (user_id, %2$s) select $2, %2$s from jsonb_populate_record(null::public.%1$I, $1) '
          'on conflict (%3$s) do %4$s',
          p_table, v_ins, v_conflict, coalesce('update set ' || v_upd || ' where t.user_id = $2', 'nothing'));
      end if;
      execute v_sql using v_clean, v_uid;
      get diagnostics n = row_count;
      if n = 1 then ok := ok + 1; else skipped := skipped + 1; end if;
    exception when others then
      skipped := skipped + 1;
      v_err := coalesce(v_err, sqlerrm);
    end;
  end loop;

  if p_table = 'transactions' then
    perform pg_catalog.set_config('arshif.defer_balance', '0', true);
    for v_acc in select id from public.accounts where user_id = v_uid loop
      perform public.recompute_balance(v_acc.id);
    end loop;
  end if;

  return jsonb_build_object('restored', ok, 'skipped', skipped, 'first_error', v_err);
end $$;

-- ---------------------------------------------------------------- 4. reserve_grant & refund_shift post-lock checks
create or replace function public.reserve_grant(p_order uuid, p_current timestamptz) returns table (granted_from timestamptz, granted_until timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  o public.orders;
  v_base timestamptz;
begin
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

-- ---------------------------------------------------------------- 5. assets constraints, hard cap & non-suspended price keys
alter table public.assets drop constraint if exists assets_symbol_shape_check;
alter table public.assets drop constraint if exists assets_z_symbol_shape_check;
alter table public.assets add constraint assets_z_symbol_shape_check
  check (symbol is null or symbol ~ '^[A-Z0-9]+(\.[A-Z0-9]+)*$');

alter table public.assets drop constraint if exists assets_crypto_allowlist_check;
alter table public.assets drop constraint if exists assets_z_crypto_allowlist_check;
alter table public.assets add constraint assets_z_crypto_allowlist_check
  check (
    type <> 'crypto'
    or symbol !~ '^[A-Z0-9.]{1,15}$'
    or symbol in ('BTC', 'ETH', 'USDT', 'USDC', 'BNB', 'SOL', 'XRP', 'DOGE', 'ADA', 'TRX', 'TON', 'AVAX', 'DOT', 'LINK', 'POL', 'LTC', 'SHIB', 'BCH')
  );

create or replace function public.assets_enforce_hard_cap() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.assets where user_id = new.user_id) >= 200 then
    raise exception 'quota_assets' using errcode = 'P0002';
  end if;
  return new;
end $$;

drop trigger if exists assets_hard_cap on public.assets;
create trigger assets_hard_cap before insert on public.assets
  for each row execute function public.assets_enforce_hard_cap();
revoke execute on function public.assets_enforce_hard_cap() from public, anon, authenticated;

create or replace function public.asset_price_keys() returns text[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(distinct a.price_key order by a.price_key), '{}')
  from public.assets a
  join public.profiles p on p.id = a.user_id
  where a.price_key is not null and p.suspended_at is null
$$;

-- ---------------------------------------------------------------- 6. privileges, search_path, effective_plan, suspension, storage & bounds
revoke execute on function public.my_usage(), public.is_admin(), public.current_period(),
  public.admin_orders(text, integer), public.admin_ai_usage(integer), public.admin_ai_failures(integer), public.admin_find_user(text)
  from public, anon;
grant execute on function public.my_usage(), public.is_admin(), public.current_period(),
  public.admin_orders(text, integer), public.admin_ai_usage(integer), public.admin_ai_failures(integer), public.admin_find_user(text)
  to authenticated, service_role;

revoke all on public.place_lookups from anon, authenticated;

alter function public.current_period() set search_path = '';
alter function public.period_for(text) set search_path = '';
alter function public.total_tables(text) set search_path = '';

create or replace function public.my_usage()
returns table (key text, used integer, monthly_limit integer, "window" text)
language sql stable security definer set search_path = '' as $$
  select l.key,
         case when l."window" = 'total' then public.count_owned(p.id, public.total_tables(l.key))
              when l."window" = 'feature' then 0
              else coalesce(u.used, 0) end,
         l.monthly_limit,
         l."window"
  from public.profiles p
  join public.plan_limits l on l.plan = public.effective_plan(p.plan, p.premium_until)
  left join public.usage_counters u on u.user_id = p.id and u.key = l.key and u.period = public.period_for(l."window")
  where p.id = auth.uid();
$$;

create or replace function public.admin_find_user(p_email text)
returns table (id uuid, email text, plan text, premium_until timestamptz, premium_source text)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.assert_admin();
  return query
    select u.id, u.email::text, public.effective_plan(p.plan, p.premium_until), p.premium_until, p.premium_source
    from auth.users u join public.profiles p on p.id = u.id
    where lower(u.email) = lower(trim(p_email));
end $$;

create or replace function public.admin_dashboard() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_today date := (now() at time zone 'Asia/Jakarta')::date;
  v_day_start timestamptz := (v_today::timestamp at time zone 'Asia/Jakarta');
  v_month_start timestamptz := (date_trunc('month', v_today)::timestamp at time zone 'Asia/Jakarta');
begin
  perform public.assert_admin();
  return jsonb_build_object(
    'today', v_today,
    'total_users', (select count(*) from auth.users),
    'new_today', (select count(*) from auth.users where created_at >= v_day_start),
    'dau', (select count(*) from public.user_activity_days where day = v_today),
    'dau_7', (
      select coalesce(jsonb_agg(jsonb_build_object('day', d::date, 'users', (select count(*) from public.user_activity_days a where a.day = d::date)) order by d), '[]')
      from generate_series(v_today - 6, v_today, interval '1 day') d
    ),
    'premium_users', (select count(*) from public.profiles where public.effective_plan(plan, premium_until) = 'premium'),
    'premium_by_source', (
      select coalesce(jsonb_object_agg(coalesce(premium_source, 'unknown'), n), '{}')
      from (select premium_source, count(*) n from public.profiles where public.effective_plan(plan, premium_until) = 'premium' group by 1) s
    ),
    'suspended_users', (select count(*) from public.profiles where suspended_at is not null),
    'ai_today', (
      select coalesce(jsonb_object_agg(kind, jsonb_build_object('total', total, 'failed', failed)), '{}')
      from (
        select kind, count(*) filter (where status <> 'limited') total, count(*) filter (where status = 'failed') failed
        from public.ai_jobs where created_at >= v_day_start group by kind
      ) j
    ),
    'revenue_month', (
      select coalesce(jsonb_object_agg(currency, amount), '{}')
      from (
        select currency, sum(amount) amount from public.orders
        where provider in ('xendit', 'paddle') and status = 'paid' and paid_at >= v_month_start group by currency
      ) r
    ),
    'paid_orders_month', (select count(*) from public.orders where provider in ('xendit', 'paddle') and status = 'paid' and paid_at >= v_month_start)
  );
end $$;

create or replace function public.admin_search_users(p_query text default '', p_limit integer default 50)
returns table (id uuid, email text, display_name text, plan text, premium_until timestamptz, premium_source text,
               suspended_at timestamptz, last_seen_at timestamptz, created_at timestamptz, is_admin boolean)
language plpgsql stable security definer set search_path = '' as $$
declare
  q text := lower(trim(coalesce(p_query, '')));
begin
  perform public.assert_admin();
  return query
    select u.id, u.email::text, p.display_name, public.effective_plan(p.plan, p.premium_until), p.premium_until, p.premium_source, p.suspended_at, p.last_seen_at,
           u.created_at, exists (select 1 from public.admin_users a where a.user_id = u.id)
    from auth.users u join public.profiles p on p.id = u.id
    where q = '' or lower(u.email) like '%' || replace(replace(q, '%', '\%'), '_', '\_') || '%'
       or lower(coalesce(p.display_name, '')) like '%' || replace(replace(q, '%', '\%'), '_', '\_') || '%'
       or u.id::text = q
    order by coalesce(p.last_seen_at, u.created_at) desc
    limit least(greatest(p_limit, 1), 200);
end $$;

create or replace function public.admin_user_detail(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.assert_admin();
  return (
    select jsonb_build_object(
      'id', u.id, 'email', u.email, 'display_name', p.display_name, 'plan', public.effective_plan(p.plan, p.premium_until), 'premium_until', p.premium_until,
      'premium_source', p.premium_source, 'suspended_at', p.suspended_at, 'last_seen_at', p.last_seen_at,
      'created_at', u.created_at, 'onboarded', p.onboarded_at is not null, 'main_currency', p.main_currency, 'lang', p.lang,
      'is_admin', exists (select 1 from public.admin_users a where a.user_id = u.id),
      'usage', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'key', l.key,
          'used', case when l."window" = 'total' then public.count_owned(p.id, public.total_tables(l.key))
                       when l."window" = 'feature' then 0 else coalesce(c.used, 0) end,
          'limit', l.monthly_limit, 'window', l."window") order by l.key), '[]')
        from public.plan_limits l
        left join public.usage_counters c on c.user_id = p.id and c.key = l.key and c.period = public.period_for(l."window")
        where l.plan = public.effective_plan(p.plan, p.premium_until)
      ),
      'orders', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', o.id, 'provider', o.provider, 'period', o.period, 'status', o.status, 'days', o.days, 'currency', o.currency,
          'amount', o.amount, 'created_at', o.created_at, 'granted_until', o.granted_until) order by o.created_at desc), '[]')
        from (select * from public.orders where user_id = p.id order by created_at desc limit 20) o
      ),
      'ai_30d', (
        select coalesce(jsonb_object_agg(kind, n), '{}')
        from (select kind, count(*) n from public.ai_jobs where user_id = p.id and created_at >= now() - interval '30 days' group by kind) j
      )
    )
    from auth.users u join public.profiles p on p.id = u.id
    where u.id = p_user
  );
end $$;

create or replace function public.admin_broadcast(p_segment text, p_title text, p_message text, p_email text default null)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_count integer;
  v_title text := trim(coalesce(p_title, ''));
  v_message text := trim(coalesce(p_message, ''));
begin
  perform public.assert_admin();
  if char_length(v_title) not between 1 and 80 or char_length(v_message) not between 1 and 300 then
    raise exception 'invalid_broadcast' using errcode = '22023';
  end if;
  if p_segment not in ('all', 'free', 'premium', 'email') then
    raise exception 'invalid_segment' using errcode = '22023';
  end if;
  insert into public.notifications (user_id, type, title_key, message_key, vars)
  select p.id, 'system', 'domain.notif.broadcastTitle', 'domain.notif.broadcastMessage',
         jsonb_build_object('title', v_title, 'message', v_message)
  from public.profiles p join auth.users u on u.id = p.id
  where p.suspended_at is null
    and case p_segment
      when 'all' then true
      when 'free' then public.effective_plan(p.plan, p.premium_until) = 'free'
      when 'premium' then public.effective_plan(p.plan, p.premium_until) = 'premium'
      else lower(u.email) = lower(trim(coalesce(p_email, '')))
    end;
  get diagnostics v_count = row_count;
  return v_count;
end $$;

create or replace function public.admin_broadcast_count(p_segment text, p_email text default null) returns integer
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.assert_admin();
  return (
    select count(*) from public.profiles p join auth.users u on u.id = p.id
    where p.suspended_at is null
      and case p_segment
        when 'all' then true
        when 'free' then public.effective_plan(p.plan, p.premium_until) = 'free'
        when 'premium' then public.effective_plan(p.plan, p.premium_until) = 'premium'
        when 'email' then lower(u.email) = lower(trim(coalesce(p_email, '')))
        else false
      end
  );
end $$;

-- Enforce suspended_at is null across mutating/feature RPCs (keep SELECT RLS open for SuspendedScreen).
create or replace function public.smartlog_ingest(
  p_capture_key text, p_package text, p_bank text, p_posted_at timestamptz, p_date date, p_time time,
  p_type text, p_amount bigint, p_currency text, p_merchant text, p_excerpt text, p_fingerprint text, p_doubts text[]
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_enabled boolean;
  v_suspended timestamptz;
  v_item public.smartlog_items;
  v_account uuid;
  v_account_currency text;
  v_reasons text[];
  v_status text;
  v_id uuid := gen_random_uuid();
begin
  if v_uid is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  select smartlog_enabled, suspended_at into v_enabled, v_suspended from public.profiles where id = v_uid;
  if v_suspended is not null or not coalesce(v_enabled, false) then
    return jsonb_build_object('status', 'disabled');
  end if;

  perform pg_advisory_xact_lock(hashtext('smartlog:' || v_uid::text || ':' || coalesce(p_capture_key, '')));

  select * into v_item from public.smartlog_items where user_id = v_uid and capture_key = p_capture_key;
  if found then
    return jsonb_build_object('status', v_item.status, 'id', v_item.id, 'reasons', to_jsonb(v_item.reasons), 'repeat', true);
  end if;

  if p_type not in ('expense', 'income') or p_amount is null or p_amount <= 0 then
    raise exception 'bad_input' using errcode = '22023';
  end if;
  v_reasons := array(select distinct d from unnest(coalesce(p_doubts, '{}')) d
                     where d in ('type_unclear', 'topup', 'multiple_amounts') order by d);

  if not public.quota_try_consume(v_uid, 'automation') then
    insert into public.notifications (user_id, type, title_key, message_key, href, dedupe_key)
    values (v_uid, 'quota_warning', 'domain.notif.smartlogQuotaTitle', 'domain.notif.smartlogQuotaMessage', '/premium',
            'smartlog-quota:' || public.current_period())
    on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
    return jsonb_build_object('status', 'quota');
  end if;

  select l.account_id, a.currency into v_account, v_account_currency
  from public.smartlog_links l join public.accounts a on a.id = l.account_id
  where l.user_id = v_uid and l.package = p_package;

  if p_type <> 'expense' then v_reasons := array_append(v_reasons, 'not_expense'); end if;
  if p_currency <> 'IDR' then v_reasons := array_append(v_reasons, 'not_idr'); end if;
  if v_account is null then v_reasons := array_append(v_reasons, 'no_link');
  elsif v_account_currency <> p_currency then v_reasons := array_append(v_reasons, 'account_currency');
  end if;

  if exists (select 1 from public.smartlog_items i
             where i.user_id = v_uid and i.fingerprint = p_fingerprint and i.created_at > now() - interval '2 days')
     or (v_account is not null and exists (
           select 1 from public.transactions t
           where t.user_id = v_uid and t.account_id = v_account and t.type = p_type and t.amount = p_amount
             and t.currency = p_currency and t.date = p_date
             and abs(extract(epoch from (t.time - p_time))) <= 600)) then
    v_reasons := array_append(v_reasons, 'duplicate');
  end if;

  v_status := case when cardinality(v_reasons) = 0 then 'applied' else 'review' end;

  insert into public.smartlog_items (id, user_id, capture_key, package, bank, posted_at, date, time, type, amount, currency,
                                     merchant, account_id, status, reasons, excerpt, fingerprint)
  values (v_id, v_uid, p_capture_key, p_package, p_bank, p_posted_at, p_date, p_time, p_type, p_amount, p_currency,
          left(coalesce(p_merchant, ''), 120), v_account, v_status, v_reasons,
          case when v_status = 'review' then left(p_excerpt, 300) end, p_fingerprint);

  if v_status = 'applied' then
    insert into public.transactions (id, user_id, type, merchant, category_key, account_id, date, time, amount, currency, source)
    values (v_id, v_uid, 'expense', left(coalesce(p_merchant, ''), 120), 'other', v_account, p_date, p_time, p_amount, p_currency, 'smartlog');
    update public.smartlog_items set transaction_id = v_id, resolved_at = now() where id = v_id;
  end if;

  return jsonb_build_object('status', v_status, 'id', v_id, 'reasons', to_jsonb(v_reasons));
end $$;

create or replace function public.smartlog_confirm(p_item uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.profiles where id = auth.uid() and suspended_at is not null) then
    raise exception 'account_suspended' using errcode = '42501';
  end if;
  if not exists (select 1 from public.transactions where id = p_item and user_id = auth.uid()) then
    raise exception 'transaction_missing' using errcode = 'P0002';
  end if;
  update public.smartlog_items set status = 'confirmed', transaction_id = p_item, excerpt = null, resolved_at = now()
  where id = p_item and user_id = auth.uid() and status = 'review';
  if not found then raise exception 'not_in_review' using errcode = 'P0002'; end if;
end $$;

create or replace function public.smartlog_dismiss(p_item uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.profiles where id = auth.uid() and suspended_at is not null) then
    raise exception 'account_suspended' using errcode = '42501';
  end if;
  update public.smartlog_items set status = 'dismissed', excerpt = null, resolved_at = now()
  where id = p_item and user_id = auth.uid() and status = 'review';
  if not found then raise exception 'not_in_review' using errcode = 'P0002'; end if;
end $$;

create or replace function public.smartlog_undo(p_item uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_tx uuid;
begin
  if exists (select 1 from public.profiles where id = auth.uid() and suspended_at is not null) then
    raise exception 'account_suspended' using errcode = '42501';
  end if;
  update public.smartlog_items set status = 'undone', resolved_at = now()
  where id = p_item and user_id = auth.uid() and status = 'applied'
  returning transaction_id into v_tx;
  if not found then raise exception 'not_applied' using errcode = 'P0002'; end if;
  if v_tx is not null then
    delete from public.transactions where id = v_tx and user_id = auth.uid();
  end if;
end $$;

create or replace function public.bill_mark_paid(p_bill uuid, p_transaction uuid) returns table (due_date date, paid_periods date[])
language plpgsql security definer set search_path = '' as $$
declare
  b public.bills;
  v_paid date[];
begin
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

create or replace function public.invoice_mark_paid(p_invoice uuid, p_transaction uuid) returns table (status text, paid_at timestamptz, transaction_id uuid)
language plpgsql security definer set search_path = '' as $$
declare
  i public.invoices;
  t public.transactions;
begin
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

create or replace function public.feature_gate(p_key text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
begin
  if exists (select 1 from public.profiles where id = auth.uid() and suspended_at is not null) then
    raise exception 'account_suspended' using errcode = '42501';
  end if;
  if p_key not in ('taxFull', 'pdfExport') then
    raise exception 'unknown_feature' using errcode = '22023';
  end if;
  if not public.plan_allows(auth.uid(), p_key) then
    raise exception 'quota_%', p_key using errcode = 'P0001';
  end if;
  return true;
end $$;

create or replace function public.touch_last_seen() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then return; end if;
  if exists (select 1 from public.profiles where id = auth.uid() and suspended_at is not null) then
    return;
  end if;
  update public.profiles set last_seen_at = now()
  where id = auth.uid() and (last_seen_at is null or last_seen_at < now() - interval '10 minutes');
  insert into public.user_activity_days (user_id, day)
  values (auth.uid(), (now() at time zone 'Asia/Jakarta')::date)
  on conflict do nothing;
end $$;

create or replace function public.revoke_user_sessions(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if to_regclass('auth.sessions') is not null then
    execute 'delete from auth.sessions where user_id = $1' using p_user;
  end if;
end $$;
revoke execute on function public.revoke_user_sessions(uuid) from public, anon, authenticated;
grant execute on function public.revoke_user_sessions(uuid) to service_role;

-- Storage folder depth guards + upsert update policy for receipts restore
drop policy if exists receipts_own_insert on storage.objects;
create policy receipts_own_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and cardinality(storage.foldername(name)) = 1
  );

drop policy if exists receipts_own_update on storage.objects;
create policy receipts_own_update on storage.objects for update to authenticated
  using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and cardinality(storage.foldername(name)) = 1
  )
  with check (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and cardinality(storage.foldername(name)) = 1
  );

drop policy if exists statements_own_insert on storage.objects;
create policy statements_own_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'statements'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and cardinality(storage.foldername(name)) = 1
  );

drop policy if exists avatars_own_insert on storage.objects;
create policy avatars_own_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and cardinality(storage.foldername(name)) = 1
  );

-- Bounds on invoice item unitPrice & budget category_limits payload size/keys
create or replace function public.invoices_compute() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_item jsonb;
  v_qty numeric;
  v_price numeric;
  v_sub numeric := 0;
begin
  for v_item in select * from jsonb_array_elements(new.items) loop
    if jsonb_typeof(v_item) <> 'object' or jsonb_typeof(v_item -> 'name') <> 'string'
       or jsonb_typeof(v_item -> 'qty') <> 'number' or jsonb_typeof(v_item -> 'unitPrice') <> 'number' then
      raise exception 'invoice_item_invalid' using errcode = '22023';
    end if;
    v_qty := (v_item ->> 'qty')::numeric;
    v_price := (v_item ->> 'unitPrice')::numeric;
    if char_length(v_item ->> 'name') not between 1 and 120 or v_qty <= 0 or v_qty > 100000 or v_qty <> round(v_qty, 2)
       or v_price < 0 or v_price > 1000000000000 or v_price <> trunc(v_price) then
      raise exception 'invoice_item_invalid' using errcode = '22023';
    end if;
    v_sub := v_sub + round(v_qty * v_price);
  end loop;
  if new.discount > v_sub then
    raise exception 'invoice_discount_exceeds' using errcode = '22023';
  end if;
  new.subtotal := v_sub;
  new.tax := round((v_sub - new.discount) * new.tax_bp / 10000.0);
  new.total := v_sub - new.discount + new.tax;
  if new.total <= 0 then
    raise exception 'invoice_total_zero' using errcode = '22023';
  end if;
  return new;
end $$;

create or replace function public.budgets_check() returns trigger
language plpgsql set search_path = '' as $$
declare
  k text;
  v jsonb;
  v_count integer := 0;
begin
  if jsonb_typeof(new.category_limits) <> 'object' or pg_column_size(new.category_limits) > 8192 then
    raise exception 'budget_limit_invalid' using errcode = '22023';
  end if;
  for k, v in select * from jsonb_each(new.category_limits) loop
    v_count := v_count + 1;
    if v_count > 64 or k !~ '^[a-z_]{1,32}$' or jsonb_typeof(v) <> 'number' or (v #>> '{}')::numeric < 0
       or (v #>> '{}')::numeric <> trunc((v #>> '{}')::numeric) then
      raise exception 'budget_limit_invalid' using errcode = '22023';
    end if;
  end loop;
  new.updated_at := now();
  return new;
end $$;

-- 24h failed-job cap in ai_job_start + persistent Edge rate limit table & RPC
create or replace function public.ai_job_start(p_user uuid, p_kind text, p_limit integer default 10) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext('ai_rate:' || p_user::text));
  if (select count(*) from public.ai_jobs where user_id = p_user and created_at >= now() - interval '1 minute') >= p_limit
     or (select count(*) from public.ai_jobs where user_id = p_user and status = 'failed' and created_at >= now() - interval '24 hours') >= 25 then
    insert into public.ai_jobs (user_id, kind, status, latency_ms, error) values (p_user, p_kind, 'limited', 0, 'rate_limited');
    return null;
  end if;
  insert into public.ai_jobs (user_id, kind, status) values (p_user, p_kind, 'started') returning id into v_id;
  return v_id;
end $$;
revoke execute on function public.ai_job_start(uuid, text, integer) from public, anon, authenticated;

create table if not exists public.edge_rate_limits (
  user_id uuid not null references auth.users (id) on delete cascade,
  bucket text not null,
  window_key text not null,
  hits integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, bucket, window_key)
);
alter table public.edge_rate_limits enable row level security;
revoke all on public.edge_rate_limits from anon, authenticated;

create or replace function public.rate_limit_hit(p_user uuid, p_bucket text, p_per_min integer, p_per_day integer) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_min text := to_char(now() at time zone 'utc', 'YYYYMMDDHH24MI');
  v_day text := to_char(now() at time zone 'utc', 'YYYYMMDD');
  v_min_hits integer;
  v_day_hits integer;
begin
  if p_user is null or p_per_min < 1 or p_per_day < 1 then
    return false;
  end if;
  perform pg_advisory_xact_lock(hashtext('edge_rate:' || p_user::text || ':' || p_bucket));

  select hits into v_min_hits from public.edge_rate_limits where user_id = p_user and bucket = p_bucket and window_key = 'm:' || v_min;
  if coalesce(v_min_hits, 0) >= p_per_min then
    return false;
  end if;

  select hits into v_day_hits from public.edge_rate_limits where user_id = p_user and bucket = p_bucket and window_key = 'd:' || v_day;
  if coalesce(v_day_hits, 0) >= p_per_day then
    return false;
  end if;

  delete from public.edge_rate_limits where user_id = p_user and bucket = p_bucket and updated_at < now() - interval '2 days';

  insert into public.edge_rate_limits (user_id, bucket, window_key, hits, updated_at)
  values (p_user, p_bucket, 'm:' || v_min, 1, now()), (p_user, p_bucket, 'd:' || v_day, 1, now())
  on conflict (user_id, bucket, window_key) do update
  set hits = public.edge_rate_limits.hits + 1, updated_at = now();

  return true;
end $$;
revoke execute on function public.rate_limit_hit(uuid, text, integer, integer) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(uuid, text, integer, integer) to service_role;

-- Missing foreign key / user_id indexes
create index if not exists transaction_items_user_idx on public.transaction_items (user_id);
create index if not exists goal_deposits_user_idx on public.goal_deposits (user_id);
create index if not exists debt_payments_user_idx on public.debt_payments (user_id);
create index if not exists limit_groups_user_idx on public.limit_groups (user_id);
create index if not exists asset_price_alerts_user_idx on public.asset_price_alerts (user_id);
create index if not exists split_bills_tx_idx on public.split_bills (transaction_id) where transaction_id is not null;
create index if not exists smartlog_items_tx_idx on public.smartlog_items (transaction_id) where transaction_id is not null;

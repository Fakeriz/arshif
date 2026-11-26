-- Fitur Smart Log Rules: aturan pencatatan otomatis untuk merchant berulang dan transfer antar akun sendiri.

create table public.smartlog_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  pattern text not null check (char_length(btrim(pattern)) between 2 and 60),
  action text not null check (action in ('categorize', 'transfer')),
  category_key text not null default 'other' check (category_key ~ '^[a-z_]{1,32}$'),
  to_account_id uuid references public.accounts (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint smartlog_rules_shape check (
    (action = 'categorize' and to_account_id is null)
    or (action = 'transfer' and to_account_id is not null)
  )
);

create unique index smartlog_rules_user_pattern_idx on public.smartlog_rules (user_id, lower(btrim(pattern)));

create or replace function public.smartlog_rules_check() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.profiles where id = new.user_id and suspended_at is not null) then
    raise exception 'account_suspended' using errcode = '42501';
  end if;

  new.pattern := btrim(new.pattern);

  if tg_op = 'INSERT' then
    if (select count(*) from public.smartlog_rules where user_id = new.user_id) >= 50 then
      raise exception 'quota_smartlog_rules' using errcode = 'P0002';
    end if;
  end if;

  if new.action = 'transfer' then
    new.category_key := 'savings';
    if not exists (select 1 from public.accounts where id = new.to_account_id and user_id = new.user_id) then
      raise exception 'account_not_owned' using errcode = '42501';
    end if;
  end if;

  return new;
end $$;

create trigger smartlog_rules_check before insert or update on public.smartlog_rules
  for each row execute function public.smartlog_rules_check();

alter table public.smartlog_rules enable row level security;
revoke all on public.smartlog_rules from public, anon, authenticated;
grant select, delete on public.smartlog_rules to authenticated;
grant insert (id, pattern, action, category_key, to_account_id) on public.smartlog_rules to authenticated;
grant update (pattern, action, category_key, to_account_id) on public.smartlog_rules to authenticated;
revoke execute on function public.smartlog_rules_check() from public, anon, authenticated;

create policy smartlog_rules_all on public.smartlog_rules for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

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
  v_rule public.smartlog_rules;
  v_tx_type text := 'expense';
  v_cat text := 'other';
  v_to_account uuid := null;
  v_to_currency text;
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

  if p_type = 'expense' then
    select * into v_rule
    from public.smartlog_rules r
    where r.user_id = v_uid
      and strpos(lower(coalesce(p_merchant, '') || ' ' || coalesce(p_excerpt, '')), lower(btrim(r.pattern))) > 0
    order by char_length(btrim(r.pattern)) desc, r.created_at asc
    limit 1;

    if found then
      if v_rule.action = 'categorize' then
        v_cat := v_rule.category_key;
      elsif v_rule.action = 'transfer' and v_rule.to_account_id is not null then
        select a.currency into v_to_currency
        from public.accounts a
        where a.id = v_rule.to_account_id and a.user_id = v_uid;
        if v_account is not null and v_rule.to_account_id <> v_account and v_to_currency = p_currency then
          v_reasons := array_remove(v_reasons, 'topup');
          v_tx_type := 'transfer';
          v_cat := 'savings';
          v_to_account := v_rule.to_account_id;
        end if;
      end if;
    end if;
  end if;

  if p_type <> 'expense' then v_reasons := array_append(v_reasons, 'not_expense'); end if;
  if p_currency <> 'IDR' then v_reasons := array_append(v_reasons, 'not_idr'); end if;
  if v_account is null then v_reasons := array_append(v_reasons, 'no_link');
  elsif v_account_currency <> p_currency then v_reasons := array_append(v_reasons, 'account_currency');
  end if;

  if exists (select 1 from public.smartlog_items i
             where i.user_id = v_uid and i.fingerprint = p_fingerprint and i.created_at > now() - interval '2 days')
     or (v_account is not null and exists (
           select 1 from public.transactions t
           where t.user_id = v_uid and t.account_id = v_account and t.type in (p_type, v_tx_type) and t.amount = p_amount
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
    insert into public.transactions (id, user_id, type, merchant, category_key, account_id, to_account_id, date, time, amount, currency, source)
    values (v_id, v_uid, v_tx_type, left(coalesce(p_merchant, ''), 120), v_cat, v_account, v_to_account, p_date, p_time, p_amount, p_currency, 'smartlog');
    update public.smartlog_items set transaction_id = v_id, resolved_at = now() where id = v_id;
  end if;

  return jsonb_build_object(
    'status', v_status,
    'id', v_id,
    'reasons', to_jsonb(v_reasons),
    'tx_type', v_tx_type,
    'category_key', v_cat,
    'to_account_id', v_to_account
  );
end $$;

-- Audit fixes for assets, price alerts, 200-asset hard cap, and asset_price_history symbol validation.

-- 1. Monotonic rearm_seq on asset_price_alerts & value_override guard in asset_price_alerts_prepare()
alter table public.asset_price_alerts add column if not exists rearm_seq integer not null default 0;

create or replace function public.asset_price_alerts_prepare() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid;
  v_has_override boolean;
  v_price numeric;
  v_currency text;
begin
  select a.user_id, (a.value_override is not null), p.price, p.currency
    into v_owner, v_has_override, v_price, v_currency
  from public.assets a
  left join public.asset_prices p on p.symbol = a.price_key
  where a.id = new.asset_id;

  if v_owner is null or v_owner <> new.user_id then
    raise exception 'alert_not_owner' using errcode = 'P0001';
  end if;
  if v_has_override then
    raise exception 'alert_manual_override' using errcode = 'P0001';
  end if;
  if v_price is null then
    raise exception 'alert_no_price' using errcode = 'P0001';
  end if;

  new.base_price := v_price;
  new.currency := v_currency;
  new.triggered_at := null;
  new.updated_at := clock_timestamp();
  if tg_op = 'UPDATE' then
    new.rearm_seq := coalesce(old.rearm_seq, 0) + 1;
  else
    new.rearm_seq := coalesce(new.rearm_seq, 0);
  end if;
  return new;
end $$;
revoke execute on function public.asset_price_alerts_prepare() from public, anon, authenticated;

-- 2. Delete stale alert when assets.symbol changes or value_override is set
create or replace function public.assets_sync_alerts() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.symbol is distinct from new.symbol or new.value_override is not null then
    delete from public.asset_price_alerts where asset_id = new.id;
  end if;
  return new;
end $$;

drop trigger if exists assets_sync_alerts on public.assets;
create trigger assets_sync_alerts after update of symbol, value_override on public.assets
  for each row execute function public.assets_sync_alerts();
revoke execute on function public.assets_sync_alerts() from public, anon, authenticated;

-- 3. Fix price_alerts(): respect notif_prefs -> 'price_alert', skip manual override, dedupe by rearm_seq
create or replace function public.price_alerts(p_now timestamptz default now()) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_n integer;
begin
  with hit as (
    select al.id, al.user_id, al.pct, al.base_price, al.currency, al.rearm_seq, a.name, a.symbol, p.price,
           round((p.price - al.base_price) / al.base_price * 100, 1) as change_pct
    from public.asset_price_alerts al
    join public.profiles pr on pr.id = al.user_id
    join public.assets a on a.id = al.asset_id
    join public.asset_prices p on p.symbol = a.price_key and p.currency = al.currency
    where pr.suspended_at is null
      and coalesce(pr.notif_prefs -> 'price_alert', 'true'::jsonb) is distinct from 'false'::jsonb
      and a.value_override is null
      and al.triggered_at is null
      and abs(p.price - al.base_price) / al.base_price * 100 >= al.pct
  ), sent as (
    insert into public.notifications (user_id, type, title_key, message_key, vars, href, dedupe_key)
    select user_id, 'price_alert',
           case when change_pct >= 0 then 'domain.notif.priceUpTitle' else 'domain.notif.priceDownTitle' end,
           'domain.notif.priceAlertMessage',
           jsonb_build_object('name', name, 'symbol', symbol, 'change', change_pct, 'threshold', pct,
                              'price', price, 'base', base_price, 'priceCurrency', currency),
           '/aset', 'price-alert:' || id || ':' || rearm_seq
    from hit
    on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing
    returning 1
  )
  update public.asset_price_alerts al set triggered_at = p_now from hit where al.id = hit.id;
  get diagnostics v_n = row_count;
  return v_n;
end $$;
revoke execute on function public.price_alerts(timestamptz) from public, anon, authenticated;

-- 4. Separate 200-asset hard cap error from Free-plan quota_assets
create or replace function public.assets_enforce_hard_cap() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.assets where user_id = new.user_id) >= 200 then
    raise exception 'limit_assets_max' using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke execute on function public.assets_enforce_hard_cap() from public, anon, authenticated;

-- 5. Align asset_price_history symbol check constraint
alter table public.asset_price_history drop constraint if exists asset_price_history_symbol_check;
alter table public.asset_price_history add constraint asset_price_history_symbol_check
  check (symbol ~ '^(IDX|US|CRYPTO|GOLD):(?=.{1,15}$)[A-Z0-9]+(\.[A-Z0-9]+)*$');

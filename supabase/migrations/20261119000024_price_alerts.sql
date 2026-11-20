-- Live Market v2 Fase 5: alert harga per aset dan riwayat harga harian (penggerak portofolio di Weekly Replay).

-- ---------------------------------------------------------------- riwayat harga harian (data publik)
-- Satu baris per kunci per hari (UTC), ditimpa sepanjang hari oleh asset-prices-sync = harga terakhir hari itu.
create table public.asset_price_history (
  symbol text not null check (symbol ~ '^(IDX|US|CRYPTO|GOLD):[A-Z0-9.]{1,15}$'),
  day date not null,
  price numeric(28, 10) not null check (price > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  primary key (symbol, day)
);
alter table public.asset_price_history enable row level security;
revoke all on public.asset_price_history from anon, authenticated;
grant select on public.asset_price_history to authenticated;
create policy asset_price_history_select on public.asset_price_history for select to authenticated using (true);

-- ---------------------------------------------------------------- alert harga
-- Satu alert per aset: beri tahu sekali saat harga bergerak >= pct persen (naik atau turun) dari base_price.
-- base_price SELALU diisi server dari asset_prices (bukan klien), dan diisi ulang saat alert dipasang lagi.
create table public.asset_price_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  asset_id uuid not null unique references public.assets (id) on delete cascade,
  -- 0,1% supaya bisa diuji dengan ambang kecil; 50% batas atas yang masih masuk akal untuk satu jam.
  pct numeric(5, 2) not null check (pct >= 0.1 and pct <= 50),
  base_price numeric(28, 10) not null check (base_price > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  triggered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index asset_price_alerts_open_idx on public.asset_price_alerts (asset_id) where triggered_at is null;

create function public.asset_price_alerts_prepare() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_price numeric;
  v_currency text;
begin
  if not exists (select 1 from public.assets a where a.id = new.asset_id and a.user_id = new.user_id) then
    raise exception 'alert_not_owner' using errcode = 'P0001';
  end if;
  select p.price, p.currency into v_price, v_currency
  from public.assets a join public.asset_prices p on p.symbol = a.price_key
  where a.id = new.asset_id;
  if v_price is null then
    raise exception 'alert_no_price' using errcode = 'P0001';
  end if;
  new.base_price := v_price;
  new.currency := v_currency;
  new.triggered_at := null;
  new.updated_at := now();
  return new;
end $$;
-- Insert dan "pasang lagi" (update pct) sama-sama mengambil harga terbaru sebagai patokan. Hanya UPDATE OF pct:
-- price_alerts() yang mengisi triggered_at tidak boleh ikut mereset alert.
create trigger asset_price_alerts_prepare before insert or update of pct on public.asset_price_alerts
  for each row execute function public.asset_price_alerts_prepare();
revoke execute on function public.asset_price_alerts_prepare() from public, anon, authenticated;

alter table public.asset_price_alerts enable row level security;
revoke all on public.asset_price_alerts from anon, authenticated;
grant select, delete on public.asset_price_alerts to authenticated;
-- base_price, currency, triggered_at tidak bisa ditulis klien (diisi trigger / fungsi cron).
grant insert (id, asset_id, pct) on public.asset_price_alerts to authenticated;
grant update (pct) on public.asset_price_alerts to authenticated;
create policy asset_price_alerts_all on public.asset_price_alerts for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------- notifikasi alert
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('bill_due', 'budget_alert', 'weekly_recap', 'monthly_recap', 'goal_reached', 'subscription_renewal', 'quota_warning', 'system', 'price_alert'));
alter table public.notifications drop constraint notifications_href_check;
alter table public.notifications add constraint notifications_href_check
  check (href in ('/coach', '/anggaran', '/pengaturan', '/premium', '/rencana/goals', '/rencana/tagihan', '/rencana/utang',
                  '/rencana/langganan', '/rencana/split', '/otomasi', '/otomasi/tinjau', '/aset'));

-- Dipanggil tiap jam oleh Edge Function planning-reminders (cron menit ke-5 yang sudah ada, tanpa cron baru).
-- Alert yang ambangnya terlewati: satu notifikasi in-app, lalu alert ditandai terkirim (tidak berulang tiap jam).
create function public.price_alerts(p_now timestamptz default now()) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_n integer;
begin
  with hit as (
    select al.id, al.user_id, al.pct, al.base_price, al.currency, a.name, a.symbol, p.price,
           round((p.price - al.base_price) / al.base_price * 100, 1) as change_pct
    from public.asset_price_alerts al
    join public.assets a on a.id = al.asset_id
    join public.asset_prices p on p.symbol = a.price_key and p.currency = al.currency
    where al.triggered_at is null
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

-- Fase Aset: kekayaan bersih (docs/arshif-fase-aset-brief.md).
-- Nominal uang = bigint unit terkecil seperti tabel lain; jumlah unit (lembar, koin, gram) = numeric.
-- Harga live disimpan per kunci pasar netral (IDX:BBCA, US:AAPL, CRYPTO:BTC, GOLD:XAU), bukan simbol penyedia,
-- supaya penyedia harga bisa diganti tanpa migrasi data. Pemetaan ke simbol penyedia ada di asset-prices-sync.

-- ---------------------------------------------------------------- aset yang dilacak pengguna
create table public.assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type text not null check (type in ('stock_id', 'stock_us', 'crypto', 'gold', 'property', 'vehicle', 'other')),
  -- Kode aset untuk harga live (BBCA, AAPL, BTC, XAU). NULL untuk aset manual.
  symbol text check (symbol ~ '^[A-Z0-9.]{1,15}$'),
  name text not null check (char_length(name) between 1 and 80),
  -- Lembar (saham), koin (kripto), gram (emas), unit (manual, opsional).
  quantity numeric(28, 10) check (quantity > 0),
  -- Harga beli per unit dan nilai manual memakai mata uang `currency`.
  buy_price bigint check (buy_price >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  buy_date date,
  value_override bigint check (value_override >= 0),
  notes text check (char_length(notes) <= 200),
  price_key text generated always as (
    case type
      when 'stock_id' then 'IDX:' || symbol
      when 'stock_us' then 'US:' || symbol
      when 'crypto' then 'CRYPTO:' || symbol
      when 'gold' then 'GOLD:' || symbol
    end
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Jenis live butuh kode + jumlah; emas selalu XAU (jumlah dalam gram). Jenis manual butuh nilai total, tanpa kode.
  constraint assets_live_fields check (
    (type in ('stock_id', 'stock_us', 'crypto', 'gold') and symbol is not null and quantity is not null and (type <> 'gold' or symbol = 'XAU'))
    or (type in ('property', 'vehicle', 'other') and symbol is null and value_override is not null)
  )
);
create index assets_user_idx on public.assets (user_id, created_at);
create index assets_price_key_idx on public.assets (price_key) where price_key is not null;

create function public.assets_touch() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;
create trigger assets_touch before update on public.assets for each row execute function public.assets_touch();

-- ---------------------------------------------------------------- harga live terakhir (data publik)
-- Satu baris per kunci pasar, ditimpa tiap sync. Harga = per unit dalam satuan utama (bukan minor):
-- saham per lembar, kripto per koin, emas per troy ounce (dikonversi ke gram di aplikasi).
create table public.asset_prices (
  symbol text primary key check (symbol ~ '^(IDX|US|CRYPTO|GOLD):[A-Z0-9.]{1,15}$'),
  price numeric(28, 10) not null check (price > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  source text not null check (char_length(source) between 1 and 40),
  fetched_at timestamptz not null default now()
);

-- Riwayat percobaan sync (status di panel admin). Klien tidak punya akses.
create table public.asset_price_runs (
  id bigint generated always as identity primary key,
  ran_at timestamptz not null default now(),
  trigger text not null check (trigger in ('cron', 'admin')),
  ok boolean not null,
  source text not null check (char_length(source) between 1 and 40),
  symbols integer not null default 0,
  updated integer not null default 0,
  failed text[] not null default '{}',
  error text check (char_length(error) <= 200)
);
create index asset_price_runs_time_idx on public.asset_price_runs (ran_at desc);

-- ---------------------------------------------------------------- snapshot kekayaan bersih (grafik riwayat)
-- Maksimal satu per pengguna per hari: aplikasi menimpa snapshot hari ini dengan angka terbaru.
create table public.net_worth_snapshots (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  total bigint not null,
  assets_total bigint not null,
  liabilities_total bigint not null check (liabilities_total >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  primary key (user_id, date)
);

-- ---------------------------------------------------------------- batas Free/Premium (sistem migrasi 5)
insert into public.plan_limits (plan, key, monthly_limit, "window") values
  ('free', 'assets', 5, 'total'), ('premium', 'assets', null, 'total');

create or replace function public.total_tables(p_key text) returns text[]
language sql immutable as $$
  select case p_key
    when 'accounts' then array['accounts']
    when 'goals' then array['goals']
    when 'billsDebts' then array['bills', 'debts']
    when 'subscriptions' then array['subscriptions']
    when 'assets' then array['assets']
    else array[]::text[] end
$$;

create trigger assets_limit before insert on public.assets for each row execute function public.enforce_total_limit('assets');

-- ---------------------------------------------------------------- RLS + grant kolom
alter table public.assets enable row level security;
alter table public.asset_prices enable row level security;
alter table public.asset_price_runs enable row level security;
alter table public.net_worth_snapshots enable row level security;

revoke all on public.assets, public.asset_prices, public.asset_price_runs, public.net_worth_snapshots from anon, authenticated;

grant select, delete on public.assets to authenticated;
grant insert (id, type, symbol, name, quantity, buy_price, currency, buy_date, value_override, notes) on public.assets to authenticated;
-- Jenis aset tidak bisa diubah setelah dibuat (aturan kolom berbeda per jenis).
grant update (symbol, name, quantity, buy_price, currency, buy_date, value_override, notes) on public.assets to authenticated;
create policy assets_all on public.assets for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Harga = data publik: semua pengguna boleh baca, hanya service (asset-prices-sync) yang menulis.
grant select on public.asset_prices to authenticated;
create policy asset_prices_select on public.asset_prices for select to authenticated using (true);

grant select on public.net_worth_snapshots to authenticated;
grant insert (date, total, assets_total, liabilities_total, currency) on public.net_worth_snapshots to authenticated;
-- Upsert PostgREST menulis ulang semua kolom payload, termasuk `date` (kunci konflik).
grant update (date, total, assets_total, liabilities_total, currency) on public.net_worth_snapshots to authenticated;
create policy net_worth_snapshots_all on public.net_worth_snapshots for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

revoke execute on function public.assets_touch() from public, authenticated, anon;

-- Arshif Fase 2: skema inti.
-- Nominal = bigint unit terkecil mata uangnya (Rp 45.000 = 45000, RM 12.50 = 1250). Tidak ada float.
-- Semua tabel milik pengguna punya user_id + RLS (lihat 20261105000002_rls.sql).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- profiles
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  main_currency text not null default 'IDR' check (main_currency ~ '^[A-Z]{3}$'),
  lang text not null default 'id' check (lang in ('id', 'ms', 'tr', 'en')),
  accent text not null default 'merah' check (accent in ('merah', 'kuningan', 'zamrud', 'biru', 'ungu')),
  theme_mode text not null default 'system' check (theme_mode in ('system', 'dark', 'light')),
  hide_balance boolean not null default false,
  payday smallint not null default 1 check (payday between 1 and 31),
  monthly_income bigint not null default 0 check (monthly_income >= 0),
  split_needs smallint not null default 50 check (split_needs between 0 and 100),
  split_wants smallint not null default 30 check (split_wants between 0 and 100),
  split_savings smallint not null default 20 check (split_savings between 0 and 100),
  notif_prefs jsonb not null default '{"bill_due":true,"budget_alert":true,"weekly_recap":true,"quota_warning":true}',
  active_account_id uuid,
  -- Paket hanya diubah server (webhook pembayaran Fase 3). Kolom ini TIDAK bisa di-update klien (lihat RLS).
  plan text not null default 'free' check (plan in ('free', 'premium')),
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  constraint split_total check (split_needs + split_wants + split_savings = 100)
);

-- Profil dibuat otomatis saat pengguna mendaftar.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- accounts
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  bank text not null check (bank ~ '^[a-z0-9]{1,24}$'),
  name text not null check (char_length(name) between 1 and 60),
  type text not null check (type in ('tabungan', 'cash', 'ewallet', 'kartu_kredit', 'paylater')),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  opening_balance bigint not null default 0,
  -- Diturunkan trigger dari opening_balance + transaksi (FR-ACC-4). Klien tidak menulis kolom ini.
  balance bigint not null default 0,
  last4 text check (last4 ~ '^[0-9]{4}$'),
  created_at timestamptz not null default now()
);
create index accounts_user_idx on public.accounts (user_id, created_at);

alter table public.profiles
  add constraint profiles_active_account_fk foreign key (active_account_id) references public.accounts (id) on delete set null;

-- ---------------------------------------------------------------- transactions
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type text not null check (type in ('income', 'expense', 'transfer')),
  merchant text not null default '' check (char_length(merchant) <= 120),
  category_key text not null check (category_key ~ '^[a-z_]{1,32}$'),
  account_id uuid not null references public.accounts (id) on delete cascade,
  to_account_id uuid references public.accounts (id) on delete cascade,
  date date not null,
  time time not null default '00:00',
  amount bigint not null check (amount > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  -- Jumlah di mata uang akun bila beda dari currency (FR-OCR-5), dengan kurs pada tanggal transaksi.
  account_amount bigint check (account_amount > 0),
  to_amount bigint check (to_amount > 0),
  note text check (char_length(note) <= 500),
  source text not null default 'manual' check (source in ('manual', 'scan', 'voice', 'import', 'smartlog')),
  receipt_path text,
  created_at timestamptz not null default now(),
  constraint transfer_shape check (
    (type = 'transfer' and to_account_id is not null and to_account_id <> account_id)
    or (type <> 'transfer' and to_account_id is null and to_amount is null)
  )
);
create index transactions_user_date_idx on public.transactions (user_id, date desc, time desc, id desc);
create index transactions_account_idx on public.transactions (account_id);
create index transactions_to_account_idx on public.transactions (to_account_id) where to_account_id is not null;

create table public.transaction_items (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  position smallint not null default 0,
  name text not null check (char_length(name) between 1 and 120),
  qty numeric(10, 3) not null default 1 check (qty > 0),
  unit_price bigint not null check (unit_price >= 0),
  total bigint not null check (total >= 0)
);
create index transaction_items_tx_idx on public.transaction_items (transaction_id, position);

-- Transaksi hanya boleh memakai akun milik pengguna yang sama (RLS saja tidak menjamin ini untuk FK).
create function public.transactions_check_owner() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.accounts where id = new.account_id and user_id = new.user_id) then
    raise exception 'account_not_owned' using errcode = '42501';
  end if;
  if new.to_account_id is not null
     and not exists (select 1 from public.accounts where id = new.to_account_id and user_id = new.user_id) then
    raise exception 'account_not_owned' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger transactions_owner before insert or update on public.transactions
  for each row execute function public.transactions_check_owner();

create function public.transaction_items_check_owner() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.transactions where id = new.transaction_id and user_id = new.user_id) then
    raise exception 'transaction_not_owned' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger transaction_items_owner before insert or update on public.transaction_items
  for each row execute function public.transaction_items_check_owner();

-- Saldo akun = saldo awal + efek semua transaksi (FR-ACC-4). Dihitung ulang penuh: sederhana dan selalu benar.
create function public.recompute_balance(p_account uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  -- Penanda sesi: hanya jalur ini yang boleh menulis kolom balance (lihat accounts_opening_balance).
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

create function public.transactions_balance() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    perform public.recompute_balance(new.account_id);
    if new.to_account_id is not null then perform public.recompute_balance(new.to_account_id); end if;
  end if;
  if tg_op in ('UPDATE', 'DELETE') then
    perform public.recompute_balance(old.account_id);
    if old.to_account_id is not null then perform public.recompute_balance(old.to_account_id); end if;
  end if;
  return null;
end $$;

create trigger transactions_balance after insert or update or delete on public.transactions
  for each row execute function public.transactions_balance();

create function public.accounts_opening_balance() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.balance := new.opening_balance;
  elsif coalesce(current_setting('arshif.recompute', true), '0') = '1' then
    return new; -- ditulis recompute_balance
  elsif new.opening_balance is distinct from old.opening_balance then
    new.balance := old.balance + (new.opening_balance - old.opening_balance);
  else
    new.balance := old.balance; -- klien tidak bisa menulis saldo langsung
  end if;
  return new;
end $$;

create trigger accounts_balance before insert or update on public.accounts
  for each row execute function public.accounts_opening_balance();

-- ---------------------------------------------------------------- kuota (PRD Bab 7, ditegakkan di server)
create table public.plan_limits (
  plan text not null,
  key text not null,
  monthly_limit integer, -- null = tanpa batas
  primary key (plan, key)
);
insert into public.plan_limits (plan, key, monthly_limit) values
  ('free', 'accounts', 4), ('free', 'scan', 20), ('free', 'automation', 30), ('free', 'importPdf', 1), ('free', 'invoice', 5),
  ('premium', 'accounts', null), ('premium', 'scan', 300), ('premium', 'automation', null), ('premium', 'importPdf', 10), ('premium', 'invoice', null);

create table public.usage_counters (
  user_id uuid not null references auth.users (id) on delete cascade,
  period text not null check (period ~ '^[0-9]{4}-[0-9]{2}$'), -- reset tiap tanggal 1 = periode baru
  key text not null,
  used integer not null default 0 check (used >= 0),
  primary key (user_id, period, key)
);

create function public.current_period() returns text
language sql stable as $$ select to_char(now() at time zone 'utc', 'YYYY-MM') $$;

-- Ambil 1 kuota secara atomik. false = batas tercapai. Hanya dipanggil Edge Functions (service_role).
create function public.quota_try_consume(p_user uuid, p_key text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_limit integer;
  v_used integer;
begin
  select l.monthly_limit into v_limit
  from public.profiles p join public.plan_limits l on l.plan = p.plan and l.key = p_key
  where p.id = p_user;
  if not found then raise exception 'unknown_quota'; end if;

  insert into public.usage_counters (user_id, period, key, used)
  values (p_user, public.current_period(), p_key, 0)
  on conflict do nothing;

  update public.usage_counters set used = used + 1
  where user_id = p_user and period = public.current_period() and key = p_key
    and (v_limit is null or used < v_limit)
  returning used into v_used;
  return v_used is not null;
end $$;

-- Kembalikan kuota bila pekerjaan AI gagal (PRD: pekerjaan gagal tidak memotong kuota).
create function public.quota_refund(p_user uuid, p_key text) returns void
language sql security definer set search_path = '' as $$
  update public.usage_counters set used = greatest(used - 1, 0)
  where user_id = p_user and period = public.current_period() and key = p_key;
$$;

revoke execute on function public.quota_try_consume(uuid, text) from public, anon, authenticated;
revoke execute on function public.quota_refund(uuid, text) from public, anon, authenticated;

-- Pemakaian bulan ini milik pemanggil (untuk kartu Pemakaian di Pengaturan).
create function public.my_usage()
returns table (key text, used integer, monthly_limit integer)
language sql stable security definer set search_path = '' as $$
  select l.key,
         case when l.key = 'accounts' then (select count(*)::int from public.accounts a where a.user_id = auth.uid())
              else coalesce(u.used, 0) end,
         l.monthly_limit
  from public.profiles p
  join public.plan_limits l on l.plan = p.plan
  left join public.usage_counters u on u.user_id = p.id and u.period = public.current_period() and u.key = l.key
  where p.id = auth.uid();
$$;

-- Batas jumlah akun (Free 4) ditegakkan saat insert.
create function public.accounts_enforce_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_limit integer;
begin
  select l.monthly_limit into v_limit
  from public.profiles p join public.plan_limits l on l.plan = p.plan and l.key = 'accounts'
  where p.id = new.user_id;
  if v_limit is not null and (select count(*) from public.accounts where user_id = new.user_id) >= v_limit then
    raise exception 'quota_accounts' using errcode = 'P0001', hint = 'Paket Free dibatasi 4 akun.';
  end if;
  return new;
end $$;

create trigger accounts_limit before insert on public.accounts
  for each row execute function public.accounts_enforce_limit();

-- ---------------------------------------------------------------- kurs (FR-FX)
-- per_usd = jumlah unit mata uang `code` untuk 1 USD pada `rate_date` (sumber: Frankfurter/ECB, harian).
create table public.fx_rates (
  rate_date date not null,
  code text not null check (code ~ '^[A-Z]{3}$'),
  per_usd numeric(24, 10) not null check (per_usd > 0),
  source text not null default 'frankfurter',
  fetched_at timestamptz not null default now(),
  primary key (rate_date, code)
);

-- ---------------------------------------------------------------- notifikasi in-app
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (type in ('bill_due', 'budget_alert', 'weekly_recap', 'monthly_recap', 'goal_reached', 'subscription_renewal', 'quota_warning', 'system')),
  title_key text not null,
  message_key text not null,
  vars jsonb not null default '{}',
  href text check (href in ('/coach', '/anggaran', '/pengaturan')),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

-- ---------------------------------------------------------------- log pekerjaan AI (rate limit + admin)
create table public.ai_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('scan', 'voice', 'import', 'coach')),
  status text not null check (status in ('ok', 'failed', 'limited')),
  latency_ms integer,
  error text,
  created_at timestamptz not null default now()
);
create index ai_jobs_user_time_idx on public.ai_jobs (user_id, created_at desc);

-- Narasi Coach disimpan per minggu + bahasa supaya AI tidak dipanggil ulang tiap buka layar.
create table public.coach_narrations (
  user_id uuid not null references auth.users (id) on delete cascade,
  week_start date not null,
  lang text not null check (lang in ('id', 'ms', 'tr', 'en')),
  score smallint not null,
  narration text not null,
  actions jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, week_start, lang)
);

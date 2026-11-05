-- Arshif Fase 3: monetisasi. Memperluas sistem kuota Fase 2 (plan_limits + usage_counters), tidak menggantinya.
-- Sumber kebenaran entitlement = RevenueCat. profiles.plan / premium_until hanya cermin yang ditulis Edge Functions.

-- ---------------------------------------------------------------- jenis batas
-- month   = kuota bulanan (reset tanggal 1, UTC), dihitung di usage_counters
-- day     = kuota harian (Tanya Coach 20/hari), dihitung di usage_counters dengan periode YYYY-MM-DD
-- total   = jumlah baris aktif (akun, goals, tagihan+utang, langganan), dihitung dari tabelnya
-- feature = fitur Premium saja: 0 = terkunci, null = terbuka
alter table public.plan_limits add column "window" text not null default 'month'
  check ("window" in ('month', 'day', 'total', 'feature'));
update public.plan_limits set "window" = 'total' where key = 'accounts';

insert into public.plan_limits (plan, key, monthly_limit, "window") values
  ('free', 'goals', 3, 'total'), ('premium', 'goals', null, 'total'),
  ('free', 'billsDebts', 3, 'total'), ('premium', 'billsDebts', null, 'total'),
  ('free', 'subscriptions', 5, 'total'), ('premium', 'subscriptions', null, 'total'),
  ('free', 'coachAsk', 0, 'day'), ('premium', 'coachAsk', 20, 'day'),
  ('free', 'coachMonthly', 0, 'feature'), ('premium', 'coachMonthly', null, 'feature'),
  ('free', 'taxFull', 0, 'feature'), ('premium', 'taxFull', null, 'feature'),
  ('free', 'pdfExport', 0, 'feature'), ('premium', 'pdfExport', null, 'feature');

alter table public.usage_counters drop constraint usage_counters_period_check;
alter table public.usage_counters add constraint usage_counters_period_check check (period ~ '^[0-9]{4}-[0-9]{2}(-[0-9]{2})?$');

create function public.period_for(p_window text) returns text
language sql stable as $$
  select case p_window
    when 'day' then to_char(now() at time zone 'utc', 'YYYY-MM-DD')
    else to_char(now() at time zone 'utc', 'YYYY-MM') end
$$;

create function public.limit_window(p_key text) returns text
language sql stable security definer set search_path = '' as $$
  select "window" from public.plan_limits where key = p_key limit 1
$$;

-- Kuota bulanan/harian: ambil 1 secara atomik. false = batas tercapai.
create or replace function public.quota_try_consume(p_user uuid, p_key text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_limit integer;
  v_window text;
  v_period text;
  v_used integer;
begin
  select l.monthly_limit, l."window" into v_limit, v_window
  from public.profiles p join public.plan_limits l on l.plan = p.plan and l.key = p_key
  where p.id = p_user;
  if not found then raise exception 'unknown_quota'; end if;
  if v_window not in ('month', 'day') then raise exception 'not_counter_quota'; end if;
  v_period := public.period_for(v_window);

  insert into public.usage_counters (user_id, period, key, used) values (p_user, v_period, p_key, 0)
  on conflict do nothing;

  update public.usage_counters set used = used + 1
  where user_id = p_user and period = v_period and key = p_key
    and (v_limit is null or used < v_limit)
  returning used into v_used;
  return v_used is not null;
end $$;

create or replace function public.quota_refund(p_user uuid, p_key text) returns void
language sql security definer set search_path = '' as $$
  update public.usage_counters set used = greatest(used - 1, 0)
  where user_id = p_user and key = p_key and period = public.period_for(public.limit_window(p_key));
$$;

-- Jumlah baris milik pengguna di tabel-tabel yang memang ada (fitur yang belum dibangun = 0).
create function public.count_owned(p_user uuid, p_tables text[]) returns integer
language plpgsql stable security definer set search_path = '' as $$
declare
  v_total integer := 0;
  v_n integer;
  t text;
begin
  foreach t in array p_tables loop
    if to_regclass('public.' || t) is not null then
      execute format('select count(*) from public.%I where user_id = $1', t) into v_n using p_user;
      v_total := v_total + v_n;
    end if;
  end loop;
  return v_total;
end $$;

-- Tabel yang dihitung untuk tiap batas 'total'. Tagihan + utang dihitung gabungan.
create function public.total_tables(p_key text) returns text[]
language sql immutable as $$
  select case p_key
    when 'accounts' then array['accounts']
    when 'goals' then array['goals']
    when 'billsDebts' then array['bills', 'debts']
    when 'subscriptions' then array['subscriptions']
    else array[]::text[] end
$$;

-- Trigger generik batas 'total': pasang di tabel fiturnya, mis.
--   create trigger goals_limit before insert on public.goals for each row execute function public.enforce_total_limit('goals');
create function public.enforce_total_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_key text := tg_argv[0];
  v_limit integer;
begin
  -- Kunci per (pengguna, batas): insert paralel tidak bisa sama-sama lolos hitungan.
  perform pg_advisory_xact_lock(hashtext(new.user_id::text || ':' || v_key));
  select l.monthly_limit into v_limit
  from public.profiles p join public.plan_limits l on l.plan = p.plan and l.key = v_key
  where p.id = new.user_id;
  if v_limit is not null and public.count_owned(new.user_id, public.total_tables(v_key)) >= v_limit then
    raise exception 'quota_%', v_key using errcode = 'P0001';
  end if;
  return new;
end $$;

-- Trigger generik kuota bulanan per baris (mis. invoice 5/bulan): pasang di tabel fiturnya.
create function public.enforce_counter_quota() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not public.quota_try_consume(new.user_id, tg_argv[0]) then
    raise exception 'quota_%', tg_argv[0] using errcode = 'P0001';
  end if;
  return new;
end $$;

-- Akun memakai trigger generik yang sama (perilaku Fase 2 tetap: error quota_accounts).
drop trigger accounts_limit on public.accounts;
drop function public.accounts_enforce_limit();
create trigger accounts_limit before insert on public.accounts
  for each row execute function public.enforce_total_limit('accounts');

-- Fitur Premium saja (coachMonthly, taxFull, pdfExport): true = boleh dipakai.
create function public.plan_allows(p_user uuid, p_key text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select l.monthly_limit is null or l.monthly_limit > 0
    from public.profiles p join public.plan_limits l on l.plan = p.plan and l.key = p_key
    where p.id = p_user), false)
$$;

-- Pemakaian pemanggil untuk semua batas (kartu Pemakaian + gerbang PRO di klien).
drop function public.my_usage();
create function public.my_usage()
returns table (key text, used integer, monthly_limit integer, "window" text)
language sql stable security definer set search_path = '' as $$
  select l.key,
         case when l."window" = 'total' then public.count_owned(p.id, public.total_tables(l.key))
              when l."window" = 'feature' then 0
              else coalesce(u.used, 0) end,
         l.monthly_limit,
         l."window"
  from public.profiles p
  join public.plan_limits l on l.plan = p.plan
  left join public.usage_counters u on u.user_id = p.id and u.key = l.key and u.period = public.period_for(l."window")
  where p.id = auth.uid();
$$;

-- ---------------------------------------------------------------- cermin entitlement di profil
alter table public.profiles
  add column premium_until timestamptz,
  add column premium_source text check (premium_source in ('store', 'web', 'manual'));
-- Kolom baru tidak masuk daftar grant update kolom profil, jadi klien tidak bisa menulisnya.

-- ---------------------------------------------------------------- harga (dikunci 2026-11-06)
-- Nominal unit terkecil: IDR tanpa desimal, MYR/USD sen. Tahunan = 10x bulanan.
create table public.prices (
  period text not null check (period in ('monthly', 'yearly')),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  amount bigint not null check (amount > 0),
  provider text not null check (provider in ('xendit', 'paddle')),
  primary key (period, currency)
);
insert into public.prices (period, currency, amount, provider) values
  ('monthly', 'IDR', 25000, 'xendit'), ('yearly', 'IDR', 250000, 'xendit'),
  ('monthly', 'MYR', 690, 'xendit'), ('yearly', 'MYR', 6900, 'xendit'),
  ('monthly', 'USD', 150, 'paddle'), ('yearly', 'USD', 1500, 'paddle');

-- ---------------------------------------------------------------- pesanan web (Xendit + Paddle) dan grant manual
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null check (provider in ('xendit', 'paddle', 'manual')),
  period text not null check (period in ('monthly', 'yearly', 'custom')),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  amount bigint not null check (amount >= 0),
  method text check (method in ('va', 'qris', 'ewallet', 'fpx', 'card')),
  status text not null default 'pending' check (status in ('pending', 'paid', 'expired', 'failed', 'refunded')),
  provider_ref text,
  checkout_url text,
  -- Batas pembayaran di halaman checkout; lewat dari ini pesanan pending jadi expired.
  expires_at timestamptz not null default now() + interval '24 hours',
  paid_at timestamptz,
  -- Hasil grant ke RevenueCat. grant_error terisi bila grant gagal (dicoba ulang oleh cron).
  granted_from timestamptz,
  granted_until timestamptz,
  grant_error text,
  granted_by uuid references auth.users (id) on delete set null,
  days integer check (days between 1 and 3660),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_user_idx on public.orders (user_id, created_at desc);
create unique index orders_provider_ref_idx on public.orders (provider, provider_ref) where provider_ref is not null;
create index orders_status_idx on public.orders (status, created_at desc);

-- Tetapkan masa aktif untuk pesanan lunas, sekali dan atomik. Dasar = yang paling akhir dari: sekarang,
-- akhir Premium di RevenueCat (p_current), dan akhir grant pesanan lain milik pengguna. Lock per pengguna:
-- dua pembayaran bersamaan mendapat dua periode bertumpuk, bukan satu periode yang sama.
create function public.reserve_grant(p_order uuid, p_current timestamptz) returns table (granted_from timestamptz, granted_until timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  o public.orders;
  v_base timestamptz;
begin
  select * into o from public.orders where id = p_order;
  if not found or o.status <> 'paid' then raise exception 'order_not_paid'; end if;
  perform pg_advisory_xact_lock(hashtext('grant:' || o.user_id::text));
  -- Sudah ditetapkan sebelumnya (percobaan ulang): pakai yang sama.
  select * into o from public.orders where id = p_order;
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

-- Refund: geser mundur pesanan web/manual yang bertumpuk SETELAH pesanan ini sebesar durasinya, lalu kembalikan
-- akhir masa aktif yang tersisa (null = tidak ada grant tersisa). Durasi yang dikembalikan hanya milik pesanan ini.
create function public.refund_shift(p_order uuid) returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare
  o public.orders;
  v_len interval;
  v_end timestamptz;
begin
  select * into o from public.orders where id = p_order;
  if not found then raise exception 'order_not_found'; end if;
  perform pg_advisory_xact_lock(hashtext('grant:' || o.user_id::text));
  if o.granted_from is not null and o.granted_until is not null and o.grant_error is distinct from 'refund_applied' then
    v_len := o.granted_until - o.granted_from;
    update public.orders set granted_from = granted_from - v_len, granted_until = granted_until - v_len, updated_at = now()
    where user_id = o.user_id and status = 'paid' and id <> o.id and granted_from >= o.granted_until;
    update public.orders set grant_error = 'refund_applied', updated_at = now() where id = o.id;
  end if;
  select max(granted_until) into v_end from public.orders
  where user_id = o.user_id and status = 'paid' and id <> o.id and granted_until > now();
  return v_end;
end $$;

-- ---------------------------------------------------------------- idempotensi webhook
create table public.webhook_events (
  provider text not null check (provider in ('revenuecat', 'xendit', 'paddle')),
  event_id text not null check (char_length(event_id) between 1 and 200),
  received_at timestamptz not null default now(),
  primary key (provider, event_id)
);

-- ---------------------------------------------------------------- admin
create table public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid())
$$;

create function public.assert_admin() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not_admin' using errcode = '42501'; end if;
end $$;

create function public.admin_orders(p_status text default null, p_limit integer default 200)
returns table (id uuid, user_id uuid, email text, provider text, period text, currency text, amount bigint, method text,
               status text, created_at timestamptz, paid_at timestamptz, granted_until timestamptz, grant_error text)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.assert_admin();
  return query
    select o.id, o.user_id, u.email::text, o.provider, o.period, o.currency, o.amount, o.method,
           o.status, o.created_at, o.paid_at, o.granted_until, o.grant_error
    from public.orders o join auth.users u on u.id = o.user_id
    where p_status is null or o.status = p_status
    order by o.created_at desc
    limit least(greatest(p_limit, 1), 500);
end $$;

-- Pemakaian AI per jenis: total, gagal, rasio gagal, latensi rata-rata dan p95 (FR-ADM-3).
create function public.admin_ai_usage(p_days integer default 30)
returns table (kind text, total integer, ok integer, failed integer, limited integer, fail_ratio numeric, avg_latency_ms integer, p95_latency_ms integer)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.assert_admin();
  return query
    select j.kind,
           count(*)::int,
           count(*) filter (where j.status = 'ok')::int,
           count(*) filter (where j.status = 'failed')::int,
           count(*) filter (where j.status = 'limited')::int,
           round(count(*) filter (where j.status = 'failed')::numeric / nullif(count(*) filter (where j.status <> 'limited'), 0), 4),
           (avg(j.latency_ms) filter (where j.status <> 'limited'))::int,
           (percentile_cont(0.95) within group (order by j.latency_ms) filter (where j.status <> 'limited'))::int
    from public.ai_jobs j
    where j.created_at >= now() - make_interval(days => least(greatest(p_days, 1), 180))
    group by j.kind
    order by j.kind;
end $$;

create function public.admin_ai_failures(p_limit integer default 50)
returns table (created_at timestamptz, kind text, email text, error text, latency_ms integer)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.assert_admin();
  return query
    select j.created_at, j.kind, u.email::text, j.error, j.latency_ms
    from public.ai_jobs j join auth.users u on u.id = j.user_id
    where j.status = 'failed'
    order by j.created_at desc
    limit least(greatest(p_limit, 1), 200);
end $$;

create function public.admin_find_user(p_email text)
returns table (id uuid, email text, plan text, premium_until timestamptz, premium_source text)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.assert_admin();
  return query
    select u.id, u.email::text, p.plan, p.premium_until, p.premium_source
    from auth.users u join public.profiles p on p.id = u.id
    where lower(u.email) = lower(trim(p_email));
end $$;

-- Untuk Edge Function admin-grant (service_role); pemeriksaan admin dilakukan function itu sendiri.
create function public.admin_find_user_internal(p_email text)
returns table (id uuid)
language sql stable security definer set search_path = '' as $$
  select u.id from auth.users u where lower(u.email) = lower(trim(p_email)) limit 1
$$;

-- ---------------------------------------------------------------- notifikasi Premium aktif
alter table public.notifications drop constraint notifications_href_check;
alter table public.notifications add constraint notifications_href_check check (href in ('/coach', '/anggaran', '/pengaturan', '/premium'));

-- ---------------------------------------------------------------- RLS + hak akses
alter table public.prices enable row level security;
alter table public.orders enable row level security;
alter table public.webhook_events enable row level security;
alter table public.admin_users enable row level security;
revoke all on public.prices, public.orders, public.webhook_events, public.admin_users from anon, authenticated;

-- Harga publik: halaman Pricing bisa dibuka tanpa login.
grant select on public.prices to anon, authenticated;
create policy prices_select on public.prices for select to anon, authenticated using (true);

-- Pesanan: pengguna hanya membaca miliknya. Semua penulisan lewat Edge Functions.
-- Tanpa granted_by (ID admin) dan grant_error (teks internal).
grant select (id, user_id, provider, period, currency, amount, method, status, provider_ref, checkout_url, expires_at,
              paid_at, granted_until, days, created_at, updated_at) on public.orders to authenticated;
create policy orders_select on public.orders for select to authenticated using (user_id = (select auth.uid()));

-- webhook_events dan admin_users: tanpa akses klien sama sekali.

revoke execute on all functions in schema public from anon;
revoke execute on function public.period_for(text), public.limit_window(text), public.count_owned(uuid, text[]),
  public.total_tables(text), public.enforce_total_limit(), public.enforce_counter_quota(), public.plan_allows(uuid, text),
  public.assert_admin(), public.quota_try_consume(uuid, text), public.quota_refund(uuid, text),
  public.admin_find_user_internal(text), public.reserve_grant(uuid, timestamptz), public.refund_shift(uuid)
  from public, authenticated;
grant execute on function public.my_usage(), public.is_admin(), public.current_period(),
  public.admin_orders(text, integer), public.admin_ai_usage(integer), public.admin_ai_failures(integer), public.admin_find_user(text)
  to authenticated;

alter publication supabase_realtime add table public.orders;

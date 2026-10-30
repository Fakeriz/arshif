-- ============================================================================
-- MIGRASI: Plan Limits (Free vs Premium) + Paywall Server Enforcement
-- ----------------------------------------------------------------------------
-- CARA PAKAI: buka Supabase Dashboard → SQL Editor → New query → paste seluruh
-- file ini → Run. Idempoten: aman dijalankan berulang kali.
--
-- APA YANG DILAKUKAN:
-- 1. Tabel feature_usage_log: catat pemakaian per user per resource per bulan.
-- 2. get_feature_usage(uid, resource): baca pemakaian bulan ini (untuk UI).
-- 3. consume_feature_usage(resource): SECURITY DEFINER, server binds uid dari
--    auth.uid() (argumen uid hanya validasi, tidak dipercaya), fail-closed:
--    lempar error kalau limit tercapai. Admin bypass.
-- 4. RLS aktif: user hanya bisa baca baris miliknya sendiri, tulis hanya
--    lewat fungsi.
--
-- Sumber limit: lib/plan-limits.js (client) HARUS sinkron dengan konstanta
-- max_free/max_premium di sini. check_and_consume_ai_quota (schema.sql) tetap
-- jalan untuk kuota AI dan tidak diubah di file ini.
-- ============================================================================

-- 1. Tabel pemakaian fitur per periode bulanan (UTC)
create table if not exists public.feature_usage_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  resource text not null,
  used_count int not null default 0,
  period_month text not null,             -- format 'YYYY-MM' (UTC)
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, resource, period_month)
);

create index if not exists feature_usage_log_user_idx
  on public.feature_usage_log(user_id, period_month);

-- 2. RLS: user hanya baca baris miliknya; insert/update langsung diblokir
--    (tabel hanya ditulis lewat consume_feature_usage).
alter table public.feature_usage_log enable row level security;

drop policy if exists "feature_usage_log own select" on public.feature_usage_log;
create policy "feature_usage_log own select" on public.feature_usage_log
  for select to authenticated
  using ((select auth.uid()) = user_id);

grant select on public.feature_usage_log to authenticated;

-- 3. Baca pemakaian bulan berjalan (periode 'YYYY-MM' UTC)
drop function if exists public.get_feature_usage(uuid, text);
create or replace function public.get_feature_usage(
  p_uid uuid,
  p_resource text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_period text;
  v_used int := 0;
begin
  -- Server binds: pengguna hanya boleh melihat pemakaiannya sendiri.
  if v_uid is null or p_uid is null or v_uid <> p_uid then
    return jsonb_build_object('used', 0, 'period', null, 'error', 'unauthorized');
  end if;

  -- Periode bulan berjalan (UTC, 'YYYY-MM'); get_feature_usage tidak menerima
  -- periode kustom, hanya bulan sekarang.
  v_period := to_char(now() at time zone 'utc', 'YYYY-MM');

  select used_count into v_used
  from public.feature_usage_log
  where user_id = v_uid
    and resource = p_resource
    and period_month = v_period;

  -- Belum ada baris pemakaian bulan ini = 0, bukan null (kontrak UI).
  return jsonb_build_object('used', coalesce(v_used, 0), 'period', v_period);
end;
$$;

revoke execute on function public.get_feature_usage(uuid, text) from public;
grant execute on function public.get_feature_usage(uuid, text) to authenticated;

-- 4. Enforcement: konsumsi 1 pemakaian, fail-closed kalau limit habis.
--    max_free / max_premium HARUS sama dengan lib/plan-limits.js.
--    Admin (plan_tier = 'admin') bypass. Unknown resource ditolak (fail-closed).
drop function if exists public.consume_feature_usage(text);
create or replace function public.consume_feature_usage(
  p_resource text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_period text := to_char(now() at time zone 'utc', 'YYYY-MM');
  v_plan text;
  v_max_free int;
  v_max_premium int;
  v_limit int;
  v_used int := 0;
begin
  if v_uid is null then
    raise exception 'Pengguna tidak terotentikasi.' using errcode = 'P0001';
  end if;

  -- Limit diketahui hanya untuk resource terdaftar: resource asing ditolak.
  case p_resource
    when 'smart_automation_per_month' then
      v_max_free := 30;  v_max_premium := 500;
    when 'receipt_ocr_per_month' then
      v_max_free := 20;  v_max_premium := 300;
    when 'statement_import_per_month' then
      v_max_free := 1;   v_max_premium := 10;
    when 'invoices_per_month' then
      v_max_free := 5;   v_max_premium := 30;
    else
      raise exception 'Resource tidak dikenal: %', p_resource using errcode = 'P0001';
  end case;

  select plan_tier into v_plan
  from public.profiles
  where id = v_uid;

  -- Admin bypass; premium pakai max_premium; lainnya (termasuk tier asing) free.
  if v_plan = 'admin' then
    return jsonb_build_object('allowed', true, 'used', 0, 'limit', -1, 'is_unlimited', true);
  elsif v_plan = 'premium' then
    v_limit := v_max_premium;
  else
    v_limit := v_max_free;
  end if;

  -- Kunci baris periode ini supaya race condition antar request tidak bocor.
  insert into public.feature_usage_log (user_id, resource, used_count, period_month)
  values (v_uid, p_resource, 0, v_period)
  on conflict (user_id, resource, period_month) do nothing;

  select coalesce(used_count, 0) into v_used
  from public.feature_usage_log
  where user_id = v_uid
    and resource = p_resource
    and period_month = v_period
  for update;

  if v_used >= v_limit then
    raise exception 'Batas % plan Anda sudah habis (%/bulan). Upgrade ke Premium untuk lebih banyak.', p_resource, v_limit
      using errcode = 'P0001';
  end if;

  update public.feature_usage_log
  set used_count = used_count + 1, updated_at = now()
  where user_id = v_uid
    and resource = p_resource
    and period_month = v_period;

  return jsonb_build_object(
    'allowed', true,
    'used', v_used + 1,
    'limit', v_limit,
    'is_unlimited', false
  );
end;
$$;

revoke execute on function public.consume_feature_usage(text) from public;
grant execute on function public.consume_feature_usage(text) to authenticated;

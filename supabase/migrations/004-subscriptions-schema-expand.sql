-- ============================================================================
-- MIGRASI: Tabel Subscriptions — kolom tambahan & RLS policy
-- ============================================================================
-- CARA PAKAI: buka Supabase Dashboard → SQL Editor → New query → paste seluruh
-- file ini → Run. Idempoten: aman dijalankan berulang kali.
--
-- CATATAN: tabel subscriptions sudah ada ( dibuat commit sebelumnya ).
-- Migrasi ini hanya menambahkan kolom baru, memperluas enum, dan memastikan
-- RLS policy "subscriptions own" serta grants lengkap.
-- ============================================================================

-- 1. Perluas enum subscription_cycle agar mendukung siklus 3 bulan & 6 bulan
do $$ begin
  -- Tambah nilai enum jika belum ada
  if not exists (select 1 from pg_enum e join pg_type t on e.enumtypid = t.oid
                 where t.typname = 'subscription_cycle' and e.enumlabel = '3_months') then
    execute 'alter type public.subscription_cycle add value if not exists ''3_months''';
  end if;
  if not exists (select 1 from pg_enum e join pg_type t on e.enumtypid = t.oid
                 where t.typname = 'subscription_cycle' and e.enumlabel = '6_months') then
    execute 'alter type public.subscription_cycle add value if not exists ''6_months''';
  end if;
end $$;

-- 2. Tambah kolom baru (idempoten: skip jika sudah ada)
alter table public.subscriptions add column if not exists title text;
alter table public.subscriptions add column if not exists cycle subscription_cycle default 'monthly'::subscription_cycle;
alter table public.subscriptions add column if not exists due_day integer default 1;
alter table public.subscriptions add column if not exists next_billing_date date;
alter table public.subscriptions add column if not exists category text default 'cat_bills';
alter table public.subscriptions add column if not exists payment_method text default 'card';
alter table public.subscriptions add column if not exists auto_log_expense boolean default false;
alter table public.subscriptions add column if not exists show_as_bill boolean default true;
alter table public.subscriptions add column if not exists cover_url text;
alter table public.subscriptions add column if not exists updated_at timestamptz default now();

-- 3. Sinkronisasi nama: jika title kosong, pakai name sebagai title
update public.subscriptions set title = name where coalesce(title, '') = '';

-- 4. Aktifkan RLS (sudah active di schema.sql sebelumnya, tapi pastikan)
alter table public.subscriptions enable row level security;

-- 5. Grants lengkap
grant select, insert, update, delete on public.subscriptions to authenticated;

-- 6. RLS policy: user only owns their own data
drop policy if exists "subscriptions own" on public.subscriptions;
create policy "subscriptions own" on public.subscriptions for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- 7. Index (jika belum ada)
create index if not exists subscriptions_user_idx on public.subscriptions(user_id);

-- ============================================================================
-- MIGRASI: Impor Rekening Koran (Bank Statement Import)
-- ----------------------------------------------------------------------------
-- CARA PAKAI: buka Supabase Dashboard → SQL Editor → New query → paste seluruh
-- file ini → Run. Idempoten: aman dijalankan berulang kali.
--
-- CATATAN: fitur impor tetap berjalan TANPA migrasi ini (graceful degradation),
-- tetapi tanpa migrasi maka TIDAK ADA: pelacakan batch, tombol undo,
-- dan dedup lintas batch. Sangat disarankan dijalankan.
-- ============================================================================

-- 1. Kolom pelacakan di transactions
alter table public.transactions add column if not exists import_batch_id uuid;
alter table public.transactions add column if not exists fingerprint text;
create index if not exists transactions_import_batch_idx on public.transactions(import_batch_id);
create index if not exists transactions_fingerprint_idx on public.transactions(user_id, fingerprint);

-- 2. Tabel catatan batch impor
create table if not exists public.import_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid references public.accounts(id) on delete set null,
  file_name text,
  row_count int default 0,
  imported_count int default 0,
  skipped_count int default 0,
  date_from timestamptz,
  date_to timestamptz,
  status text default 'completed',
  created_at timestamptz default now()
);
alter table public.import_batches add column if not exists account_id uuid references public.accounts(id) on delete set null;
alter table public.import_batches add column if not exists file_name text;
alter table public.import_batches add column if not exists row_count int default 0;
alter table public.import_batches add column if not exists imported_count int default 0;
alter table public.import_batches add column if not exists skipped_count int default 0;
alter table public.import_batches add column if not exists date_from timestamptz;
alter table public.import_batches add column if not exists date_to timestamptz;
alter table public.import_batches add column if not exists status text default 'completed';
alter table public.import_batches add column if not exists created_at timestamptz default now();
create index if not exists import_batches_user_idx on public.import_batches(user_id, created_at desc);
create index if not exists import_batches_account_idx on public.import_batches(account_id);

-- 3. RLS
alter table public.import_batches enable row level security;
grant select, insert, update, delete on public.import_batches to authenticated;
drop policy if exists "import_batches own" on public.import_batches;
create policy "import_batches own" on public.import_batches for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

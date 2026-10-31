-- ============================================================================
-- ARSHIF, SUPABASE POSTGRESQL COMPLETE CONSOLIDATED PRODUCTION SCHEMA
-- Versi: Mutakhir & Sinkron 100% dengan Arshif PWA Frontend
-- Sifat Skrip: Idempoten, Non-Destruktif, Aman Dijalankan Berulang Kali
-- Cara Pakai: Salin seluruh isi berkas ini dan jalankan di Supabase SQL Editor.
-- ============================================================================

-- 0. EXTENSIONS
create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_net with schema extensions;

-- ============================================================================
-- 1. PROFILES
-- ============================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text default '',
  avatar_url text default '',
  usage_mode text default 'personal',   -- personal | business | both
  language text default 'id',           -- id | ms | en | tr
  home_currency text default 'IDR',     -- IDR | USD | MYR | TRY | SGD | EUR | etc.
  plan_tier text default 'free',        -- free | premium | admin
  role text default 'user',             -- user | admin
  font_size text default 'normal',      -- small | normal | large
  cloud_backup_provider text default 'local', -- local | icloud | google_drive

  -- Kuota & Pemakaian AI
  ai_daily_limit integer default 15,    -- Batas kuota gratis harian
  ai_used_count integer default 0,      -- Jumlah pemakaian AI hari ini
  ai_last_reset timestamptz default now(), -- Waktu terakhir reset kuota harian

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Kolom tambahan idempoten untuk tabel profiles jika sudah ada sebelumnya
alter table public.profiles add column if not exists full_name text default '';
alter table public.profiles add column if not exists avatar_url text default '';
alter table public.profiles add column if not exists usage_mode text default 'personal';
alter table public.profiles add column if not exists language text default 'id';
alter table public.profiles add column if not exists home_currency text default 'IDR';
alter table public.profiles add column if not exists plan_tier text default 'free';
alter table public.profiles add column if not exists role text default 'user';
alter table public.profiles add column if not exists font_size text default 'normal';
alter table public.profiles add column if not exists cloud_backup_provider text default 'local';
alter table public.profiles add column if not exists ai_daily_limit integer default 15;
alter table public.profiles add column if not exists ai_used_count integer default 0;
alter table public.profiles add column if not exists ai_last_reset timestamptz default now();
alter table public.profiles add column if not exists created_at timestamptz default now();
alter table public.profiles add column if not exists updated_at timestamptz default now();

-- ============================================================================
-- 2. ACCOUNTS (Dompet, Bank, E-Wallet, Kartu)
-- ============================================================================
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text default 'savings',          -- enum account_type produksi: savings | cash | ewallet | credit_card
  balance numeric default 0,
  currency text default 'IDR',
  country text default 'ID',            -- ID | MY | TR | GLOBAL
  logo text,
  theme text default 'obsidian',        -- obsidian | glacier | midnight | metal | royal | emerald | sakura | sunset | matrix | batik | kawung
  icon text,
  is_archived boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Kolom tambahan idempoten untuk accounts
alter table public.accounts add column if not exists name text default '';
alter table public.accounts add column if not exists type text default 'savings';
alter table public.accounts add column if not exists balance numeric default 0;
alter table public.accounts add column if not exists currency text default 'IDR';
alter table public.accounts add column if not exists country text default 'ID';
alter table public.accounts add column if not exists logo text;
alter table public.accounts add column if not exists theme text default 'obsidian';
alter table public.accounts add column if not exists icon text;
alter table public.accounts add column if not exists is_archived boolean default false;
alter table public.accounts add column if not exists created_at timestamptz default now();
alter table public.accounts add column if not exists updated_at timestamptz default now();

create index if not exists accounts_user_idx on public.accounts(user_id);

-- ============================================================================
-- 3. GOALS (All-in-One: Savings, Monthly Budgets, Subscriptions, Loans & BNPL)
-- ============================================================================
create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text default 'saving',           -- saving | loan | bnpl | postpaid | subscription | budget
  title text,                           -- Alias judul
  name text not null default '',        -- Nama utama
  currency text default 'IDR',
  category text,                         -- Kategori pengeluaran / tabungan
  subcategory text,                      -- Subkategori
  icon text,
  emoji text default '🎯',
  cover_url text,
  image_url text,

  -- Kolom Tabungan & Pagu Anggaran (Savings & Budgets)
  target_amount numeric default 0,       -- Pagu / Target tabungan / Total pinjaman
  current_amount numeric default 0,      -- Saldo terkini tabungan
  saved_amount numeric default 0,        -- Akumulasi dana terkumpul
  limit_amount numeric default 0,        -- Batas anggaran belanja (budget)
  from_date date,                        -- Tanggal awal periode anggaran
  to_date date,                          -- Tanggal akhir periode anggaran
  repeat text default 'monthly',         -- none | weekly | fortnightly | monthly
  period text default 'monthly',         -- monthly | custom
  starting_balance numeric default 0,    -- Saldo awal saat target dibuat
  deadline date,                         -- Batas waktu pencapaian target
  monthly_target numeric,                -- Target cicilan tabungan per bulan
  monthly_savings_target numeric,        -- Alias target tabungan bulanan

  -- Kolom Pinjaman, Cicilan, BNPL & Tagihan Pasca Bayar (Loans & PayLater)
  debt_type text,                        -- instalment | running_balance | loan | bnpl | postpaid
  debt_mode text,                        -- instalment | postpaid | running
  running_type text,                     -- cc | kta | paylater | flexible
  paid_from text,                        -- bca | mandiri | gopay | ask_every_time
  balance_mode text,                     -- partial | full
  provider_name text,                    -- SPayLater, Kredivo, Akulaku, dsb.
  provider_id text,                      -- spaylater | kredivo | akulaku | cc | kta | custom
  total_loan_amount numeric default 0,   -- Total pokok pinjaman
  total_amount numeric default 0,        -- Alias total pinjaman/limit
  amount numeric default 0,              -- Alias fleksibel amount
  tenure_months integer default 0,       -- Tenor total (bulan)
  tenor_months integer default 0,        -- Alias tenor
  remaining_tenor integer default 0,     -- Sisa tenor berjalan (bulan)
  monthly_installment numeric default 0, -- Cicilan per bulan
  installment_amount numeric default 0,  -- Alias cicilan bulanan
  monthly_payment numeric default 0,     -- Alias pembayaran bulanan
  credit_limit numeric default 0,        -- Batas limit kredit kartu/paylater
  billing_cycle_day integer default 25,  -- Tanggal cetak tagihan (1-31)
  current_bill_amount numeric default 0, -- Tagihan aktif berjalan saat ini
  balance_owing numeric default 0,       -- Sisa utang yang belum dibayar
  already_paid_amount numeric default 0, -- Total nominal yang telah dilunasi
  partial_paid_amount numeric default 0, -- Nominal cicilan parsial berjalan
  first_payment_date date,               -- Tanggal jatuh tempo cicilan pertama
  due_day integer default 10,            -- Tanggal jatuh tempo bulanan (1-31)
  due_day_of_month integer default 10,   -- Alias tanggal jatuh tempo (1-31)
  interest_rate numeric default 0,       -- Suku bunga (% per bulan)
  track_in_bills boolean default false,  -- Apakah otomatis masuk checklist tagihan
  enable_reminder boolean default false, -- Apakah mengaktifkan pengingat
  notes text,                            -- Catatan tambahan
  note text,                             -- Alias catatan
  metadata jsonb default '{}'::jsonb,    -- Data kustom fleksibel

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Tambah kolom-kolom baru ke goals jika tabel sudah ada (Idempoten)
alter table public.goals add column if not exists type text default 'saving';
alter table public.goals add column if not exists title text;
alter table public.goals add column if not exists name text not null default '';
alter table public.goals add column if not exists currency text default 'IDR';
alter table public.goals add column if not exists category text;
alter table public.goals add column if not exists subcategory text;
alter table public.goals add column if not exists icon text;
alter table public.goals add column if not exists emoji text default '🎯';
alter table public.goals add column if not exists cover_url text;
alter table public.goals add column if not exists image_url text;
alter table public.goals add column if not exists target_amount numeric default 0;
alter table public.goals add column if not exists current_amount numeric default 0;
alter table public.goals add column if not exists saved_amount numeric default 0;
alter table public.goals add column if not exists limit_amount numeric default 0;
alter table public.goals add column if not exists from_date date;
alter table public.goals add column if not exists to_date date;
alter table public.goals add column if not exists repeat text default 'monthly';
alter table public.goals add column if not exists period text default 'monthly';
alter table public.goals add column if not exists starting_balance numeric default 0;
alter table public.goals add column if not exists deadline date;
alter table public.goals add column if not exists monthly_target numeric;
alter table public.goals add column if not exists monthly_savings_target numeric;
alter table public.goals add column if not exists debt_type text;
alter table public.goals add column if not exists debt_mode text;
alter table public.goals add column if not exists running_type text;
alter table public.goals add column if not exists paid_from text;
alter table public.goals add column if not exists balance_mode text;
alter table public.goals add column if not exists provider_name text;
alter table public.goals add column if not exists provider_id text;
alter table public.goals add column if not exists total_loan_amount numeric default 0;
alter table public.goals add column if not exists total_amount numeric default 0;
alter table public.goals add column if not exists amount numeric default 0;
alter table public.goals add column if not exists tenure_months integer default 0;
alter table public.goals add column if not exists tenor_months integer default 0;
alter table public.goals add column if not exists remaining_tenor integer default 0;
alter table public.goals add column if not exists monthly_installment numeric default 0;
alter table public.goals add column if not exists installment_amount numeric default 0;
alter table public.goals add column if not exists monthly_payment numeric default 0;
alter table public.goals add column if not exists credit_limit numeric default 0;
alter table public.goals add column if not exists billing_cycle_day integer default 25;
alter table public.goals add column if not exists current_bill_amount numeric default 0;
alter table public.goals add column if not exists balance_owing numeric default 0;
alter table public.goals add column if not exists already_paid_amount numeric default 0;
alter table public.goals add column if not exists partial_paid_amount numeric default 0;
alter table public.goals add column if not exists first_payment_date date;
alter table public.goals add column if not exists due_day integer default 10;
alter table public.goals add column if not exists due_day_of_month integer default 10;
alter table public.goals add column if not exists interest_rate numeric default 0;
alter table public.goals add column if not exists track_in_bills boolean default false;
alter table public.goals add column if not exists enable_reminder boolean default false;
alter table public.goals add column if not exists notes text;
alter table public.goals add column if not exists note text;
alter table public.goals add column if not exists metadata jsonb default '{}'::jsonb;
alter table public.goals add column if not exists created_at timestamptz default now();
alter table public.goals add column if not exists updated_at timestamptz default now();

-- Sinkronisasi fallback nilai due_day & installment_amount
update public.goals
set
  due_day = coalesce(due_day, due_day_of_month, 10),
  due_day_of_month = coalesce(due_day_of_month, due_day, 10),
  installment_amount = coalesce(installment_amount, monthly_installment, monthly_payment, 0.00),
  monthly_installment = coalesce(monthly_installment, installment_amount, monthly_payment, 0.00),
  monthly_payment = coalesce(monthly_payment, installment_amount, monthly_installment, 0.00),
  target_amount = coalesce(target_amount, total_amount, total_loan_amount, limit_amount, 0.00),
  title = coalesce(title, name, '')
where due_day is null or installment_amount is null or title is null;

create index if not exists goals_user_idx on public.goals(user_id);
create index if not exists goals_type_idx on public.goals(user_id, type);

-- ============================================================================
-- 4. BILLS (Checklist Bulanan & Pengingat Tagihan)
-- ============================================================================
create table if not exists public.bills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid references public.accounts(id) on delete set null,
  goal_id uuid references public.goals(id) on delete set null,
  subscription_id uuid,
  name text,
  title text,
  amount numeric not null default 0,
  currency text default 'IDR',
  category text default 'cat_bills',
  due_day integer default 1,             -- Tanggal jatuh tempo (1-31)
  cycle text default 'monthly',          -- monthly | weekly | yearly
  payment_method text default 'card',
  starts_from date,                      -- Mulai berlaku
  ends_after date,                       -- Berakhir setelah tanggal
  reminder boolean default false,        -- Pengingat aktif
  auto_log_expense boolean default false,-- Catat transaksi pengeluaran otomatis
  is_subscription_mirror boolean default false,
  paid_months jsonb default '[]'::jsonb, -- Array bulan ['2026-09'] atau objek {'2026-09': true}
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Kolom tambahan idempoten untuk bills
alter table public.bills add column if not exists account_id uuid references public.accounts(id) on delete set null;
alter table public.bills add column if not exists goal_id uuid references public.goals(id) on delete set null;
alter table public.bills add column if not exists subscription_id uuid;
alter table public.bills add column if not exists name text;
alter table public.bills add column if not exists title text;
alter table public.bills add column if not exists amount numeric not null default 0;
alter table public.bills add column if not exists currency text default 'IDR';
alter table public.bills add column if not exists category text default 'cat_bills';
alter table public.bills add column if not exists due_day integer default 1;
alter table public.bills add column if not exists cycle text default 'monthly';
alter table public.bills add column if not exists payment_method text default 'card';
alter table public.bills add column if not exists starts_from date;
alter table public.bills add column if not exists ends_after date;
alter table public.bills add column if not exists reminder boolean default false;
alter table public.bills add column if not exists auto_log_expense boolean default false;
alter table public.bills add column if not exists is_subscription_mirror boolean default false;
alter table public.bills add column if not exists paid_months jsonb default '[]'::jsonb;
alter table public.bills add column if not exists created_at timestamptz default now();
alter table public.bills add column if not exists updated_at timestamptz default now();

-- Sinkronisasi nama/judul bills
update public.bills
set
  name = coalesce(name, title, 'Tagihan'),
  title = coalesce(title, name, 'Tagihan')
where name is null or title is null;

create index if not exists bills_user_idx on public.bills(user_id);
create index if not exists bills_account_idx on public.bills(account_id);
create index if not exists bills_goal_idx on public.bills(goal_id);

-- ============================================================================
-- 5. TRANSACTIONS (Pencatatan Transaksi & Struk)
-- ============================================================================
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid references public.accounts(id) on delete set null,
  destination_account_id uuid references public.accounts(id) on delete set null,
  to_account_id uuid references public.accounts(id) on delete set null, -- Alias destination_account_id
  bill_id uuid references public.bills(id) on delete set null,
  billing_month text,                    -- Bulan tagihan terkait (format 'YYYY-MM')
  auto_logged boolean default false,     -- Dibuat otomatis oleh sistem/jadwal

  type text not null default 'expense',  -- expense | income | transfer
  amount numeric not null default 0,     -- Nominal dalam mata uang transaksi
  currency text not null default 'IDR',  -- Mata uang transaksi
  home_currency text,                    -- Mata uang dasar pengguna
  home_currency_amount numeric,          -- Konversi nominal ke mata uang dasar
  rate numeric,                          -- Nilai kurs konversi (1 currency = rate home_currency)

  category text,                         -- ID kategori (mis. cat_food, cat_transport)
  category_id uuid,                      -- FK opsional ke tabel categories
  subcategory text,
  payment_method text default 'bank',    -- cash | qr | card | bank | transfer
  note text,
  description text,                      -- Deskripsi tambahan
  merchant text,                         -- Nama toko / merchant
  receipt_number text,                   -- Nomor bukti / invoice
  receipt_url text,                      -- URL file bukti transaksi di storage
  items jsonb default '[]'::jsonb,       -- Rincian produk / metadata split
  tax_deductible boolean default false,  -- Apakah dapat dipotong pajak
  is_tax_deductible boolean default false,-- Alias tax_deductible
  fee numeric default 0,                 -- Biaya admin transaksi

  date timestamptz default now(),
  transaction_date timestamptz default now(),
  created_at timestamptz default now()
);

-- Kolom tambahan idempoten untuk transactions
alter table public.transactions add column if not exists type text default 'expense';
alter table public.transactions add column if not exists amount numeric default 0;
alter table public.transactions add column if not exists currency text default 'IDR';
alter table public.transactions add column if not exists account_id uuid references public.accounts(id) on delete set null;
alter table public.transactions add column if not exists destination_account_id uuid references public.accounts(id) on delete set null;
alter table public.transactions add column if not exists to_account_id uuid references public.accounts(id) on delete set null;
alter table public.transactions add column if not exists bill_id uuid references public.bills(id) on delete set null;
alter table public.transactions add column if not exists billing_month text;
alter table public.transactions add column if not exists auto_logged boolean default false;
alter table public.transactions add column if not exists home_currency text;
alter table public.transactions add column if not exists home_currency_amount numeric;
alter table public.transactions add column if not exists rate numeric;
alter table public.transactions add column if not exists category text;
alter table public.transactions add column if not exists category_id uuid;
alter table public.transactions add column if not exists subcategory text;
alter table public.transactions add column if not exists payment_method text default 'bank';
alter table public.transactions add column if not exists note text;
alter table public.transactions add column if not exists description text;
alter table public.transactions add column if not exists merchant text;
alter table public.transactions add column if not exists receipt_number text;
alter table public.transactions add column if not exists receipt_url text;
alter table public.transactions add column if not exists items jsonb default '[]'::jsonb;
alter table public.transactions add column if not exists tax_deductible boolean default false;
alter table public.transactions add column if not exists is_tax_deductible boolean default false;
alter table public.transactions add column if not exists fee numeric default 0;
alter table public.transactions add column if not exists date timestamptz default now();
alter table public.transactions add column if not exists transaction_date timestamptz default now();
alter table public.transactions add column if not exists created_at timestamptz default now();

-- Metadata transaksi yang sebelumnya hanya hidup di localStorage per-perangkat
-- (arshif_tx_split_*, arshif_tx_storage_*, arshif_receipt_cache_*). Dipindahkan
-- ke kolom agar ikut sinkron lintas device. Default null, aman untuk baris lama.
alter table public.transactions add column if not exists split jsonb default null;
alter table public.transactions add column if not exists storage_provider text default null;
alter table public.transactions add column if not exists receipt_cache jsonb default null;

-- Sinkronisasi alias transactions
update public.transactions
set
  destination_account_id = coalesce(destination_account_id, to_account_id),
  to_account_id = coalesce(to_account_id, destination_account_id),
  is_tax_deductible = coalesce(is_tax_deductible, tax_deductible, false),
  tax_deductible = coalesce(tax_deductible, is_tax_deductible, false),
  description = coalesce(description, note, ''),
  transaction_date = coalesce(transaction_date, date, now()),
  date = coalesce(date, transaction_date, now())
where destination_account_id is null and to_account_id is not null;

-- Partial unique index untuk cegah duplikasi pencatatan tagihan di bulan yang sama
create unique index if not exists idx_unique_bill_entry 
on public.transactions (bill_id, billing_month) 
where bill_id is not null and billing_month is not null;

-- Index performa pencarian transaksi
create index if not exists transactions_user_date_idx on public.transactions(user_id, date desc);
create index if not exists transactions_account_idx on public.transactions(account_id);
create index if not exists transactions_dest_account_idx on public.transactions(destination_account_id);
create index if not exists transactions_bill_idx on public.transactions(bill_id);

-- Kolom pelacakan impor rekening koran (idempoten, wizard tetap jalan tanpanya,
-- hanya fitur batch/undo/dedup-lintas-batch yang nonaktif sampai migrasi dijalankan)
alter table public.transactions add column if not exists import_batch_id uuid;
alter table public.transactions add column if not exists fingerprint text;
create index if not exists transactions_import_batch_idx on public.transactions(import_batch_id);
create index if not exists transactions_fingerprint_idx on public.transactions(user_id, fingerprint);

-- Import batches: catatan tiap sesi impor statement (untuk undo & deteksi overlap)
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
  status text default 'completed',       -- importing | completed | undone
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

-- ============================================================================
-- 6. TABEL PENDUKUNG & UTILITAS
-- ============================================================================

-- A. Custom Categories
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  icon text default 'CircleDashed',
  type text default 'expense',           -- expense | income
  preset boolean default false,
  created_at timestamptz default now()
);
alter table public.categories add column if not exists name text;
alter table public.categories add column if not exists icon text default 'CircleDashed';
alter table public.categories add column if not exists type text default 'expense';
alter table public.categories add column if not exists preset boolean default false;
alter table public.categories add column if not exists created_at timestamptz default now();
create index if not exists categories_user_idx on public.categories(user_id);

-- B. Split Bills
create table if not exists public.split_bills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  total numeric default 0,
  currency text default 'IDR',
  mode text default 'equally',           -- equally | uneven | items
  participants jsonb default '[]'::jsonb,
  items jsonb default '[]'::jsonb,
  transaction_id uuid references public.transactions(id) on delete set null,
  status text default 'open',            -- open | settled
  created_at timestamptz default now()
);
alter table public.split_bills add column if not exists title text default '';
alter table public.split_bills add column if not exists total numeric default 0;
alter table public.split_bills add column if not exists currency text default 'IDR';
alter table public.split_bills add column if not exists mode text default 'equally';
alter table public.split_bills add column if not exists participants jsonb default '[]'::jsonb;
alter table public.split_bills add column if not exists items jsonb default '[]'::jsonb;
alter table public.split_bills add column if not exists transaction_id uuid references public.transactions(id) on delete set null;
alter table public.split_bills add column if not exists status text default 'open';
alter table public.split_bills add column if not exists created_at timestamptz default now();
create index if not exists split_bills_user_idx on public.split_bills(user_id);

-- C. Recurring Transactions
create table if not exists public.recurring_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  amount numeric not null default 0,
  currency text default 'IDR',
  frequency text default 'monthly',      -- daily | weekly | monthly | yearly
  next_due date,
  account_id uuid references public.accounts(id) on delete set null,
  category text default 'other',
  note text,
  is_active boolean default true,
  created_at timestamptz default now()
);
alter table public.recurring_transactions add column if not exists title text default '';
alter table public.recurring_transactions add column if not exists amount numeric default 0;
alter table public.recurring_transactions add column if not exists currency text default 'IDR';
alter table public.recurring_transactions add column if not exists frequency text default 'monthly';
alter table public.recurring_transactions add column if not exists next_due date;
alter table public.recurring_transactions add column if not exists account_id uuid references public.accounts(id) on delete set null;
alter table public.recurring_transactions add column if not exists category text default 'other';
alter table public.recurring_transactions add column if not exists note text;
alter table public.recurring_transactions add column if not exists is_active boolean default true;
alter table public.recurring_transactions add column if not exists created_at timestamptz default now();
create index if not exists recurring_tx_user_idx on public.recurring_transactions(user_id);

-- D. Announcements (Pengumuman Aplikasi)
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Pengumuman',
  content text default '',
  is_active boolean default true,
  priority text default 'normal',        -- normal | urgent | info
  icon text default 'Megaphone',
  expires_at timestamptz,
  created_at timestamptz default now()
);
-- Pastikan seluruh variasi nama kolom ada secara idempoten
alter table public.announcements add column if not exists title text default 'Pengumuman';
alter table public.announcements add column if not exists content text default '';
alter table public.announcements add column if not exists message text default '';
alter table public.announcements add column if not exists description text default '';
alter table public.announcements add column if not exists is_active boolean default true;
alter table public.announcements add column if not exists priority text default 'normal';
alter table public.announcements add column if not exists icon text default 'Megaphone';
alter table public.announcements add column if not exists expires_at timestamptz;
alter table public.announcements add column if not exists created_at timestamptz default now();

-- Lepaskan batasan NOT NULL jika skema lama mewajibkan kolom message / content
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'announcements' and column_name = 'message') then
    alter table public.announcements alter column message drop not null;
    alter table public.announcements alter column message set default '';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'announcements' and column_name = 'content') then
    alter table public.announcements alter column content drop not null;
    alter table public.announcements alter column content set default '';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'announcements' and column_name = 'description') then
    alter table public.announcements alter column description drop not null;
    alter table public.announcements alter column description set default '';
  end if;
end $$;

-- Sinkronisasikan kolom content jika tabel lama memakai message / description
update public.announcements
set
  content = coalesce(nullif(content, ''), message, description, title, ''),
  message = coalesce(nullif(message, ''), content, description, title, ''),
  title = coalesce(nullif(title, ''), 'Pengumuman')
where content is null or content = '' or message is null or message = '';

create index if not exists announcements_active_idx on public.announcements(is_active, created_at desc);

-- E. Support Tickets (Laporan Kendala & Bantuan)
create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  user_email text,
  type text default 'bug',               -- bug | feature | question
  subject text not null default '',
  description text not null default '',
  attachment_url text,
  status text default 'open',            -- open | in_progress | resolved | closed
  created_at timestamptz default now()
);
alter table public.support_tickets add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.support_tickets add column if not exists user_email text;
alter table public.support_tickets add column if not exists type text default 'bug';
alter table public.support_tickets add column if not exists subject text default '';
alter table public.support_tickets add column if not exists description text default '';
alter table public.support_tickets add column if not exists attachment_url text;
alter table public.support_tickets add column if not exists status text default 'open';
alter table public.support_tickets add column if not exists created_at timestamptz default now();
create index if not exists support_tickets_user_idx on public.support_tickets(user_id);

-- F. Budgets (Tabel Kompatibilitas Anggaran Pengeluaran Kategori)
create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null,
  subcategory text,
  limit_amount numeric not null default 0,
  currency text default 'IDR',
  from_date date,
  to_date date,
  period text default 'monthly',
  repeat text default 'monthly',
  month text,
  created_at timestamptz default now()
);
alter table public.budgets add column if not exists category text default 'other';
alter table public.budgets add column if not exists subcategory text;
alter table public.budgets add column if not exists limit_amount numeric default 0;
alter table public.budgets add column if not exists currency text default 'IDR';
alter table public.budgets add column if not exists from_date date;
alter table public.budgets add column if not exists to_date date;
alter table public.budgets add column if not exists period text default 'monthly';
alter table public.budgets add column if not exists repeat text default 'monthly';
alter table public.budgets add column if not exists month text;
alter table public.budgets add column if not exists created_at timestamptz default now();
create index if not exists budgets_user_idx on public.budgets(user_id);

-- G. Transaction Templates (Preset Cepat)
create table if not exists public.transaction_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  amount numeric default 0,
  currency text default 'IDR',
  category text default 'other',
  account_id uuid references public.accounts(id) on delete set null,
  created_at timestamptz default now()
);
alter table public.transaction_templates add column if not exists title text default '';
alter table public.transaction_templates add column if not exists amount numeric default 0;
alter table public.transaction_templates add column if not exists currency text default 'IDR';
alter table public.transaction_templates add column if not exists category text default 'other';
alter table public.transaction_templates add column if not exists account_id uuid references public.accounts(id) on delete set null;
alter table public.transaction_templates add column if not exists created_at timestamptz default now();
create index if not exists templates_user_idx on public.transaction_templates(user_id);

-- H. Debts (Pelacak Utang / Piutang P2P)
create table if not exists public.debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  direction text default 'lent',         -- lent (piutang) | borrowed (utang)
  person text not null,
  amount numeric default 0,
  currency text default 'IDR',
  due_date date,
  note text,
  account_id uuid references public.accounts(id) on delete set null,
  settled boolean default false,
  created_at timestamptz default now()
);
alter table public.debts add column if not exists direction text default 'lent';
alter table public.debts add column if not exists person text default '';
alter table public.debts add column if not exists amount numeric default 0;
alter table public.debts add column if not exists currency text default 'IDR';
alter table public.debts add column if not exists due_date date;
alter table public.debts add column if not exists note text;
alter table public.debts add column if not exists account_id uuid references public.accounts(id) on delete set null;
alter table public.debts add column if not exists settled boolean default false;
alter table public.debts add column if not exists created_at timestamptz default now();
create index if not exists debts_user_idx on public.debts(user_id);

-- H-bis. Subscriptions (Langganan berulang: Netflix, Spotify, iCloud, dll.)
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default '',
  title text,
  amount numeric default 0,
  currency text default 'IDR',
  cycle text default 'monthly',        -- weekly | monthly | 3_months | 6_months | yearly
  due_day integer default 1,           -- Tanggal jatuh tempo bulanan (1-31)
  next_billing_date date,
  category text default 'cat_bills',
  account_id uuid references public.accounts(id) on delete set null,
  payment_method text default 'card',
  auto_log_expense boolean default false,
  show_as_bill boolean default true,   -- Mirror ke checklist tagihan
  cover_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.subscriptions add column if not exists name text default '';
alter table public.subscriptions add column if not exists title text;
alter table public.subscriptions add column if not exists amount numeric default 0;
alter table public.subscriptions add column if not exists currency text default 'IDR';
alter table public.subscriptions add column if not exists cycle text default 'monthly';
alter table public.subscriptions add column if not exists due_day integer default 1;
alter table public.subscriptions add column if not exists next_billing_date date;
alter table public.subscriptions add column if not exists category text default 'cat_bills';
alter table public.subscriptions add column if not exists account_id uuid references public.accounts(id) on delete set null;
alter table public.subscriptions add column if not exists payment_method text default 'card';
alter table public.subscriptions add column if not exists auto_log_expense boolean default false;
alter table public.subscriptions add column if not exists show_as_bill boolean default true;
alter table public.subscriptions add column if not exists cover_url text;
alter table public.subscriptions add column if not exists created_at timestamptz default now();
alter table public.subscriptions add column if not exists updated_at timestamptz default now();
create index if not exists subscriptions_user_idx on public.subscriptions(user_id);

-- I. AI Quotas (Kompatibilitas Tabel Tambahan)
create table if not exists public.ai_quotas (
  user_id uuid primary key references auth.users(id) on delete cascade,
  used_count integer default 0,
  last_reset_date date default current_date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.ai_quotas add column if not exists used_count integer default 0;
alter table public.ai_quotas add column if not exists last_reset_date date default current_date;
alter table public.ai_quotas add column if not exists created_at timestamptz default now();
alter table public.ai_quotas add column if not exists updated_at timestamptz default now();

-- ============================================================================
-- 7. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.goals enable row level security;
alter table public.bills enable row level security;
alter table public.transactions enable row level security;
alter table public.categories enable row level security;
alter table public.split_bills enable row level security;
alter table public.recurring_transactions enable row level security;
alter table public.announcements enable row level security;
alter table public.support_tickets enable row level security;
alter table public.budgets enable row level security;
alter table public.transaction_templates enable row level security;
alter table public.subscriptions enable row level security;
alter table public.debts enable row level security;
alter table public.ai_quotas enable row level security;
alter table public.import_batches enable row level security;

-- Hak Akses Operasi (GRANTS)
grant select, insert, update, delete on public.import_batches to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.accounts to authenticated;
grant select, insert, update, delete on public.goals to authenticated;
grant select, insert, update, delete on public.bills to authenticated;
grant select, insert, update, delete on public.transactions to authenticated;
grant select, insert, update, delete on public.categories to authenticated;
grant select, insert, update, delete on public.split_bills to authenticated;
grant select, insert, update, delete on public.recurring_transactions to authenticated;
grant select, insert, update, delete on public.budgets to authenticated;
grant select, insert, update, delete on public.transaction_templates to authenticated;
grant select, insert, update, delete on public.debts to authenticated;
grant select, insert, update, delete on public.subscriptions to authenticated;
grant select, insert, update, delete on public.ai_quotas to authenticated;
grant select, insert on public.support_tickets to authenticated;
grant select on public.announcements to authenticated, anon;

-- Kebijakan RLS Profiles: id = auth.uid()
-- Client boleh mengubah preferensi profil, tetapi tidak hak akses atau kuota AI.
-- Trigger ini menghindari subquery ke tabel profiles sendiri di dalam policy (recursive RLS).
create or replace function public.prevent_profile_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    if tg_op = 'INSERT' then
      new.plan_tier := 'free';
      new.role := 'user';
      new.ai_daily_limit := 15;
      new.ai_used_count := 0;
      new.ai_last_reset := now();
    elsif new.plan_tier is distinct from old.plan_tier
       or new.role is distinct from old.role
       or new.ai_daily_limit is distinct from old.ai_daily_limit
       or new.ai_used_count is distinct from old.ai_used_count
       or new.ai_last_reset is distinct from old.ai_last_reset then
      raise exception 'Profile privilege fields can only be changed by the server';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_privileges on public.profiles;
create trigger protect_profile_privileges
before insert or update on public.profiles
for each row execute function public.prevent_profile_privilege_escalation();

drop policy if exists "profiles own" on public.profiles;
create policy "profiles own" on public.profiles for all to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- Kebijakan RLS Akun: user_id = auth.uid()
drop policy if exists "accounts own" on public.accounts;
create policy "accounts own" on public.accounts for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Kebijakan RLS Goals: user_id = auth.uid()
drop policy if exists "goals own" on public.goals;
create policy "goals own" on public.goals for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Kebijakan RLS Bills: user_id = auth.uid()
drop policy if exists "bills own" on public.bills;
create policy "bills own" on public.bills for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Kebijakan RLS Transactions: user_id = auth.uid()
drop policy if exists "transactions own" on public.transactions;
create policy "transactions own" on public.transactions for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Kebijakan RLS Categories: user_id = auth.uid()
drop policy if exists "categories own" on public.categories;
create policy "categories own" on public.categories for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Kebijakan RLS Split Bills: user_id = auth.uid()
drop policy if exists "split_bills own" on public.split_bills;
create policy "split_bills own" on public.split_bills for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Kebijakan RLS Recurring: user_id = auth.uid()
drop policy if exists "recurring_transactions own" on public.recurring_transactions;
create policy "recurring_transactions own" on public.recurring_transactions for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Kebijakan RLS Support Tickets: Pengguna dapat membaca tiket miliknya sendiri dan membuat tiket baru
drop policy if exists "support_tickets own read" on public.support_tickets;
create policy "support_tickets own read" on public.support_tickets for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "support_tickets insert" on public.support_tickets;
create policy "support_tickets insert" on public.support_tickets for insert to authenticated
  with check ((select auth.uid()) = user_id);

-- Kebijakan RLS Budgets, Templates, Debts, AI Quotas
drop policy if exists "budgets own" on public.budgets;
create policy "budgets own" on public.budgets for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "transaction_templates own" on public.transaction_templates;
create policy "transaction_templates own" on public.transaction_templates for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "debts own" on public.debts;
create policy "debts own" on public.debts for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Kebijakan RLS Subscriptions: user_id = auth.uid()
drop policy if exists "subscriptions own" on public.subscriptions;
create policy "subscriptions own" on public.subscriptions for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "ai_quotas own" on public.ai_quotas;
create policy "ai_quotas own" on public.ai_quotas for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Kebijakan RLS Import Batches: user_id = auth.uid()
drop policy if exists "import_batches own" on public.import_batches;
create policy "import_batches own" on public.import_batches for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Kebijakan RLS Pengumuman Publik
drop policy if exists "announcements public read" on public.announcements;
create policy "announcements public read" on public.announcements for select
  using (is_active = true);

-- Seed Pengumuman Perkenalan Awal (Hanya jika belum ada judul yang sama)
insert into public.announcements (title, content, message, is_active, priority)
select
  'Selamat Datang di Arshif',
  'Nikmati kemudahan pencatatan multi-mata uang, pelacakan tagihan bulanan, cicilan PayLater, dan target tabungan Anda dalam satu tempat.',
  'Nikmati kemudahan pencatatan multi-mata uang, pelacakan tagihan bulanan, cicilan PayLater, dan target tabungan Anda dalam satu tempat.',
  true,
  'normal'
where not exists (
  select 1 from public.announcements where title = 'Selamat Datang di Arshif'
);

-- ============================================================================
-- 8. STORAGE BUCKETS & OBJECT POLICIES
-- ============================================================================
-- Buat bucket penyimpanan jika belum ada (receipts, avatars, goals_attachments, support_attachments)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('receipts', 'receipts', false, 10485760, null),
  ('avatars', 'avatars', false, 5242880, null),
  ('goals_attachments', 'goals_attachments', false, 10485760, null),
  ('support_attachments', 'support_attachments', false, 10485760, null)
on conflict (id) do update set
  public = false;

-- Storage Policies: private, owner-scoped objects. Path harus diawali auth.uid().
drop policy if exists "Public Read receipts" on storage.objects;
drop policy if exists "Allow upload receipts" on storage.objects;
create policy "Users read own receipts" on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users upload own receipts" on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Public Read avatars" on storage.objects;
drop policy if exists "Allow upload avatars" on storage.objects;
create policy "Users read own avatars" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users upload own avatars" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Public Read goals_attachments" on storage.objects;
drop policy if exists "Allow upload goals_attachments" on storage.objects;
create policy "Users read own goals_attachments" on storage.objects for select to authenticated
  using (bucket_id = 'goals_attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users upload own goals_attachments" on storage.objects for insert to authenticated
  with check (bucket_id = 'goals_attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Public Read support_attachments" on storage.objects;
drop policy if exists "Allow upload support_attachments" on storage.objects;
create policy "Users read own support_attachments" on storage.objects for select to authenticated
  using (bucket_id = 'support_attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users upload own support_attachments" on storage.objects for insert to authenticated
  with check (bucket_id = 'support_attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ============================================================================
-- 9. LOGIKA TERSIMPAN & FUNGSI RPC (AI QUOTA & WEBHOOKS)
-- ============================================================================

-- A. get_ai_quota_status: hanya membaca kuota session aktif
-- Hapus overload lama yang menerima UUID arbitrer sebelum membuat signature aman.
drop function if exists public.get_ai_quota_status(uuid, uuid);
drop function if exists public.check_and_consume_ai_quota(uuid, uuid);
create or replace function public.get_ai_quota_status()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_plan text;
  v_role text;
  v_limit int := 15;
  v_used int := 0;
  v_last_reset timestamptz;
begin
  -- RPC hanya boleh dipakai oleh session terautentikasi miliknya sendiri.
  v_uid := auth.uid();
  if v_uid is null then
    return jsonb_build_object('remaining', 0, 'total', 15, 'is_unlimited', false);
  end if;

  -- Periksa status profil pengguna
  select plan_tier, role, coalesce(ai_daily_limit, 15), coalesce(ai_used_count, 0), ai_last_reset
  into v_plan, v_role, v_limit, v_used, v_last_reset
  from public.profiles
  where id = v_uid;

  -- Akun Premium atau Admin memiliki akses tanpa batas
  if v_plan in ('premium', 'admin') or v_role = 'admin' then
    return jsonb_build_object(
      'remaining', 999,
      'total', 999,
      'is_unlimited', true
    );
  end if;

  -- Reset kuota harian jika hari telah berganti (berdasarkan UTC / waktu sistem)
  if v_last_reset is null or v_last_reset::date < current_date then
    v_used := 0;
    update public.profiles
    set ai_used_count = 0, ai_last_reset = now()
    where id = v_uid;
  end if;

  return jsonb_build_object(
    'remaining', greatest(0, v_limit - v_used),
    'total', v_limit,
    'is_unlimited', false
  );
end;
$$;

-- B. check_and_consume_ai_quota: hanya mengonsumsi kuota session aktif
create or replace function public.check_and_consume_ai_quota()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_plan text;
  v_role text;
  v_limit int := 15;
  v_used int := 0;
  v_last_reset timestamptz;
begin
  v_uid := auth.uid();
  if v_uid is null then
    return jsonb_build_object(
      'allowed', false,
      'remaining', 0,
      'total', 15,
      'is_unlimited', false,
      'error', 'Pengguna tidak terotentikasi.',
      'code', 'UNAUTHORIZED'
    );
  end if;

  select plan_tier, role, coalesce(ai_daily_limit, 15), coalesce(ai_used_count, 0), ai_last_reset
  into v_plan, v_role, v_limit, v_used, v_last_reset
  from public.profiles
  where id = v_uid
  for update; -- Kunci baris untuk mencegah race condition

  -- Akses tak terbatas untuk Premium / Admin
  if v_plan in ('premium', 'admin') or v_role = 'admin' then
    return jsonb_build_object(
      'allowed', true,
      'remaining', 999,
      'total', 999,
      'is_unlimited', true
    );
  end if;

  -- Reset kuota jika hari berganti
  if v_last_reset is null or v_last_reset::date < current_date then
    v_used := 0;
  end if;

  -- Periksa ketersediaan kuota
  if v_used >= v_limit then
    return jsonb_build_object(
      'allowed', false,
      'remaining', 0,
      'total', v_limit,
      'is_unlimited', false,
      'error', 'Kuota AI harian Anda telah habis. Reset setiap pukul 00:00 UTC atau upgrade ke Premium.',
      'code', 'AI_QUOTA_EXCEEDED'
    );
  end if;

  -- Tingkatkan pemakaian kuota AI
  v_used := v_used + 1;
  update public.profiles
  set
    ai_used_count = v_used,
    ai_last_reset = now(),
    updated_at = now()
  where id = v_uid;

  -- Sinkronkan juga ke tabel ai_quotas sebagai fallback cache
  insert into public.ai_quotas (user_id, used_count, last_reset_date, updated_at)
  values (v_uid, v_used, current_date, now())
  on conflict (user_id) do update set
    used_count = excluded.used_count,
    last_reset_date = excluded.last_reset_date,
    updated_at = now();

  return jsonb_build_object(
    'allowed', true,
    'remaining', greatest(0, v_limit - v_used),
    'total', v_limit,
    'is_unlimited', false
  );
end;
$$;

revoke execute on function public.get_ai_quota_status() from public;
grant execute on function public.get_ai_quota_status() to authenticated;
revoke execute on function public.check_and_consume_ai_quota() from public;
grant execute on function public.check_and_consume_ai_quota() to authenticated;

-- D. apply_transaction_balance_delta: update saldo multi-akun ATOMIK & idempoten
-- Menggantikan pola client-side "baca saldo -> tulis saldo" berulang per akun
-- (store.updateAccount) yang rentan race condition antar device: dua device
-- bisa membaca saldo 1000 lalu sama-sama menulis 950, sehingga salah satu
-- transaksi hilang dari saldo.
--
-- Fungsi ini menerima SELURUH delta akun untuk satu transaksi dan menuliskannya
-- dalam SATU statement UPDATE, dikunci dalam satu transaksi Postgres.
-- Idempotensi: p_tx_id dicatat di balance_applications. Pemanggilan ulang
-- dengan tx_id + sign yang sama menjadi no-op (aman untuk retry jaringan).
-- Revert memakai sign = -1 sehingga tetap bisa berlaku setelah apply.
-- Keamanan: SECURITY DEFINER + filter user_id = auth.uid(), jadi pengguna
-- hanya bisa mengubah saldo akun miliknya sendiri.
create table if not exists public.balance_applications (
  tx_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  sign int not null default 1,          -- +1 apply, -1 revert
  applied_at timestamptz default now()
);

create index if not exists balance_applications_user_idx on public.balance_applications(user_id);

-- RLS aktif tanpa policy client: tabel hanya disentuh fungsi SECURITY DEFINER.
alter table public.balance_applications enable row level security;

create or replace function public.apply_transaction_balance_delta(
  p_tx_id uuid,
  p_account_deltas jsonb,
  p_sign int default 1
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_sign int := coalesce(p_sign, 1);
  v_recorded boolean := false;
  v_previous_sign int;
  v_updated int := 0;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'unauthenticated');
  end if;

  if p_tx_id is null
     or p_account_deltas is null
     or jsonb_typeof(p_account_deltas) <> 'array'
     or v_sign = 0 then
    return jsonb_build_object('ok', false, 'error', 'invalid_arguments');
  end if;

  -- Gate idempotensi atomik: hanya salah satu pemanggil bersamaan yang
  -- berhasil memasukkan penanda; yang lain membaca penanda itu dan jadi no-op.
  -- Kalau auth.uid() tidak ada di auth.users (user dihapus di tengah sesi),
  -- kembalikan ok:false alih-alih melempar error 500 dari constraint FK.
  begin
    with ins as (
      insert into public.balance_applications (tx_id, user_id, sign)
      values (p_tx_id, v_uid, v_sign)
      on conflict (tx_id) do nothing
      returning tx_id
    )
    select exists (select 1 from ins) into v_recorded;
  exception
    when foreign_key_violation then
      return jsonb_build_object('ok', false, 'error', 'unknown_user');
  end;

  if not v_recorded then
    select sign into v_previous_sign
    from public.balance_applications
    where tx_id = p_tx_id;

    if v_previous_sign = v_sign then
      -- Sudah diterapkan dengan tanda yang sama: jangan tambah saldo dua kali.
      return jsonb_build_object('ok', true, 'applied', false, 'idempotent', true);
    end if;

    -- Tanda berlawanan (apply -> revert -> apply ulang): segarkan penanda.
    update public.balance_applications
    set sign = v_sign, applied_at = now()
    where tx_id = p_tx_id;
  end if;

  -- Satu statement untuk semua akun: atomik, tidak ada keadaan setengah jalan.
  with deltas as (
    select
      (elem ->> 'account_id')::uuid as account_id,
      (elem ->> 'delta')::numeric as delta
    from jsonb_array_elements(p_account_deltas) as elem
    where elem ->> 'account_id' is not null
      and elem ->> 'delta' is not null
  ),
  applied as (
    update public.accounts a
    set balance = a.balance + (d.delta * v_sign),
        updated_at = now()
    from deltas d
    where a.id = d.account_id
      and a.user_id = v_uid
    returning a.id, a.balance
  )
  select count(*) into v_updated from applied;

  return jsonb_build_object(
    'ok', true,
    'applied', true,
    'updated', v_updated
  );
end;
$$;

revoke execute on function public.apply_transaction_balance_delta(uuid, jsonb, int) from public;
grant execute on function public.apply_transaction_balance_delta(uuid, jsonb, int) to authenticated;

-- C. Trigger Otomatis Profil Baru (handle_new_user)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_full_name text;
  v_avatar text;
begin
  v_full_name := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    ''
  );
  v_avatar := coalesce(
    new.raw_user_meta_data->>'avatar_url',
    new.raw_user_meta_data->>'picture',
    ''
  );

  insert into public.profiles (
    id,
    full_name,
    avatar_url,
    usage_mode,
    language,
    home_currency,
    plan_tier,
    role,
    font_size,
    cloud_backup_provider,
    ai_daily_limit,
    ai_used_count,
    ai_last_reset
  ) values (
    new.id,
    v_full_name,
    v_avatar,
    'personal',
    'id',
    'IDR',
    'free',
    'user',
    'normal',
    'local',
    15,
    0,
    now()
  )
  on conflict (id) do update set
    full_name = case when public.profiles.full_name = '' then excluded.full_name else public.profiles.full_name end,
    avatar_url = case when public.profiles.avatar_url = '' then excluded.avatar_url else public.profiles.avatar_url end;

  return new;
exception when others then
  -- Tangani error agar proses pendaftaran akun tidak terhambat
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- D. Trigger Webhook Telegram Registrasi Pengguna Baru (notify_new_user_to_telegram)
create or replace function public.notify_new_user_to_telegram()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payload jsonb;
  v_webhook_secret text;
begin
  -- Simpan TELEGRAM_WEBHOOK_SECRET di Supabase Vault dengan nama yang sama.
  -- Jika Vault belum tersedia/dikonfigurasi, trigger hanya melewati notifikasi.
  begin
    select decrypted_secret into v_webhook_secret
    from vault.decrypted_secrets
    where name = 'TELEGRAM_WEBHOOK_SECRET'
    limit 1;
  exception when others then
    v_webhook_secret := null;
  end;

  if v_webhook_secret is null or v_webhook_secret = '' then
    return new;
  end if;

  v_payload := jsonb_build_object(
    'record', jsonb_build_object(
      'id', new.id,
      'email', new.email,
      'raw_user_meta_data', new.raw_user_meta_data,
      'created_at', new.created_at
    )
  );

  -- Panggil webhook endpoint secara asinkron menggunakan ekstensi pg_net
  perform net.http_post(
    url := 'https://arshif.biz.id/api/telegram-webhook-user',
    body := v_payload,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-telegram-webhook-secret', coalesce(v_webhook_secret, '')
    )
  );

  return new;
exception when others then
  -- Fail-safe: Jangan batalkan pendaftaran jika pengiriman notifikasi gagal
  return new;
end;
$$;

drop trigger if exists tr_notify_new_user_to_telegram on auth.users;
create trigger tr_notify_new_user_to_telegram
  after insert on auth.users
  for each row execute function public.notify_new_user_to_telegram();

-- ============================================================================
-- 10. RELOAD SCHEMA CACHE
-- ============================================================================
-- Segarkan cache PostgREST agar semua kolom dan endpoint RPC langsung aktif
notify pgrst, 'reload schema';

-- ============================================================
-- Web Push Notifications (ditambahkan 2026-09-27)
-- ============================================================

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz default now(),
  unique(user_id, endpoint)
);

create table if not exists public.notification_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  push_enabled boolean default false,
  bill_enabled boolean default true,
  budget_enabled boolean default true,
  announcement_enabled boolean default true,
  updated_at timestamptz default now()
);

create table if not exists public.push_sent (
  user_id uuid not null references auth.users(id) on delete cascade,
  notification_id text not null,
  sent_at timestamptz default now(),
  primary key (user_id, notification_id)
);

alter table public.push_subscriptions enable row level security;
alter table public.notification_settings enable row level security;
alter table public.push_sent enable row level security;

drop policy if exists "Users manage own push subscriptions" on public.push_subscriptions;
create policy "Users manage own push subscriptions"
  on public.push_subscriptions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage own notification settings" on public.notification_settings;
create policy "Users manage own notification settings"
  on public.notification_settings for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users read own push sent" on public.push_sent;
create policy "Users read own push sent"
  on public.push_sent for select
  using (auth.uid() = user_id);

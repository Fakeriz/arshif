-- Fase 7: enhancements v1 (Bab 13 PRD).
-- Anggaran per periode + payday 1-28 (FR-BDG-5/6), limit kartu + grup limit gabungan + iuran tahunan (FR-ACC-3/6/7/8),
-- "Kurs saya" (FR-FX-4), reimbursement (FR-TRX-4). Nominal = bigint unit terkecil.

-- ---------------------------------------------------------------- payday 1-28 (FR-BDG-6)
-- 29-31 tidak ada di setiap bulan; pengguna lama yang memilihnya digeser ke 28.
update public.profiles set payday = 28 where payday > 28;
alter table public.profiles drop constraint profiles_payday_check;
alter table public.profiles add constraint profiles_payday_check check (payday between 1 and 28);

-- ---------------------------------------------------------------- anggaran per periode (FR-BDG-5)
-- Satu baris per periode budget (period_start = tanggal gajian). Tanpa baris = anggaran dari profil (penghasilan x split).
-- category_limits: {"food": 1500000, ...} dalam mata uang utama.
create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  period_start date not null,
  total bigint not null check (total >= 0),
  category_limits jsonb not null default '{}' check (jsonb_typeof(category_limits) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, period_start)
);

-- Kunci kategori dan nominal dicek: hanya bilangan bulat >= 0 dengan kunci kategori yang sah.
create function public.budgets_check() returns trigger
language plpgsql set search_path = '' as $$
declare
  k text;
  v jsonb;
begin
  for k, v in select * from jsonb_each(new.category_limits) loop
    if k !~ '^[a-z_]{1,32}$' or jsonb_typeof(v) <> 'number' or (v #>> '{}')::numeric < 0
       or (v #>> '{}')::numeric <> trunc((v #>> '{}')::numeric) then
      raise exception 'budget_limit_invalid' using errcode = '22023';
    end if;
  end loop;
  new.updated_at := now();
  return new;
end $$;
create trigger budgets_check before insert or update on public.budgets for each row execute function public.budgets_check();

-- ---------------------------------------------------------------- grup limit gabungan (FR-ACC-6)
create table public.limit_groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  shared_limit bigint not null check (shared_limit > 0),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- akun: limit, grup, iuran tahunan (FR-ACC-3/6/7/8)
alter table public.accounts
  add column credit_limit bigint check (credit_limit > 0),
  add column limit_group_id uuid references public.limit_groups (id) on delete set null,
  add column annual_fee bigint check (annual_fee > 0),
  add column annual_fee_month smallint check (annual_fee_month between 1 and 12),
  add column annual_fee_day smallint check (annual_fee_day between 1 and 31),
  add column fee_waiver_threshold bigint check (fee_waiver_threshold > 0),
  -- Tanggal tagih iuran yang sudah dibayar (riwayat), bukan boolean.
  add column annual_fee_paid date[] not null default '{}',
  add constraint accounts_annual_fee_shape check (
    (annual_fee is null and annual_fee_month is null and annual_fee_day is null and fee_waiver_threshold is null)
    or (annual_fee is not null and annual_fee_month is not null and annual_fee_day is not null)
  );

-- Limit dan grup hanya untuk kartu kredit + paylater; iuran tahunan hanya kartu kredit; grup harus milik sendiri.
create function public.accounts_check_credit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.type not in ('kartu_kredit', 'paylater') then
    new.credit_limit := null;
    new.limit_group_id := null;
  end if;
  if new.type <> 'kartu_kredit' then
    new.annual_fee := null;
    new.annual_fee_month := null;
    new.annual_fee_day := null;
    new.fee_waiver_threshold := null;
  end if;
  if new.limit_group_id is not null
     and not exists (select 1 from public.limit_groups where id = new.limit_group_id and user_id = new.user_id) then
    raise exception 'limit_group_not_owned' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger accounts_credit before insert or update on public.accounts
  for each row execute function public.accounts_check_credit();

-- ---------------------------------------------------------------- "Kurs saya" (FR-FX-4)
-- 1 code = rate base. Dipakai hanya bila tidak ada kurs harian untuk code itu.
create table public.user_rates (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  code text not null check (code ~ '^[A-Z]{3}$'),
  base text not null check (base ~ '^[A-Z]{3}$'),
  rate numeric(24, 10) not null check (rate > 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, code),
  check (code <> base)
);

-- ---------------------------------------------------------------- reimbursement (FR-TRX-4)
-- Pengeluaran yang diganti teman: pending sampai ditautkan ke pemasukan pengganti (reimbursed_by).
-- Pemasukan pengganti tidak dihitung sebagai pemasukan; pengeluarannya tidak dihitung sebagai belanja.
alter table public.transactions
  add column reimburse_status text check (reimburse_status in ('pending', 'reimbursed')),
  add column reimbursed_by uuid references public.transactions (id) on delete set null;
create index transactions_reimbursed_by_idx on public.transactions (reimbursed_by) where reimbursed_by is not null;

-- Status mengikuti tautan: ada pengganti = reimbursed; tautan dihapus (mis. transaksi pengganti dihapus) = pending lagi.
create function public.transactions_reimburse() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.type <> 'expense' then
    new.reimburse_status := null;
    new.reimbursed_by := null;
    return new;
  end if;
  if new.reimbursed_by is not null then
    if new.reimbursed_by = new.id or not exists (
      select 1 from public.transactions where id = new.reimbursed_by and user_id = new.user_id and type = 'income'
    ) then
      raise exception 'reimbursement_link_invalid' using errcode = '42501';
    end if;
    new.reimburse_status := 'reimbursed';
  elsif new.reimburse_status is not null then
    new.reimburse_status := 'pending';
  end if;
  return new;
end $$;
create trigger transactions_reimburse before insert or update on public.transactions
  for each row execute function public.transactions_reimburse();

-- Pemasukan yang menjadi pengganti tidak boleh diubah menjadi jenis lain selama masih ditautkan.
create function public.transactions_guard_reimbursement() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.type = 'income' and new.type <> 'income'
     and exists (select 1 from public.transactions where reimbursed_by = new.id) then
    raise exception 'reimbursement_linked' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger transactions_guard_reimbursement before update of type on public.transactions
  for each row execute function public.transactions_guard_reimbursement();

-- ---------------------------------------------------------------- RLS + grant kolom
alter table public.budgets enable row level security;
alter table public.limit_groups enable row level security;
alter table public.user_rates enable row level security;

revoke all on public.budgets, public.limit_groups, public.user_rates from anon, authenticated;
grant select, delete on public.budgets, public.limit_groups, public.user_rates to authenticated;
grant insert (id, period_start, total, category_limits) on public.budgets to authenticated;
grant update (total, category_limits) on public.budgets to authenticated;
grant insert (id, name, currency, shared_limit) on public.limit_groups to authenticated;
grant update (name, currency, shared_limit) on public.limit_groups to authenticated;
grant insert (code, base, rate) on public.user_rates to authenticated;
grant update (base, rate) on public.user_rates to authenticated;

grant insert (credit_limit, limit_group_id, annual_fee, annual_fee_month, annual_fee_day, fee_waiver_threshold, annual_fee_paid)
  on public.accounts to authenticated;
grant update (credit_limit, limit_group_id, annual_fee, annual_fee_month, annual_fee_day, fee_waiver_threshold, annual_fee_paid)
  on public.accounts to authenticated;
grant insert (reimburse_status, reimbursed_by) on public.transactions to authenticated;
grant update (reimburse_status, reimbursed_by) on public.transactions to authenticated;

create policy budgets_all on public.budgets for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy limit_groups_all on public.limit_groups for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy user_rates_all on public.user_rates for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- user_rates.updated_at diisi server.
create function public.user_rates_touch() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;
create trigger user_rates_touch before insert or update on public.user_rates for each row execute function public.user_rates_touch();

revoke execute on function public.budgets_check(), public.accounts_check_credit(), public.transactions_reimburse(),
  public.transactions_guard_reimbursement(), public.user_rates_touch()
  from public, anon, authenticated;

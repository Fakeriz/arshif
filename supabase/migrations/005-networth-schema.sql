-- ============================================================================
-- MIGRASI: Net Worth Tracker — tabel & snapshot riwayat
-- ============================================================================
-- CARA PAKAI: buka Supabase Dashboard → SQL Editor → New query → paste seluruh
-- file ini → Run. Idempoten: aman dijalankan berulang kali.
--
-- Fitur yang ditambahkan ke NetWorth:
-- 1. public.net_worth_entries  — aset/liabilitas manual (satu record per item)
-- 2. public.net_worth_snapshots — ringkasan bulanan net worth (trend line)
-- ============================================================================

-- 1. Tabel entri aset/liabilitas manual
create table if not exists public.net_worth_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('asset', 'liability')),
  category text not null default 'other',
  name text not null default '',
  amount numeric not null default 0,
  currency text not null default 'IDR',
  linked_account_id uuid references public.accounts(id) on delete set null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.net_worth_entries add column if not exists type text not null check (type in ('asset', 'liability'));
alter table public.net_worth_entries add column if not exists category text not null default 'other';
alter table public.net_worth_entries add column if not exists name text not null default '';
alter table public.net_worth_entries add column if not exists amount numeric not null default 0;
alter table public.net_worth_entries add column if not exists currency text not null default 'IDR';
alter table public.net_worth_entries add column if not exists linked_account_id uuid references public.accounts(id) on delete set null;
alter table public.net_worth_entries add column if not exists note text;
alter table public.net_worth_entries add column if not exists created_at timestamptz not null default now();
alter table public.net_worth_entries add column if not exists updated_at timestamptz not null default now();

create index if not exists nw_entries_user_type_idx on public.net_worth_entries(user_id, type);

-- 2. Tabel snapshot bulanan (diisi otomatis, tidak diedit manual)
create table if not exists public.net_worth_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  month text not null check (length(month) = 7),  -- 'YYYY-MM'
  total_assets numeric not null default 0,
  total_liabilities numeric not null default 0,
  net_worth numeric not null default 0,
  entry_count integer not null default 0,
  currency text not null default 'IDR',
  created_at timestamptz not null default now()
);

alter table public.net_worth_snapshots add column if not exists month text not null check (length(month) = 7);
alter table public.net_worth_snapshots add column if not exists total_assets numeric not null default 0;
alter table public.net_worth_snapshots add column if not exists total_liabilities numeric not null default 0;
alter table public.net_worth_snapshots add column if not exists net_worth numeric not null default 0;
alter table public.net_worth_snapshots add column if not exists entry_count integer not null default 0;
alter table public.net_worth_snapshots add column if not exists currency text not null default 'IDR';
alter table public.net_worth_snapshots add column if not exists created_at timestamptz not null default now();

create unique index if not exists nw_snapshots_user_month_idx on public.net_worth_snapshots(user_id, month);

-- 3. Aktifkan RLS + Grants
alter table public.net_worth_entries enable row level security;
alter table public.net_worth_snapshots enable row level security;

grant select, insert, update, delete on public.net_worth_entries to authenticated;
grant select, insert on public.net_worth_snapshots to authenticated;

-- 4. RLS policies
drop policy if exists "nw_entries own" on public.net_worth_entries;
create policy "nw_entries own" on public.net_worth_entries for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "nw_snapshots own" on public.net_worth_snapshots;
create policy "nw_snapshots own" on public.net_worth_snapshots for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- 5. Trigger: re-snapshot bulanan saat ada perubahan entri
create or replace function public.nw_refresh_snapshot()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid;
  v_curr text;
  v_as numeric;
  v_li numeric;
  v_cnt integer;
  v_month text;
begin
  v_uid := coalesce(new.user_id, old.user_id, auth.uid());
  v_curr := current_setting('app.home_currency', true) on error null;
  v_curr := coalesce(v_curr, 'IDR');

  -- Ambil bulan dari entri terbaru yang diubah
  if tg_op = 'DELETE' then
    v_month := to_char(date_trunc('month', old.created_at), 'YYYY-MM');
  else
    v_month := to_char(date_trunc('month', new.created_at), 'YYYY-MM');
  end if;

  -- Hitung ulang
  select coalesce(sum(amount), 0)::numeric,
         coalesce(count(*)),
         sum(case when type = 'asset' then amount else 0 end)::numeric,
         sum(case when type = 'liability' then amount else 0 end)::numeric
    into v_cnt, v_cnt, v_as, v_li
    from public.net_worth_entries
    where user_id = v_uid
      and to_char(created_at, 'YYYY-MM') = v_month;

  insert into public.net_worth_snapshots (user_id, month, total_assets, total_liabilities, net_worth, entry_count, currency)
  values (v_uid, v_month, v_as, v_li, v_as - v_li, v_cnt, v_curr)
  on conflict (user_id, month) do update set
    total_assets = excluded.total_assets,
    total_liabilities = excluded.total_liabilities,
    net_worth = excluded.net_worth,
    entry_count = excluded.entry_count;

  return coalesce(new, old);
end;
$$;

drop trigger if exists nw_snapshot_trigger on public.net_worth_entries;
create trigger nw_snapshot_trigger
  after insert or update or delete on public.net_worth_entries
  for each row execute function public.nw_refresh_snapshot();

-- 6. Backfill: isi snapshot untuk 12 bulan terakhir (hanya jika belum ada)
-- Catatan: backfill kompleks membutuhkan loop per user, jadi dibuatkan
-- fungsi helper yang bisa dipanggil manual via SQL editor.
create or replace function public.nw_backfill_snapshots()
returns void language plpgsql security definer set search_path = public
as $$
declare
  v_row record;
  v_start date;
  v_end date := date_trunc('month', now());
  v_month text;
  v_as numeric;
  v_li numeric;
  v_cnt integer;
begin
  for v_row in select distinct user_id from public.net_worth_entries loop
    v_start := date_trunc('month', now() - interval '12 months');
    while v_start <= v_end loop
      v_month := to_char(v_start, 'YYYY-MM');
      select
        sum(case when type = 'asset' then amount else 0 end),
        sum(case when type = 'liability' then amount else 0 end),
        count(*)
      into v_as, v_li, v_cnt
      from public.net_worth_entries
      where user_id = v_row.user_id
        and to_char(created_at, 'YYYY-MM') = v_month;
      v_as := coalesce(v_as, 0)::numeric;
      v_li := coalesce(v_li, 0)::numeric;
      insert into public.net_worth_snapshots (user_id, month, total_assets, total_liabilities, net_worth, entry_count, currency)
      values (v_row.user_id, v_month, v_as, v_li, v_as - v_li, v_cnt, 'IDR')
      on conflict (user_id, month) do nothing;
      v_start := v_start + interval '1 month';
    end loop;
  end loop;
end;
$$;

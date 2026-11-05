-- RLS di SEMUA tabel. Aturan dasar: baris milik pengguna = user_id = auth.uid() (PRD Bab 9).
-- Hak kolom membatasi apa yang bisa diubah klien: saldo, paket, dan pemilik baris tidak bisa ditulis.

alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.transactions enable row level security;
alter table public.transaction_items enable row level security;
alter table public.plan_limits enable row level security;
alter table public.usage_counters enable row level security;
alter table public.fx_rates enable row level security;
alter table public.notifications enable row level security;
alter table public.ai_jobs enable row level security;
alter table public.coach_narrations enable row level security;

-- Tabel tanpa akses klien sama sekali kecuali yang di-grant di bawah.
revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from authenticated;

-- ---------------------------------------------------------------- profiles: baca + ubah preferensi sendiri
grant select on public.profiles to authenticated;
grant update (display_name, main_currency, lang, accent, theme_mode, hide_balance, payday, monthly_income,
              split_needs, split_wants, split_savings, notif_prefs, active_account_id, onboarded_at)
  on public.profiles to authenticated;
create policy profiles_select on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- active_account_id harus akun milik sendiri.
create function public.profiles_check_active_account() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.active_account_id is not null
     and not exists (select 1 from public.accounts where id = new.active_account_id and user_id = new.id) then
    raise exception 'account_not_owned' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger profiles_active_account before update on public.profiles
  for each row execute function public.profiles_check_active_account();

-- ---------------------------------------------------------------- accounts
grant select, delete on public.accounts to authenticated;
grant insert (bank, name, type, currency, opening_balance, last4) on public.accounts to authenticated;
grant update (bank, name, type, currency, opening_balance, last4) on public.accounts to authenticated;
create policy accounts_select on public.accounts for select to authenticated using (user_id = (select auth.uid()));
create policy accounts_insert on public.accounts for insert to authenticated with check (user_id = (select auth.uid()));
create policy accounts_update on public.accounts for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy accounts_delete on public.accounts for delete to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------- transactions + items
grant select, delete on public.transactions to authenticated;
grant insert (id, type, merchant, category_key, account_id, to_account_id, date, time, amount, currency,
              account_amount, to_amount, note, source, receipt_path) on public.transactions to authenticated;
grant update (type, merchant, category_key, account_id, to_account_id, date, time, amount, currency,
              account_amount, to_amount, note) on public.transactions to authenticated;
create policy transactions_select on public.transactions for select to authenticated using (user_id = (select auth.uid()));
create policy transactions_insert on public.transactions for insert to authenticated with check (user_id = (select auth.uid()));
create policy transactions_update on public.transactions for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy transactions_delete on public.transactions for delete to authenticated using (user_id = (select auth.uid()));

-- receipt_path harus berada di folder pengguna sendiri di bucket receipts.
alter table public.transactions add constraint receipt_path_shape
  check (receipt_path is null or receipt_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]+$');
create function public.transactions_check_receipt_path() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.receipt_path is not null and split_part(new.receipt_path, '/', 1) <> new.user_id::text then
    raise exception 'receipt_not_owned' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger transactions_receipt before insert or update on public.transactions
  for each row execute function public.transactions_check_receipt_path();

grant select, delete on public.transaction_items to authenticated;
grant insert (transaction_id, position, name, qty, unit_price, total) on public.transaction_items to authenticated;
create policy items_select on public.transaction_items for select to authenticated using (user_id = (select auth.uid()));
create policy items_insert on public.transaction_items for insert to authenticated with check (user_id = (select auth.uid()));
create policy items_delete on public.transaction_items for delete to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------- data referensi: baca saja
grant select on public.plan_limits to authenticated;
create policy plan_limits_select on public.plan_limits for select to authenticated using (true);

grant select on public.fx_rates to authenticated;
create policy fx_rates_select on public.fx_rates for select to authenticated using (true);

-- ---------------------------------------------------------------- kuota: baca milik sendiri, tulis hanya server
grant select on public.usage_counters to authenticated;
create policy usage_select on public.usage_counters for select to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------- notifikasi: baca + tandai dibaca + hapus
grant select, delete on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
create policy notifications_select on public.notifications for select to authenticated using (user_id = (select auth.uid()));
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy notifications_delete on public.notifications for delete to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------- ai_jobs: tidak ada akses klien (hanya server/admin)

-- ---------------------------------------------------------------- coach_narrations: baca milik sendiri
grant select on public.coach_narrations to authenticated;
create policy coach_select on public.coach_narrations for select to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------- RPC
revoke execute on function public.my_usage() from public, anon;
grant execute on function public.my_usage() to authenticated;
revoke execute on function public.current_period() from public, anon;
grant execute on function public.current_period() to authenticated;

-- Fungsi trigger tidak perlu bisa dipanggil langsung.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.transactions_check_owner() from public, anon, authenticated;
revoke execute on function public.transaction_items_check_owner() from public, anon, authenticated;
revoke execute on function public.transactions_balance() from public, anon, authenticated;
revoke execute on function public.accounts_opening_balance() from public, anon, authenticated;
revoke execute on function public.accounts_enforce_limit() from public, anon, authenticated;
revoke execute on function public.profiles_check_active_account() from public, anon, authenticated;
revoke execute on function public.transactions_check_receipt_path() from public, anon, authenticated;

-- Realtime: lonceng notifikasi live (FR-NOTIF-1). RLS tetap berlaku untuk Realtime.
alter publication supabase_realtime add table public.notifications;

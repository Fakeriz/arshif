-- Audit Ponytail 19: saldo dihitung ulang sekali per pernyataan, bukan sekali per baris.
-- Dulu trigger FOR EACH ROW menjalankan recompute_balance (SUM semua transaksi akun) untuk setiap baris:
-- impor 500 baris ke akun dengan 10.000 transaksi = 500 x 10.000 baca dalam satu simpan, dan simpan lain ke akun
-- itu menunggu. Sekarang akun yang tersentuh dikumpulkan dari tabel transisi lalu dihitung ulang masing-masing
-- satu kali. Rumus saldo tetap recompute_balance (sederhana dan selalu benar).
drop trigger transactions_balance on public.transactions;

create function public.transactions_balance_stmt() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_ids uuid[] := '{}';
  v_id uuid;
begin
  -- Tabel transisi hanya ada untuk jenis pernyataan yang sesuai (new_rows: INSERT/UPDATE, old_rows: UPDATE/DELETE).
  if tg_op in ('INSERT', 'UPDATE') then
    v_ids := v_ids || array(select account_id from new_rows union select to_account_id from new_rows where to_account_id is not null);
  end if;
  if tg_op in ('UPDATE', 'DELETE') then
    v_ids := v_ids || array(select account_id from old_rows union select to_account_id from old_rows where to_account_id is not null);
  end if;
  for v_id in select distinct x from unnest(v_ids) as x loop
    perform public.recompute_balance(v_id);
  end loop;
  return null;
end $$;
revoke execute on function public.transactions_balance_stmt() from public, anon, authenticated;

create trigger transactions_balance_ins after insert on public.transactions
  referencing new table as new_rows for each statement execute function public.transactions_balance_stmt();
create trigger transactions_balance_upd after update on public.transactions
  referencing old table as old_rows new table as new_rows for each statement execute function public.transactions_balance_stmt();
create trigger transactions_balance_del after delete on public.transactions
  referencing old table as old_rows for each statement execute function public.transactions_balance_stmt();

-- Fungsi trigger per baris yang lama tidak dipakai lagi.
drop function public.transactions_balance();

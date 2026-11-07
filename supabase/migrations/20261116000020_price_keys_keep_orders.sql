-- Audit Ponytail 7 dan 8.

-- ---------------------------------------------------------------- 7. daftar kunci harga aset tanpa batas baris
-- PostgREST membatasi hasil SELECT ke max_rows (1000): job harga tidak pernah melihat kunci setelah baris ke-1000.
-- Satu nilai array tidak terkena batas baris, dan DISTINCT dikerjakan di database.
create function public.asset_price_keys() returns text[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(distinct price_key order by price_key), '{}') from public.assets where price_key is not null
$$;
revoke execute on function public.asset_price_keys() from public, anon, authenticated;

-- ---------------------------------------------------------------- 8. riwayat pembayaran tetap ada setelah hapus akun
-- Dulu pesanan ikut terhapus (cascade): refund/chargeback setelahnya tidak menemukan pesanan, pendapatan turun
-- mundur. Sekarang pesanan tetap ada tanpa pemilik (user_id null); data pribadi lain tetap terhapus.
alter table public.orders alter column user_id drop not null;
alter table public.orders drop constraint orders_user_id_fkey;
alter table public.orders add constraint orders_user_id_fkey foreign key (user_id) references auth.users (id) on delete set null;

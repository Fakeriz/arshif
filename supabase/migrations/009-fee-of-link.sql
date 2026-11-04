-- 009: tautan baris fee transfer ke transfer induknya.
--
-- Sebelum ini fee disimpan sebagai baris expense terpisah tanpa kolom yang
-- menunjuk balik ke transfernya. Akibatnya menghapus transfer meninggalkan
-- baris fee yatim (uang di ledger tidak lagi punya induk, saldo akun tidak
-- pernah di-revert) dan edit fee tidak bisa menemukan baris yang harus diubah.
-- Idempoten: aman dijalankan berulang.

alter table public.transactions
  add column if not exists fee_of uuid references public.transactions(id) on delete cascade;

create index if not exists transactions_fee_of_idx on public.transactions (fee_of);

comment on column public.transactions.fee_of is 'Baris fee hasil pecahan transfer; menunjuk baris transfer induknya. on delete cascade: fee ikut terhapus bersama transfernya.';

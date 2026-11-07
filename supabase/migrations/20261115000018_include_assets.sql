-- Pilihan pengguna: aset ikut dijumlahkan ke saldo Beranda (bawaan: ya, perilaku Fase Aset).
-- Tab Aset tetap menampilkan kekayaan bersih penuh; yang berubah hanya angka Beranda.
alter table public.profiles add column include_assets boolean not null default true;
grant update (include_assets) on public.profiles to authenticated;

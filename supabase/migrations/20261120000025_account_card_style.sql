-- Tampilan kartu per akun ("Pilih Tampilan Kartu"): id produk dari katalog aplikasi (src/data/cardProducts.ts),
-- mis. 'bca-credit-visa-batman'. NULL = desain bawaan bank. Katalog ada di aplikasi, jadi server hanya memeriksa
-- bentuk id; id yang tidak dikenal aplikasi (katalog berubah) jatuh ke desain bawaan, tidak error.
alter table public.accounts add column card_style text check (card_style ~ '^[a-z0-9-]{1,80}$');

grant insert (card_style) on public.accounts to authenticated;
grant update (card_style) on public.accounts to authenticated;

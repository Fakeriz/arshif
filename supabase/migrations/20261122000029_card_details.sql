-- Detail kartu opsional yang tampil di wajah kartu (gaya "dompet bertumpuk"): nama pemegang dan masa berlaku.
-- NULL = tidak ditampilkan (sakelar mati). 4 digit terakhir tetap di kolom last4.
alter table public.accounts
  add column card_holder text check (char_length(card_holder) between 1 and 40),
  add column card_expiry text check (card_expiry ~ '^(0[1-9]|1[0-2])/[0-9]{2}$');

grant insert (card_holder, card_expiry) on public.accounts to authenticated;
grant update (card_holder, card_expiry) on public.accounts to authenticated;

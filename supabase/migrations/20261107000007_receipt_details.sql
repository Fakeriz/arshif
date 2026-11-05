-- Rincian struk hasil scan (FR-OCR-2): diskon, pajak, lokasi toko, nomor struk, metode bayar.
-- Semua opsional: transaksi manual/voice/import tetap memakai kolom lama saja.

alter table public.transactions
  add column subtotal bigint check (subtotal >= 0),
  add column discount_total bigint check (discount_total >= 0),
  add column tax_total bigint check (tax_total >= 0),
  -- true = harga sudah termasuk pajak (KDV), false = pajak ditambahkan di atas subtotal.
  add column tax_included boolean,
  add column service_amount bigint check (service_amount >= 0),
  -- [{label, itemName, taxRate, amount}] amount positif, unit terkecil.
  add column discounts jsonb check (discounts is null or (jsonb_typeof(discounts) = 'array' and jsonb_array_length(discounts) <= 80)),
  -- [{rate, tax, gross}] per tarif pajak.
  add column tax_lines jsonb check (tax_lines is null or (jsonb_typeof(tax_lines) = 'array' and jsonb_array_length(tax_lines) <= 10)),
  add column receipt_no text check (char_length(receipt_no) <= 60),
  add column payment_method text check (char_length(payment_method) <= 60),
  add column store_address text check (char_length(store_address) <= 240),
  add column store_tax_id text check (char_length(store_tax_id) <= 80);

alter table public.transaction_items
  -- total = harga sebelum diskon; dibayar = total - discount.
  add column discount bigint not null default 0 check (discount >= 0),
  add column tax_rate numeric(5, 2) check (tax_rate between 0 and 100),
  add constraint item_discount_le_total check (discount <= total);

grant insert (subtotal, discount_total, tax_total, tax_included, service_amount, discounts, tax_lines,
              receipt_no, payment_method, store_address, store_tax_id) on public.transactions to authenticated;
grant update (subtotal, discount_total, tax_total, tax_included, service_amount, discounts, tax_lines,
              receipt_no, payment_method, store_address, store_tax_id) on public.transactions to authenticated;
grant insert (discount, tax_rate) on public.transaction_items to authenticated;

-- Kategori pengguna: { custom: [{ key, name, icon, type, bucket, deleted? }], hidden: [kunci bawaan] }.
-- Bentuk isinya divalidasi klien (zod) saat dibaca; di sini hanya tipe dan batas ukuran.
alter table public.profiles
  add column categories jsonb not null default '{"custom": [], "hidden": []}'::jsonb
  check (jsonb_typeof(categories) = 'object' and pg_column_size(categories) <= 16384);
grant update (categories) on public.profiles to authenticated;

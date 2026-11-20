-- Live Market v2 Fase 2: waktu harga menurut penyedia, terpisah dari fetched_at (waktu sync Arshif).
-- IDX tertunda 10-15 menit dan pasar bisa tutup, jadi label "Harga per" harus memakai waktu quote, bukan waktu sync.
-- NULL = penyedia tidak memberi waktu (baris lama); aplikasi lalu menampilkan waktu sync dengan label "Diambil".
alter table public.asset_prices add column quoted_at timestamptz;

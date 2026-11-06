# Arshif — Fase Aset (Kekayaan Bersih)

**Status:** Brief disiapkan 2026-11-06. **BELUM dibangun.** Dibangun setelah rilis v1, saat Ahmad memberi go-ahead. Jangan mulai membangun sebelum ada perintah.

## 1. Tujuan

Mengganti placeholder "Segera hadir" di tab **Aset** (bottom nav: Home, Transaksi, +, Anggaran, Aset) menjadi tampilan **Kekayaan Bersih** yang sebenarnya.

Home sudah menampilkan "Total kekayaan bersih". Tab Aset adalah tampilan detail di balik angka itu: total + rincian aset dan utang + riwayat.

**Framing yang dikunci:** Kekayaan Bersih, BUKAN pelacak investasi / manajer portofolio. Tidak ada fitur trading, tidak ada rekomendasi beli/jual, tidak ada analisis teknikal.

## 2. Keputusan yang sudah dikunci (Ahmad)

- **Harga live investasi DIBUKA LAGI (2026-11-06 ~20:33).** Penolakan 2026-11-05 dicabut.
- **Cakupan live: SEMUA LIVE (2026-11-06 ~20:35).** Bitcoin + saham US + saham Indo + emas, semuanya dapat harga live.
- **Sumber harga: library komunitas `mathieu2301/tradingview-api`** (npm `@mathieuc/tradingview`, v4, TypeScript, ESM). BUKAN API resmi TradingView. Satu sumber untuk keempat jenis aset. Perlu verifikasi: simbol IDX/emas yang tepat + runtime (Deno Edge Function vs service Node terpisah).
- **Fallback manual WAJIB.** Kalau harga live gagal/tidak tersedia, pengguna tetap bisa isi nilai aset secara manual. Override manual selalu tersedia.
- **Widget chart TradingView** (embed, gratis, legal) BOLEH dipakai di halaman detail aset untuk menampilkan grafik — tapi hanya untuk tampilan, bukan untuk mengambil angka harga.
- **Yang tetap ditolak:** offline-first gratis, lifetime purchase. (Harga live sudah dibuka lagi.)

## 3. Cakupan

### Masuk (Fase Aset)

- Ringkasan kekayaan bersih: total + grafik riwayat sederhana (dari snapshot yang tercatat).
- Rincian aset:
  - Rekening (otomatis dari saldo akun yang sudah ada — bank, dompet, tunai).
  - Aset yang dilacak pengguna (saham Indo, saham US, Bitcoin, emas) — dengan jumlah + harga live + nilai saat ini.
  - Aset manual (properti, kendaraan, emas fisik, barang berharga, lainnya) — nilai diisi manual.
- Rincian utang (liabilitas):
  - Utang (dari Planning hub — utang/piutang).
  - Paylater/BNPL (dari Fase 7).
  - Saldo kartu kredit / pinjaman (dari akun).
- Tambah / ubah / hapus aset yang dilacak.
- Nilai aset = jumlah × harga live terbaru (atau nilai manual kalau override / live gagal).
- Kekayaan bersih = (saldo rekening + nilai aset) − (total utang). **Rumus ini HARUS sama dengan yang dipakai Home untuk "Total kekayaan bersih".** Kalau rumus Home berbeda, selaraskan dan laporkan.

### Tidak masuk (ditunda / ditolak)

- Harga live untuk aset di luar keempat jenis di atas (properti, kendaraan, dll tetap manual).
- Trading, rekomendasi beli/jual, analisis teknikal, alert harga.
- KPR tracker (pasca-MVP, terpisah).
- Widget chart TradingView di luar halaman detail aset (opsional, lihat §6).
- Impor portofolio otomatis dari broker/sekuritas.

## 4. Model data

### Tabel `assets` (baru)

- `id` (uuid, pk)
- `user_id` (uuid, fk auth.users)
- `type` — `stock_id` | `stock_us` | `crypto` | `gold` | `property` | `vehicle` | `other`
- `symbol` — kode aset untuk harga live (misal `BBCA`, `AAPL`, `BTC`, `XAU`); NULL untuk aset manual (property/vehicle/other)
- `name` — nama tampil (misal "Bank Central Asia", "Apple Inc.", "Bitcoin", "Emas Antam 10g", "Rumah di Kuching")
- `quantity` — jumlah (lot / lembar / koin / gram / unit); desimal diizinkan
- `buy_price` — harga beli per unit (opsional, untuk menghitung untung/rugi)
- `buy_currency` — mata uang harga beli (IDR / USD / dll)
- `buy_date` — tanggal beli (opsional)
- `value_override` — nilai total manual (opsional; kalau diisi, pakai ini, bukan harga live)
- `notes` — catatan (opsional)
- `created_at`, `updated_at`
- RLS: user hanya bisa akses aset miliknya sendiri.

### Tabel `asset_prices` (baru)

- `symbol` (text, pk) — simbol TradingView (misal `IDX:BBCA`, `NASDAQ:AAPL`, `BINANCE:BTCUSDT`, `OANDA:XAUUSD`)
- `price` (numeric) — harga terakhir per unit
- `currency` (text) — mata uang harga (USD / IDR / dll)
- `fetched_at` (timestamptz) — kapan harga diambil
- Satu baris per simbol (upsert tiap sync). Riwayat harga TIDAK perlu disimpan di tabel ini (riwayat kekayaan bersih dihitung dari snapshot — lihat §7).

### Simbol TradingView (perlu verifikasi saat build)

- Bitcoin: `BINANCE:BTCUSDT` (contoh dari README library)
- Saham US: `NASDAQ:AAPL`, `NYSE:MSFT`, dll (contoh dari README)
- Saham Indo: `IDX:BBCA` (format TradingView untuk BEI — verifikasi)
- Emas: `OANDA:XAUUSD` atau `TVC:GOLD` (verifikasi). Harga per gram IDR = (harga XAU/USD × kurs USD/IDR dari Frankfurter) / 31,1035.

## 5. Sumber harga live

### Library

- `@mathieuc/tradingview` v4 (`npm install @mathieuc/tradingview`).
- Fungsi yang dipakai: `getQuote(symbol)` untuk harga terakhir; `getCandles` hanya kalau dibutuhkan (riwayat untuk grafik detail — opsional).
- **Bukan API resmi.** README menyatakan: "An independent community project, not an official TradingView API" dan "not affiliated with or endorsed by TradingView." Library memakai protokol websocket internal TradingView.
- **Verifikasi saat build:**
  1. Apakah library jalan di Supabase Edge Function (Deno)? Kalau tidak, jalankan sebagai service Node terpisah (misal di arshiflabs) yang sync harga ke Supabase.
  2. Simbol `IDX:` dan emas yang tepat — uji dengan `getQuote` untuk `IDX:BBCA` dan `OANDA:XAUUSD` (atau `TVC:GOLD`).
  3. Perilaku tanpa akun: data bisa delayed/terbatas. Untuk net worth, delay belasan menit dapat diterima — tapi laporkan seberapa delayed hasil ujinya.
- **Kredensial:** Kalau memakai akun TradingView (sessionid + sessionid_sign), simpan sebagai Supabase secret. JANGAN taruh di source code. Jangan minta kredensial lewat chat — Ahmad yang isi via secrets.
- **Terms:** Periksa "data provider's terms and applicable market-data permissions" sesuai catatan README. Jangan klaim ini API resmi TradingView di UI/dokumen.

### Sinkronisasi harga

- Edge Function (atau service Node) `asset-prices-sync` — mengambil harga terbaru untuk semua simbol yang sedang dilacak pengguna (distinct symbol dari tabel `assets` yang punya `symbol`).
- Frekuensi: **tiap jam** (cron). Alasan: harga untuk net worth tidak perlu real-time; tiap jam cukup dan hemat kuota. (Bandingkan: sync kurs Frankfurter 3×/hari.)
- Setiap sync: upsert ke `asset_prices` (price + fetched_at). Kalau satu simbol gagal, JANGAN gagalkan seluruh sync — catat error, lanjut ke simbol lain, dan aset itu menampilkan harga terakhir yang berhasil (dengan label waktu) atau fallback manual.
- Tampilkan di UI kapan harga terakhir diperbarui ("Harga per [waktu]").

### Fallback manual

- Setiap aset bisa punya `value_override` (nilai total manual). Kalau diisi, nilai aset = override (harga live diabaikan untuk aset itu).
- Kalau harga live untuk suatu simbol tidak tersedia (gagal sync / simbol tidak ditemukan / library mati), aset itu menampilkan nilai terakhir yang diketahui (dengan label "harga terakhir [waktu]") ATAU meminta pengguna isi nilai manual. Jangan tampilkan Rp 0 dan jangan crash.
- Kalau library TradingView mati total (protokol berubah), seluruh aset live beralih ke nilai manual terakhir + banner "Harga live tidak tersedia saat ini".

## 6. Layar & Alur

### Tab Aset (`/aset`)

- Header: Total kekayaan bersih (angka besar, sama seperti Home) + perubahan vs periode lalu (kalau ada data riwayat).
- Grafik riwayat kekayaan bersih (sederhana — garis, dari snapshot yang tercatat).
- Seksi "Aset": daftar aset yang dilacak (rekening diringkas sebagai satu baris "Rekening — Rp X" + aset individual). Setiap baris: nama, jumlah, harga per unit (live/manual + label waktu), nilai total, untung/rugi (kalau harga beli diisi).
- Seksi "Utang": total utang + rincian (utang Planning hub, Paylater, kartu kredit).
- Tombol "Tambah aset".
- State: loading, error, empty (belum ada aset yang dilacak — tampilkan ajakan tambah aset).

### Tambah / Ubah aset

- Pilih jenis: Saham Indo / Saham US / Bitcoin / Emas / Properti / Kendaraan / Lainnya.
- Untuk jenis live (saham/BTC/emas): cari simbol (pakai `searchMarkets` dari library atau daftar simbol yang diketik — verifikasi saat build), isi jumlah, harga beli (opsional), tanggal beli (opsional).
- Untuk jenis manual: isi nama + nilai total (wajib) + jumlah (opsional).
- Field "Nilai manual (override)" — kalau diisi, harga live diabaikan untuk aset ini.
- Validasi: jumlah > 0, nilai ≥ 0. Simbol harus ditemukan di TradingView (untuk jenis live) — kalau tidak ditemukan, beri pesan jelas dan tawarkan isi manual.

### Detail aset (`/aset/[id]`)

- Nama, jenis, jumlah, harga beli, harga saat ini (live + waktu update, atau manual), nilai total, untung/rugi (nominal + %).
- Grafik harga (opsional — boleh pakai widget chart TradingView embed di sini, atau `getCandles` dari library; pilih yang lebih sederhana saat build, laporkan).
- Tombol Ubah / Hapus. Hapus butuh konfirmasi.

## 7. Perilaku & Aturan

- **Nilai aset** = `quantity × harga live terbaru` (untuk jenis live tanpa override) ATAU `value_override` (kalau diisi) ATAU `quantity × harga beli` (kalau live belum pernah berhasil — dengan label jelas).
- **Kekayaan bersih** = (saldo semua rekening + total nilai aset) − (total utang). Harus sama dengan rumus Home. Selaraskan kalau berbeda.
- **Snapshot riwayat:** simpan snapshot kekayaan bersih 1×/hari (saat sync harga atau saat aplikasi dibuka) agar grafik riwayat bisa digambar. Tabel `net_worth_snapshots` (user_id, date, total, assets_total, liabilities_total). Jangan simpan lebih dari 1 snapshot per user per hari.
- **Mata uang:** nilai aset dikonversi ke mata uang utama pengguna (IDR) memakai kurs Frankfurter (sudah ada). Harga live dalam USD dikonversi via kurs hari itu. Tampilkan mata uang asal di detail.
- **Tidak ada notifikasi harga** (alert) di fase ini.
- **Tidak ada data yang dikirim ke AI.** Harga dan aset hanya dipakai untuk perhitungan lokal/server — tidak dikirim ke Gemini/Coach.

## 8. Batas Free vs Premium (DIKUNCI Ahmad 2026-11-06 ~20:47)

- **Free:** maks **5 aset** yang dilacak; harga live TETAP tersedia untuk kelima aset itu.
- **Premium:** aset tanpa batas + harga live untuk semua jenis.
- Paywall: kalau Free melewati batas 5 aset, tampilkan badge PRO + paywall (bukan error) — mengikuti pola Fase 4.
- Perbedaan Free vs Premium hanya jumlah aset (5 vs tanpa batas); harga live tersedia untuk keduanya.

## 9. Keamanan & Privasi

- RLS di `assets`, `asset_prices` (baca: semua user boleh baca harga — harga itu data publik; tulis: hanya service), `net_worth_snapshots`.
- Session cookie TradingView (kalau dipakai) HANYA di Supabase secret. Jangan di source, jangan di chat, jangan di log.
- Jangan kirim data aset pengguna ke TradingView selain simbol yang dicari (simbol itu publik).
- Jangan kirim data aset ke AI (Gemini/Coach).

## 10. Pengujian (acceptance)

- `npm run verify` lolos (Jest + typecheck + contrast).
- Tambah aset saham Indo (misal BBCA), saham US (AAPL), Bitcoin, emas — masing-masing menampilkan harga live (atau label jelas kalau live gagal + fallback manual bekerja).
- Nilai total = jumlah × harga; kekayaan bersih di tab Aset SAMA dengan angka di Home.
- Hapus harga live (simulasikan library gagal) → aset menampilkan nilai terakhir/manual + banner, tidak crash, tidak Rp 0.
- Free mencapai batas 5 aset → paywall muncul (bukan error).
- Uji di HP (Expo Go / dev build): tab Aset terbuka, angka konsisten dengan Home.

## 11. Aturan tetap

- Gunakan keenam skill antislop lokal selama build + audit antislop di akhir fase.
- Semua commit pakai author `Fakeriz <fakeriz.id@gmail.com>`.
- **JANGAN push, JANGAN deploy tanpa izin Ahmad yang terpisah.**
- Laporkan hasil fase (file yang berubah + hasil tes) lalu TUNGGU go-ahead Ahmad sebelum lanjut ke fase berikutnya.
- Desain mengikuti sistem Monokrom (`docs/design.md` + `src/theme/tokens.ts`): panel solid, tanpa glow, aksen netral default, warna dark Paralar (bg `#09090B`, kartu `#121214`).

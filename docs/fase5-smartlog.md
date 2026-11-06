# Fase 5: Smart Log (notifikasi bank, review-first)

Status: migrasi 10 dan 11 **live** (2026-11-06, izin pemilik), `npm run test:live` 11/11 termasuk Smart Log. Cron
`smartlog-cleanup` aktif tiap hari 03.20 UTC. Development build Android: EAS dijalankan pemilik.

PRD Bab 4.22, FR-SLOG-1..5. Android saja; iOS (Shortcuts) di luar fase ini.

## Alur

```
Aplikasi bank ──notifikasi──▶ SmartLogListenerService (Kotlin, modules/smart-log)
                               │ hanya package yang ditautkan, hanya saat Smart Log ON
                               ▼
                      antrean SharedPreferences (maks 300, aman saat aplikasi tertutup)
                               │ dikuras sekali pakai: aplikasi aktif, notifikasi masuk saat terbuka, To Review dibuka
                               ▼
              parser di HP (src/lib/smartlog/parser.ts): OTP/PIN/login, gagal/pending, promo DIBUANG (tidak dikirim)
                               │
                               ▼
              RPC smartlog_ingest (SQL, atomik): kuota automation -> tautan kartu -> duplikat -> keputusan
                 ├─ expense + IDR + kartu tertaut (mata uang kartu IDR) + lolos semua cek ─▶ transaksi source=smartlog
                 │                                                     toast "Tercatat" + Batalkan / Ubah
                 └─ selain itu ─▶ smartlog_items status=review ─▶ toast "Perlu dicek" + layar To Review
```

- **Tanggal/jam** = waktu notifikasi diterima (jam lokal HP). **Kartu** = tautan package. Nama bank dinormalisasi
  lewat `src/lib/smartlog/apps.ts` (myBCA dan BCA mobile -> BCA, Livin -> Mandiri, BRImo -> BRI, Gojek -> GoPay, dst.).
- **Parser**: wajib ada kata kunci transaksi, baris/bagian saldo dan limit dibuang ("Saldo ... berkurang Rp" tetap
  transaksi), nominal + mata uang PERTAMA yang muncul. Keraguan parser (jenis tidak jelas, top up, lebih dari satu
  nominal) membuat notifikasi masuk To Review.
- **Alasan To Review** (dari server): `not_expense`, `not_idr`, `no_link`, `account_currency`, `duplicate`, ditambah
  keraguan parser. Ditampilkan per kartu di To Review.
- **Duplikat**: sidik konten sama dalam 2 hari, atau sudah ada transaksi dengan akun, jenis, nominal, dan tanggal sama
  dalam selisih 10 menit (mis. dicatat manual, atau dua aplikasi satu bank). Kirim ulang tangkapan yang sama
  (`capture_key`) idempoten: tidak membuat baris baru dan tidak memotong kuota lagi.
- **Konfirmasi**: transaksi memakai id yang sama dengan baris To Review, jadi konfirmasi ganda tidak bisa membuat
  dua transaksi. "Ubah dulu" membuka form transaksi yang sama dengan Catat manual (kartu, jenis, kategori bisa diganti).
- **Undo** (yang auto-apply): RPC `smartlog_undo` menghapus transaksinya, saldo dihitung ulang trigger.
- **Privasi**: teks notifikasi hanya disimpan selama menunggu dicek, dihapus saat dikonfirmasi/diabaikan; yang
  auto-apply tidak menyimpan teks. Riwayat selesai dihapus cron setelah 60 hari. Keluar akun = antrean HP dikosongkan.

## Kuota (FR-SLOG-5)

Kuota `automation` yang sama dengan Voice Log (Free 30/bulan, Premium tanpa batas), diambil di server
(`quota_try_consume` di dalam RPC) untuk tiap notifikasi yang lolos parser, baik tercatat maupun masuk To Review.
Yang dibuang parser tidak memotong kuota. Kuota habis: tidak diproses, tangkapan **ditahan di HP** (maks 200, umur
maks 35 hari) dan dicoba lagi pada pemrosesan berikutnya; pengguna diberi tahu lewat toast, kartu di layar Automation,
dan satu notifikasi lonceng per bulan (`dedupe_key`).

## Data (migrasi `20261109000010_smartlog.sql`, cron `20261109000011_cron_smartlog.sql`)

| Objek | Isi | Akses klien |
|---|---|---|
| `profiles.smartlog_enabled` | saklar automation | update kolom ini saja |
| `smartlog_links` | package -> akun (milik sendiri, dicek trigger) | select/insert/update akun/delete |
| `smartlog_items` | satu baris per notifikasi yang diproses | select saja; tulis lewat RPC |
| `smartlog_ingest`, `smartlog_confirm`, `smartlog_dismiss`, `smartlog_undo` | RPC security definer | authenticated |

Tidak ada Edge Function baru.

## Layar

- **Pengaturan -> Automation** (`/otomasi`): saklar Smart Log, status (Aktif / Menunggu izin akses notifikasi / Mati),
  aturan auto-apply dan privasi, kuota automation, peringatan tangkapan yang ditahan, entri To Review, daftar 20
  aplikasi (16 bank/dompet PRD) dengan kartu tautannya (sheet pilih kartu / lepas tautan).
  Izin Android diminta saat Smart Log dinyalakan: dialog penjelasan lalu membuka layar "Akses notifikasi".
- **To Review** (`/otomasi/tinjau`): kartu per notifikasi (nominal, merchant, kartu, alasan, isi notifikasi) dengan
  Catat / Ubah dulu / Abaikan; bagian "Tercatat otomatis, 7 hari terakhir" dengan Batalkan / Ubah.
- **Ubah dulu** (`/otomasi/catat`): form transaksi berisi data notifikasi.
- **Transaksi**: banner "N notifikasi bank perlu dicek" bila antrean tidak kosong.
- Toast mendapat tombol aksi (maks 2, tinggi 44 px, tampil 7 detik).

## Development build (WAJIB untuk menguji di HP)

Notification Listener adalah kode native: **tidak jalan di Expo Go**. Module lokal `modules/smart-log` (Expo Modules
API, Kotlin) membawa `AndroidManifest.xml` sendiri berisi `<service>` dengan izin
`BIND_NOTIFICATION_LISTENER_SERVICE`; manifest ini digabung otomatis saat build, jadi tidak perlu config plugin.
`eas.json` profil `development` = APK internal dengan `expo-dev-client`.

Mesin ini (Linux aarch64, tanpa JDK/Android SDK) tidak bisa membangun APK: `aapt2` resmi Google hanya x86_64. Kode
Kotlin belum pernah dikompilasi; build EAS pertama sekaligus menjadi cek kompilasinya.

### Langkah pemilik (sekali)

```bash
npx eas-cli@latest login                 # akun Expo milikmu
npx eas-cli@latest init                  # menautkan proyek, menulis extra.eas.projectId ke app.json (commit perubahannya)
npx eas-cli@latest build --profile development --platform android
```

Build selesai = tautan + QR untuk mengunduh APK.

### Pasang di HP Xiaomi

1. Buka tautan build di HP, unduh APK, izinkan browser "Pasang aplikasi tidak dikenal". HyperOS/MIUI mungkin
   meminta pemindaian keamanan dulu.
2. Android 13+ memblokir izin sensitif untuk APK di luar Play Store. Setelah terpasang: Setelan -> Aplikasi -> Arshif ->
   menu titik tiga -> **Izinkan setelan terbatas**. Tanpa ini sakelar Akses notifikasi tidak bisa diketuk.
3. Supaya listener tidak dimatikan sistem: Setelan -> Aplikasi -> Arshif -> **Mulai otomatis** ON, dan
   **Penghemat baterai** -> Tanpa batasan.
4. Di Arshif: Pengaturan -> Automation -> nyalakan Smart Log -> Buka izin Android -> pilih Arshif -> izinkan. Lalu
   tautkan aplikasi bank ke kartu.

### Menjalankan Metro untuk development build

Development build memuat JavaScript dari Metro, sama seperti Expo Go:

```bash
npx expo start --dev-client             # HP dan komputer di jaringan yang sama
npx expo start --dev-client --tunnel    # bila Metro berjalan di server jarak jauh (seperti mesin ini)
```

Buka aplikasi Arshif (ikon development build, bukan Expo Go), lalu pindai QR dari terminal atau masukkan URL-nya.
Build ulang hanya perlu bila kode native berubah (`modules/`, plugin, atau versi paket native); perubahan JS cukup
lewat Metro.

## Uji

- `src/__tests__/smartlog-parser.test.ts`: 20 contoh notifikasi (satu per package, ditulis dari pola umum tiap
  aplikasi, bukan data pengguna), OTP/login/PIN, gagal/pending/proses, promo/cashback, tanpa kata kunci, tanpa
  nominal, baris saldo/limit, nominal pertama, dua nominal, top up, mata uang asing, sidik duplikat, format angka.
- `scripts/db-test.mjs` (`npm run test:db`): 10 skenario SQL Smart Log (OFF, tautan, auto-apply, idempoten,
  duplikat dua jalur, alasan review, konfirmasi sekali, abaikan + undo, RLS/hak tulis, kuota Free 30 + Premium).
- `scripts/smartlog-flow.mjs` (`npm run test:smartlog`): alur penuh parser + pemrosesan aplikasi + SQL sungguhan
  (PGlite): notifikasi masuk -> tercatat / To Review -> konfirmasi -> tercatat, duplikat, kirim ulang, undo, kuota
  habis -> ditahan -> Premium -> diproses, gagal jaringan, automation OFF.
- `src/__tests__/smartlog-screens.test.tsx`: klik-tembus layar Automation dan To Review (izin, tautan, kuota,
  state memuat/gagal, Catat/Abaikan/Ubah dulu/Batalkan).

Belum diuji: perangkat nyata (listener, izin, MIUI autostart, format notifikasi asli tiap bank). Contoh notifikasi
di tes adalah perkiraan; kumpulkan teks notifikasi asli (tanpa data pribadi) saat uji di HP untuk melengkapi parser.

## Deploy

1. Migrasi 10: **sudah** (diterapkan sendiri lewat Management API, tanpa menjalankan seluruh `deploy-supabase.sh`
   yang juga men-deploy functions dan mengubah Auth). Tidak ada Edge Function baru.
2. Migrasi 11 (cron `smartlog-cleanup`, `20 3 * * *`): **sudah**, dengan cara yang sama.
3. Tautan kartu ditulis lewat update lalu insert, bukan upsert: hak update `smartlog_links` hanya kolom `account_id`
   (ditemukan oleh uji live).

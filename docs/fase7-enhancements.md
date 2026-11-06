# Fase 7: Enhancements v1 (Bab 13 PRD)

Status: migrasi 13 + Edge Functions **live 2026-11-06** (izin pemilik). `npm run test:live` 11/11; fitur migrasi 13 dicek live
sebagai pengguna biasa dalam transaksi yang di-rollback. Build EAS development baru menunggu login Expo pemilik.
Panel Admin web bukan bagian fase ini (Fase 8).

## Ringkasan

| Item | FR | Tempat di aplikasi |
|---|---|---|
| Budget pace + aman dibelanjakan | FR-BDG-5 | Tab Anggaran (kartu "Aman dibelanjakan"), Home (ringkasan anggaran) |
| Salin bulan lalu + saran rata-rata 3 bulan | FR-BDG-5 | Tab Anggaran -> kartu "Anggaran periode ini" |
| Payday (1-28) | FR-BDG-6 | Pengaturan -> Tanggal gajian |
| Limit kartu, grup limit gabungan | FR-ACC-3/6 | Pengaturan -> Akun & kartu -> ketuk kartu; "Grup limit gabungan" |
| Iuran tahunan + waiver | FR-ACC-7 | Detail kartu kredit |
| Paylater | FR-ACC-8 | Pemilih jenis akun (setup + Tambah akun), dengan limit + tagihan berjalan |
| Kurs per hari + "Kurs saya" | FR-FX-4 | Pengaturan -> Kurs saya; banner "Kurs X belum ada" di Home/Transaksi/Anggaran |
| Kalender tagihan | FR-BILL-4 | Planning -> Tagihan -> tab Daftar / Kalender (filter Lunas / Belum lunas berlaku di keduanya) |
| Reimbursement | FR-TRX-4 | Detail transaksi pengeluaran |
| Weekly Replay | FR-COACH-5 | Coach -> Recap (Minggu ini / Minggu lalu) |
| ML Kit document scanner | FR-OCR-6 | + Catat -> "Scan dokumen", dan tombol di layar Scan |
| OTA (EAS Update) | Bab 10 | `app.json` `updates` + `runtimeVersion`, channel di `eas.json` |

## Aturan dan angka yang dipakai

### Laju belanja (pace)

Rasio laju = (terpakai / anggaran) / (hari berjalan / total hari periode). Hari ini ikut dihitung sebagai hari berjalan.

| Rasio | Label |
|---|---|
| <= 1 | Sesuai laju |
| 1 < rasio <= 1,2 | Agak cepat |
| > 1,2 | Terlalu cepat |

Konstanta `PACE_ON_TRACK_MAX` / `PACE_FAST_MAX` di `src/lib/budget.ts`. **Berubah dari Fase 1** (dulu 1,1 / 1,3),
mengikuti ambang di brief Fase 7. Anggaran 0 = selalu "Sesuai laju". Bucket Tabungan tetap memakai "% dari target".

"Aman dibelanjakan" per hari = (anggaran Kebutuhan + Keinginan - terpakai) / hari tersisa (termasuk hari ini), minimal 0.

### Periode dan payday

Periode = tanggal gajian sampai sehari sebelum gajian berikutnya (gajian 25: 25 Okt - 24 Nov). Tanggal gajian 1-28
(ada di setiap bulan); bawaan 1 = bulan kalender. Migrasi 13 menggeser profil lama yang memilih 29-31 ke 28.

### Anggaran per periode

Tabel `budgets` (satu baris per `period_start`): total + batas per kategori (`category_limits`, jsonb). Periode tanpa
baris = anggaran dari profil (penghasilan bulanan x persentase), tanpa batas kategori (perilaku lama).
- **Salin periode lalu**: total + semua batas kategori dari baris periode terakhir sebelum periode ini, apa adanya.
- **Saran rata-rata 3 bulan**: rata-rata *anggaran* (bukan belanja) dari hingga 3 periode tersimpan terakhir. Batas
  kategori dirata-rata dari periode yang membatasi kategori itu. Dibulatkan ke Rp1.000 (mata uang tanpa desimal) atau
  ke satuan utuh (mata uang berdesimal). Saat membuat anggaran baru, form langsung terisi saran ini.
- Batas kategori sekarang terisi, jadi pilar "kepatuhan anggaran" Health Score memakai data sungguhan.

### Kartu kredit, paylater, grup limit

- Terpakai = saldo negatif kartu (utang). Saldo positif = 0 terpakai.
- **Utilisasi grup = total terpakai semua kartu di grup / limit gabungan**, bukan jumlah utilisasi tiap kartu. Kartu
  mata uang lain dikonversi ke mata uang grup dengan kurs hari ini. Kartu di luar grup memakai limit sendiri.
- Grup butuh minimal 2 kartu (dicek form). Hapus grup = kartu kembali ke limit sendiri (FK `on delete set null`).
- Tampil di detail akun dan di kartu Home ("62% limit BCA gabungan").
- Paylater: limit + saldo seperti kartu kredit. Saat tambah akun kartu kredit/paylater, isian "Tagihan berjalan"
  disimpan sebagai saldo awal negatif.

### Iuran tahunan

Nominal, bulan + tanggal tagih (31 di bulan pendek = hari terakhir), ambang bebas iuran opsional, riwayat tanggal tagih
yang sudah dibayar (`annual_fee_paid date[]`, bukan boolean). Progress waiver = belanja di kartu itu sejak tanggal iuran
terakhir (inklusif) sampai hari ini vs ambang; kategori "Bank & Biaya Admin" tidak dihitung (iuran/biaya bank bukan
belanja). "Tandai dibayar" hanya mencatat riwayat; transaksi iurannya dicatat seperti biasa.

### Kurs per hari + "Kurs saya"

- Belanja/pemasukan memakai kurs **pada tanggal transaksi** (riwayat harian `fx_rates` dimuat sejak transaksi tertua,
  untuk kode yang dipakai). Transaksi lama tidak ikut bergerak saat kurs berubah.
- Saldo dan kekayaan bersih memakai kurs hari ini.
- "Kurs saya" (`user_rates`: 1 kode = X basis) hanya dipakai untuk kode **tanpa kurs harian sama sekali** (ECB tidak
  menerbitkan SAR, AED, BND, VND). Basis = mata uang utama bila punya kurs harian, selain itu USD.
- Tidak ada keduanya: konversi melempar `MissingRateError`; agregat mengecualikan nominalnya dan banner meminta
  pengguna mengisi kurs. Tidak ada kurs lain yang dipakai diam-diam. Pemilih mata uang membuka isian kurs dulu bila
  mata uang yang dipilih belum punya kurs.
- Mata uang baru di pemilih: AED, BND, THB, CNY, KRW, VND (eksponen juga ditambahkan ke tabel server).

### Reimbursement

Kolom `transactions.reimburse_status` (`pending`/`reimbursed`) + `reimbursed_by` (pemasukan pengganti).
- Pengeluaran yang ditandai tidak dihitung sebagai belanja (anggaran, recap, total, laporan, pajak).
- Pemasukan pengganti tidak dihitung sebagai pemasukan.
- Saldo akun tetap mengikuti uang yang benar-benar keluar/masuk.
- Status mengikuti tautan (trigger server): ada pengganti = reimbursed; pengganti dihapus = pending lagi.
- Alur: tandai -> pending -> "Tautkan pemasukan pengganti" (pilih pemasukan sejak tanggal pengeluaran) atau
  "Catat uang pengganti" (membuat pemasukan lalu menautkannya) -> reimbursed.

### Weekly Replay

Minggu berjalan (Senin sampai hari ini) dibanding rentang hari yang sama minggu lalu, atau minggu lalu penuh.
Sorotan: belanja terbesar, hemat terbesar (kategori yang turun paling banyak), kategori teratas, hari tanpa jajan.
Pencapaian: hari tanpa jajan, belanja turun, menabung (kategori Tabungan), bayar utang, lebih jarang makan di luar.
Setoran tabungan dan bayar utang tidak dihitung sebagai "belanja" yang disorot. Narasi AI Coach tetap merangkum minggu
lalu penuh.

## Data (migrasi `20261111000013_enhancements.sql`)

| Objek | Isi |
|---|---|
| `profiles.payday` | cek 1-28 |
| `budgets` (baru) | `period_start`, `total`, `category_limits`; unik per pengguna + periode; RLS |
| `limit_groups` (baru) | nama, mata uang, `shared_limit`; RLS |
| `accounts` | `credit_limit`, `limit_group_id`, `annual_fee`, `annual_fee_month/day`, `fee_waiver_threshold`, `annual_fee_paid` |
| `user_rates` (baru) | `code`, `base`, `rate`; PK pengguna + kode; RLS |
| `transactions` | `reimburse_status`, `reimbursed_by` |

Trigger: limit/grup hanya kartu kredit + paylater, iuran hanya kartu kredit, grup harus milik sendiri, reimbursement
hanya pengeluaran dan penggantinya harus pemasukan milik sendiri, pemasukan pengganti tidak bisa diubah jenisnya.
Uji: `npm run test:db` (7 skenario baru).

## ML Kit document scanner (FR-OCR-6)

Modul lokal `modules/doc-scanner` (Kotlin, Expo Modules API, `play-services-mlkit-document-scanner:16.0.0`). Pemindai
UI Google Play services: deteksi tepi + auto-crop, 1 halaman, JPEG, impor galeri diizinkan. Gambar hasil crop masuk
pipeline yang sama dengan foto kamera: kompres 1600 px -> unggah ke `receipts` -> `scan-receipt` (Gemini) -> layar cek.
Kuota sama dengan Scan struk.

Tidak tersedia (Expo Go, iOS, web, development build lama, perangkat tanpa Google Play services): layar Scan menampilkan
pesan "Scan dokumen belum tersedia" + tombol "Pakai kamera", tidak crash. Paket pihak ketiga
(`@infinitered/react-native-mlkit-document-scanner`) tidak dipakai: buildscript-nya memaksa Kotlin 1.8 dan memanggil
`Tasks.await` di thread utama. **Kotlin modul ini belum pernah dikompilasi** (mesin ini aarch64 tanpa Android SDK);
build EAS berikutnya adalah cek kompilasinya.

## OTA (EAS Update)

- `expo-updates` ~58.0.21.
- `app.json`: `runtimeVersion.policy = "fingerprint"` (update JS hanya dikirim ke build dengan kode native yang sama;
  menambah modul native = runtime baru = perlu build baru), `updates.url = https://u.expo.dev/<projectId>`,
  `checkAutomatically = ON_LOAD`, `fallbackToCacheTimeout = 0` (aplikasi tidak menunggu unduhan; update dipakai di
  pembukaan berikutnya).
- `eas.json`: build `development` -> channel `development`, `preview` -> `preview`, `production` -> `production`.

Mendorong update ke channel dev (setelah login Expo, dari folder proyek):

```bash
npx eas-cli@latest update --channel development --message "uji OTA Fase 7"
```

Di development build, update tidak dipasang otomatis seperti di build rilis: buka aplikasi -> layar development
launcher -> **Extensions** -> EAS Update -> pilih update di channel `development`. Build preview/production memuat
update otomatis saat dibuka (ON_LOAD) dan memakainya di pembukaan berikutnya.

## Build EAS development baru

Mencakup expo-print (Fase 6), modul `doc-scanner`, dan `expo-updates`. Butuh login Expo (langkah pemilik):

```bash
npx eas-cli@latest login
npx eas-cli@latest build --profile development --platform android
```

Pasang di HP Xiaomi: lihat `docs/fase5-smartlog.md` bagian "Pasang di HP Xiaomi" (APK baru menggantikan yang lama;
izin "setelan terbatas" untuk Smart Log mungkin perlu diulang). Metro: `npx expo start --dev-client --port 8082`,
URL manual `exp://100.91.191.123:8082`.

## Deploy (setelah izin)

1. Migrasi 13 (`scripts/deploy-supabase.sh` menerapkan yang belum ada). **Wajib sebelum aplikasi baru dipakai**: aplikasi
   memuat `budgets`, `limit_groups`, `user_rates` saat start.
2. Edge Functions ulang (`supabase/functions/_shared/money.ts` mendapat eksponen KRW/VND/AED/BND/THB/CNY untuk hasil scan).
3. Build EAS development baru (di atas), lalu uji gabungan Fase 5 + 6 + 7 di HP.

## Uji

- `src/__tests__/fase7.test.ts`: pace 3 tingkat dengan nilai diketahui, aman dibelanjakan, payday 25 -> 25..24 dan pace
  di periode bergeser, salin bulan lalu, saran rata-rata 3 bulan (pembulatan), grup limit (gabungan vs jumlah
  utilisasi, kartu di luar grup, mata uang lain), iuran + waiver + riwayat, Paylater, kurs per hari (transaksi lama
  tidak bergerak, saldo kurs hari ini), "Kurs saya", kurs hilang, reimbursement (total, anggaran, alur pending ->
  reimbursed, hapus pengganti), Weekly Replay (minggu berjalan, hemat terbesar, pencapaian, kosong).
- `src/__tests__/fase7-screens.test.tsx`: Paylater di pemilih akun, detail akun (utilisasi grup, tandai iuran
  dibayar, akun tidak ada), Kurs saya (isi kurs menghilangkan permintaan), kalender tagihan + filter, Replay kosong,
  tandai reimbursement.
- `npm run verify` lolos: typecheck, 1126 tes jest, 64 uji DB, 7 alur Smart Log, export web/android/ios.

Belum diuji: perangkat nyata (scanner ML Kit, OTA, tampilan baru di HP) dan alur layar Fase 7 dari aplikasi terhadap
Supabase live. Terjemahan MS/TR/EN baru ditulis tanpa penutur asli.

## Perbaikan setelah uji HP (2026-11-06)

- **Pemilih mata uang tidak bisa digulir**: `BottomSheet` punya mode `scrollable` (sheet maks 90% layar, isi
  di-scroll). Dipakai pemilih mata uang (semua pemakainya: Pengaturan, form transaksi, Konverter, Cicilan, invoice,
  Planning) dan sheet daftar lain yang belum bisa digulir: notifikasi, filter transaksi, + Catat / Lainnya, Paywall,
  detail tagihan, preset langganan. Tambah akun dan Kurs saya tidak memakai sheet ini (chip / layar penuh).
- **Coach terkunci padahal Premium**: grant Premium sampai ke server (gerbang `taxFull`/`pdfExport` lolos, jadi
  estimator pajak dan PDF terbuka). Penyebabnya: tab Tanya Coach dan kartu recap bulanan selalu membuka paywall
  tanpa melihat paket, karena keduanya belum pernah dibangun. Sekarang:
  - Recap bulanan dibangun (tab "Bulan lalu" di Coach -> Recap): bulan kalender lalu vs bulan sebelumnya, aturan
    sama dengan Weekly Replay, data lokal tanpa AI. Free melihat ajakan Premium di tab itu.
  - Tanya Coach untuk Premium menampilkan keterangan jujur "sedang disiapkan" (bukan paywall). Chat-nya butuh Edge
    Function baru (kuota `coachAsk` 20/hari sudah ada di server): menunggu keputusan pemilik.
  - Paket dan kuota dibaca ulang setiap aplikasi kembali aktif, jadi grant/pembelian di server langsung terlihat
    tanpa keluar-masuk.
- **Lainnya (Home)**: dua seksi berjudul, "Catat" (Scan Dokumen, Import Rekening Koran, Catat Manual) dan
  "Bisnis & alat" (Invoice & Penawaran, Alat). Seksi "Alat" terpisah tidak dipakai karena isinya satu item yang juga
  berjudul "Alat". Tujuan tiap item tidak berubah.
- **Kurs**: sinkronisasi sehat. Cron `fx-sync` jalan 00.15, 08.15, 16.15 UTC dan sukses; setiap hari kerja ada
  kursnya. ECB menerbitkan kurs referensi sekali per hari kerja (sekitar 16.00 CET), tanpa akhir pekan dan libur
  TARGET. Sumber dan aturan FR-FX-4 tidak diubah.
- **Performa**:
  - Android: panel konten tidak lagi memakai blur hidup (dimezis menggambar ulang latar setiap frame scroll; daftar
    transaksi punya satu Card per hari). Panel tetap memakai warna kaca yang sama di atas glow, jadi tampilannya
    hampir sama. Blur tetap aktif di nav pill, sheet, dialog, toast. iOS tidak berubah.
  - Daftar transaksi dirender bertahap: 60 baris dulu, 60 berikutnya saat scroll mendekati bawah.
  - Mengukur FPS di development build: JS mode dev jauh lebih lambat dari rilis. Ukur dengan
    `npx expo start --dev-client --port 8082 --no-dev --minify`.

## Tanya Coach (FR-COACH-3/4, live 2026-11-06)

- **Edge Function `coach-ask`** (deploy 2026-11-06). Kuota `coachAsk` dari migrasi 5: Free 0 (ditolak `quota`, 402),
  Premium 20/hari. Kuota diambil sebelum Gemini dan dikembalikan bila gagal (`runAiJob`); rate limit 10/menit.
- **Privasi (FR-COACH-4)**: klien mengirim ringkasan angka saja (`src/lib/coachAsk.ts`, kontrak `AskContext`): mata
  uang, penghasilan, kekayaan bersih, periode, anggaran + bucket, belanja per kategori (kunci kategori), minggu ini,
  skor + pilar. Tanpa nama toko, catatan, nama akun, atau transaksi satu per satu. Pertanyaan maks 300 karakter,
  riwayat maks 6 giliran. Server tidak menyimpan percakapan.
- **Prompt**: hanya pakai angka dari konteks, tidak mengarang, menolak topik di luar keuangan pribadi, tanpa saran
  investasi/pajak/hukum spesifik, pertanyaan diperlakukan sebagai data (bukan instruksi), nama kategori ditulis dalam
  bahasa pengguna (bukan kunci mentah). Jawaban dibersihkan dari em dash.
- **Layar**: Coach -> Tanya Coach. Premium: sisa pertanyaan hari ini, contoh pertanyaan, chat, state memuat/gagal/
  kuota habis, catatan "Jawaban AI bisa keliru. Percakapan tidak disimpan." Free: state terkunci + Premium.
- **Uji**: jest (konteks tanpa data mentah, kontrak, prompt, normalizer, layar Free/Premium/kuota habis);
  `npm run test:live` skenario baru: Free 402, input salah 400, Premium dijawab Gemini (~2-5 detik), kuota +1.

## Perbaikan rute + e2e (2026-11-06)

- **Bug**: pengguna baru yang belum setup (mis. setelah verifikasi OTP) mendarat di halaman Harga, bukan Setup.
  Penyebab: fallback guard expo-router memilih rute tak-terkunci pertama menurut nama berkas ("harga"). Perbaikan:
  `redirectTo` eksplisit di tiap `Stack.Protected` (`src/app/_layout.tsx`).
- `scripts/e2e-web.mjs` disesuaikan dengan Fase 4-7 (detail akun -> Desain kartu, Recap Minggu ini/Minggu lalu/
  Bulan lalu, seksi Lainnya, kartu batas akun) + langkah baru: tanggal gajian + Kurs saya, anggaran periode dengan
  batas kategori (tersimpan setelah muat ulang), tampilan Daftar/Kalender tagihan. Error 503 checkout
  `not_configured` (kunci Xendit/Paddle belum diisi) dicatat sebagai error yang diharapkan. Hasil: 37/37 lolos.

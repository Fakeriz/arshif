# PROGRESS — Arshif Rebuild

Ringkasan untuk melanjutkan di sesi baru. Sumber kebenaran: `docs/arshif-prd.md` (PRD acuan, Bab 11 + FR-SET-4 untuk desain) + `docs/arshif-fitur-lengkap-prd.md` (cek silang) + `docs/arshif-starter-prompt-rebuild-claude.md` (aturan kerja). Referensi visual: `docs/redotpay-reference.jpg`.

## Keputusan slot (dijawab Ahmad, 2026-11-05)

| Slot | Jawaban |
|---|---|
| Stack | Expo (SDK 58, Expo Router, TS strict) + Supabase |
| Arah desain | **"Kaca & Aksen"** (revisi sebelum Fase 1, referensi RedotPay). Menggantikan "Tinta & Kuningan". |
| Tema | Dark + light (ikut sistem, bisa dipaksa) |
| Aksen | Pilihan pengguna di Pengaturan: Merah (default), Kuningan, Zamrud, Biru, Ungu (FR-SET-4) |
| Font | Plus Jakarta Sans saja (Fraunces dicabut) |
| Referensi visual | RedotPay. Wajib sama: panel kaca blur, glow aksen, saldo besar dengan desimal redup, nav pill kaca. Boleh adaptasi: isi konten, struktur tab (5 tab Arshif + tombol tengah) |
| Cakupan layar v1 | Inti dulu: Home, Transaksi, Tambah (Capture), Anggaran, Coach, Pengaturan |
| antislop | Mode DURING untuk revisi desain (skill `local-antislop` + `local-antislop-ui`) |

### Override pemilik atas antislop R-10 (2026-11-05)

R-10 membatasi glassmorphism ke 1–2 elemen. Ahmad memutuskan **kaca tetap di semua panel** (kartu akun, aksi cepat, transaksi, nav pill, sheet/modal, dialog, toast).
- Hierarki dijaga lewat dua lapisan opasitas: `glass` (panel konten, bening) vs `glassStrong` (mengambang, pekat).
- Fallback blur → translusen solid tetap berlaku: perangkat low-end (Android < 12 atau tanpa `BlurTargetView`), reduced motion, iOS Reduce Transparency.
- **Visual check Fase 1 wajib memverifikasi hierarki + keterbacaan tiap layar.** Layar yang hierarkinya hilang → kaca di layar itu dikurangi (pengecualian per layar, bukan rollback global). Catat pengecualiannya di sini.
- Juga dicatat di PRD Bab 11.

## Status fase

- [x] **Fase 0 — Fondasi** (2026-11-05), direvisi ke "Kaca & Aksen", disetujui Ahmad
- [x] **Fase 1 — UI layar inti dengan data contoh** (2026-11-05), dilengkapi i18n ID/MS/TR/EN + pemilih desain kartu bank
- [ ] **Fase 2 — Backend Supabase, LIVE** (2026-11-05): scan dan kurs sungguhan lolos; login sungguhan lolos di level Auth/API, tapi **login dari aplikasi oleh pengguna nyata masih terblokir** keputusan email OTP (lihat "Keputusan terbuka"). Fase 2 belum dinyatakan selesai.
- [ ] Fase 3 — Monetisasi (RevenueCat + Xendit + Paddle) & rilis
- [ ] Fase 5 — Smart Log: migrasi 10 live 2026-11-06 (uji live 11/11), migrasi 11 (cron) belum; uji di HP lewat development build menunggu. Detail: `docs/fase5-smartlog.md`

## Fase 0 — yang sudah ada

- **Tokens** `src/theme/tokens.ts`: `palettes` (netral + semantik + kaca per tema), `accents` (5 aksen × 2 tema: accent, onAccent, accentText, accentSoft, accentGlow, focus), `buildPalette(scheme, accent)`, radius PRD (kartu 16, tombol/input 12, sheet 24), Plus Jakarta Sans 400–800, gerak 150–300ms.
- **Aksen Merah + over budget**: `overBudgetForRedAccent` mengganti rona `negative` ke oranye-vermilion; `CurrencyText kind="over"` selalu memakai ikon `TriangleAlert` + label pembaca layar "Melebihi batas".
- **Progress budget**: < 80% hijau (bukan aksen, supaya aksen Merah tidak membuat budget aman terbaca bahaya), 80–100% peringatan, > 100% over budget.
- **Theme**: `ThemeProvider` (mode + aksen, `initialAccent` + `onAccentChange` untuk penyimpanan per pengguna), `motion.ts`.
- **Lib**: `money.ts` (minor units, `formatMoneyParts` untuk desimal redup, konversi BigInt), `chart.ts`, `contrast.ts` (komposit rgba untuk uji teks di atas kaca + glow).
- **Komponen baru**: GlassView (+ BlurTargetProvider, useGlassEnabled), AmbientGlow, BalanceText, GlassTabBar, QuickActions, PromoCard, BankCard (+ `constants/banks.ts`), AccentPicker.
- **Komponen diubah**: Card (bawaan kaca), BottomSheet/Dialog/Toast (kaca mengambang), Chip/Badge/Button/Tabs/EmptyState/AmountInput (lapisan translusen `track`).
- **Lembar Desain** `/design`: pemilih tema + aksen, section "Penerapan" (komposisi Home pola referensi + isi Arshif), lalu semua token/komponen/state.
- **Test (609)**: kontras AA semua aksen × tema × latar (latar, kartu, kaca, kaca di atas puncak glow, fallback, kartu promo), rona over budget vs aksen Merah, kartu bank, money, chart, render komponen.

## Fase 1 — yang sudah ada

**Layar** (rute di `src/app/`): Home `(tabs)/index`, Transaksi `(tabs)/transaksi`, Anggaran `(tabs)/anggaran`, Coach `(tabs)/coach`, Pengaturan `pengaturan`, Detail `trx/[id]`, Catat manual/ubah `tambah`, Scan `scan` + `scan-review`, Voice `voice` + `voice-review`, Import PDF `import` + `import-review`. Sheet: Catat (+), Notifikasi, Filter, Atur persentase, Mata uang, Premium (paywall).

**Cara kerja state**: store memori (`src/state/`, reducer murni) dengan data contoh `src/data/seed.ts` (pengguna fiktif, gajian tgl 25, periode 25 Okt sampai 24 Nov). Saldo diturunkan dari saldo awal + transaksi. Menyimpan struk/voice/import benar-benar menambah transaksi dan memotong kuota.

**Lihat semua state tanpa mengubah kode**: tambahkan `?state=loading|empty|error|limit` ke URL layar mana pun (hook `useDemoState`). Dihapus di Fase 2.

**Logika terpisah + teruji** (`src/lib/`): `fx` (kurs silang BigInt), `dates`, `transactions` (saldo, filter, grup), `budget` (periode gajian, laju, aman dibelanjakan, bucket), `health` (5 pilar), `recap` (Weekly Replay), `receipt` (selisih item vs subtotal), `dedupe` (duplikat PDF), `quota`, `validate`, `statement`.

**Verifikasi**: `npm run verify` (typecheck + 781 test + export web/android/ios). `npm run e2e:web` (klik-tembus 28 langkah di Chromium; butuh `npx playwright install chromium`, jalankan setelah `npm run export:web`).

### i18n (ID/MS/TR/EN)

- **Tanpa dependensi baru.** `src/i18n/`: katalog per namespace di `locales/<bahasa>/<ns>.ts` (`common`, `domain`, `shell`, `home`, `tx`, `capture`, `budget`, `coach`, `settings`). `id` adalah sumber; bahasa lain bertipe `Messages['ns']`, jadi kunci yang hilang = error TypeScript.
- **Pakai**: `const t = useT()` lalu `t('home.title')`, sisipan `{nama}`. Bentuk tunggal Inggris: kunci `<key>_one` dipakai saat `count === 1` (harus ada di keempat katalog). Kunci tak dikenal jatuh ke Indonesia lalu ke kunci itu sendiri.
- **Lib mengembalikan kunci, bukan teks**: `validateTx` → `domain.validation.*`, `healthBand().key`, `Pillar.key`, `Pace`, `QuotaKey`, `BUCKETS`, `ACCENT_OPTIONS`, `CATEGORIES` tanpa `label`. Helper: `categoryLabel(t,key)`, `currencyName(t,code)`, `bankName(t,key)`. Tanggal: `dayLabel/dayLong/shortDate/monthName(…, lang)`, nama bulan/hari di `i18n/calendar.ts` (tidak bergantung ICU/Hermes). TR menulis tanggal panjang "5 Kasım 2026 Perşembe".
- **Bahasa awal** = bahasa perangkat bila id/ms/tr/en, selain itu Indonesia (`detectLang`, expo-localization). Ganti di Pengaturan → Bahasa (nama bahasa ditulis dalam bahasanya sendiri). Web: `<html lang>` ikut. Fase 2: simpan ke profil lewat `I18nProvider.onLangChange` / `initialLang`.
- **Tidak diterjemahkan**: data pengguna (merchant, item struk, transkrip voice, nama akun), nama bank, "Coach", "PRO", "Arshif". Format nominal tetap per mata uang (Rp 45.000, RM 12.50), bukan per bahasa.
- **Notifikasi contoh** sekarang `titleKey/messageKey/vars/date/time`; waktunya tampil sebagai tanggal ("2 Nov, 07.00"), bukan "Senin, 07.00". Fase 2: teks datang dari server dalam bahasa pengguna.
- **Penjaga** (`__tests__/i18n.test.ts`): kunci identik di 4 bahasa, placeholder sama, tanpa teks kosong/em dash, dan pemindai yang menolak teks UI ditulis langsung di JSX (kecuali Lembar Desain).
- **e2e memaksa locale `id-ID`** (Chromium default en-US). Ada langkah ganti ke Türkçe, deteksi ms-MY/en-US, dan fallback fr-FR → Indonesia.
- Pilihan istilah: EN tab "Activity" (muat di nav pill), MS "Bajet" di tab dan "Belanjawan" di judul layar, TR persen ditulis `%{pct}` tanpa akhiran (akhiran Turki berubah mengikuti angka).

### Kartu per bank (FR-ACC-2)

- `constants/banks.ts`: 26 bank/dompet (ID 15, MY 5, TR 5, Tunai). Warna merek perkiraan, nama sebagai teks, tanpa logo. Semua lolos teks ≥ 4.5:1 (`banks.test.ts`).
- Pengaturan → **Akun & kartu** → ketuk akun → sheet **Desain kartu**: pratinjau kartu yang sama dengan Beranda + grid bank per negara (grup radio). Pilihan langsung berlaku di Beranda (aksi `account/setBank`).
- BankCard tanpa `onPress` dirender sebagai kartu statis (sebelumnya tampil pudar sebagai tombol nonaktif).

### Keputusan dan asumsi Fase 1 (cek dan koreksi bila salah)

- **Tab "Anggaran" menggantikan "Planning"** di nav sampai hub Planning (Goals, Tagihan, Utang, Langganan, Split Bill) dibangun. Tidak ada layar placeholder.
- **Rumus Health Score** (PRD hanya memberi bobot): tabungan target 20% penghasilan; kepatuhan = kategori di bawah batas; utang nol poin di cicilan >= 40% penghasilan, penuh <= 10%; dana darurat target 6 bulan; tagihan = rasio tepat waktu. Kalibrasi di `lib/health.ts`.
- **Laju belanja**: porsi anggaran terpakai / porsi waktu berjalan; <= 1,1 "Sesuai laju", <= 1,3 "Agak cepat", selebihnya "Terlalu cepat". Bucket Tabungan tidak memakai laju (menabung cepat itu baik), diganti "% dari target".
- **Kategori yang punya batas** (`DEMO_CATEGORY_LIMITS`) konstanta contoh; layar pengaturan batas per kategori belum ada.
- **Modul Tagihan belum ada**: skor "tagihan tepat waktu" memakai konstanta contoh (`DEMO_BILLS`).
- Narasi Coach, hasil scan/voice/import adalah **contoh berlabel** ("Contoh narasi", teks di layar). AI sungguhan di Fase 2.
- Tombol Premium, ekspor data, dan hapus akun menampilkan toast jujur "belum aktif" (Fase 2/3), bukan dead button.
- Alasan kuota habis dibuka sebagai sheet Premium dengan penyebab spesifik, bukan error mentah. Harga paket TIDAK ditulis (PRD tidak menyebut angka).
- Mata uang yang bisa dipilih hanya yang punya kurs (IDR, MYR, TRY, USD, SGD, EUR). Kurs sendiri ("Kurs saya", FR-FX-4) belum dibangun.
- Tanggal diketik (TTTT-BB-HH) dengan tombol Hari ini/Kemarin; pemilih tanggal native menyusul.

### Hasil visual check kaca per layar (override R-10)

Dicek di 390px, gelap + terang, aksen Merah/Biru, termasuk fallback tanpa blur. Hierarki dan keterbacaan terjaga di Home, Transaksi, Anggaran, Coach, Pengaturan, sheet, dan dialog. **Tidak ada layar yang perlu pengurangan kaca.**

Cek ulang i18n (10 layar × 4 bahasa, 390px, ditambah deteksi otomatis overflow horizontal dan teks terpotong): tidak ada overflow. Yang diperbaiki: subjudul Pengaturan dan nama akun yang terpotong, label sumber transaksi yang terpotong (urutan meta jadi jam · sumber · akun), label donat dan badge bucket Tabungan versi MS/TR. Yang masih terpotong dengan elipsis hanya nama merchant/akun panjang di baris daftar (utuh di layar detail). Belum dicek di perangkat nyata (lihat "Belum terverifikasi").

### Bug yang ketemu lewat uji dan sudah diperbaiki

- Di web, `accessibilityState` tidak menjadi `aria-checked/selected`, jadi toggle, chip, tab, dan radio tidak terbaca statusnya. Semua diganti prop `aria-*` (jangan pakai `accessibilityState` lagi).
- Bucket Tabungan salah diberi label "Terlalu cepat" dan progress merah.
- Ring fokus muncul setelah klik mouse; sekarang hanya untuk keyboard (`PressableScale`).
- Em dash di teks UI dibersihkan (R-02).

### Belum terverifikasi / belum ada

- **Perangkat nyata**: blur Android (sudah dipasang `BlurTargetView`, belum diuji di Xiaomi), haptic, safe area notch, keyboard numerik, gestur tarik sheet, kamera/rekam suara/pemilih PDF native.
- **Terjemahan MS/TR/EN** ditulis tanpa penutur asli; perlu dibaca penutur asli sebelum rilis.
- **Belum dibangun (di luar cakupan inti)**: carousel onboarding, login Google, Planning hub, Invoices, Tools, Admin, Smart Log, Split Bill dari struk, chat Tanya Coach (Premium), PIN/biometrik, kelola kategori.

## Cara menjalankan

```bash
npm ci
npm run web          # buka http://localhost:8081/design
npm start            # Expo Go / dev build
npm run verify       # typecheck app + functions, jest, uji DB (PGlite), export web/android/ios
SUPABASE_ACCESS_TOKEN=... ./scripts/deploy-supabase.sh   # migrasi, secret cron, functions, auth, kurs
SUPABASE_SECRET_KEY=... npm run test:live               # smoke test LIVE
npm run export:web && SUPABASE_SECRET_KEY=... npm run e2e:web   # klik-tembus LIVE (Chromium)
EXPO_PUBLIC_DESIGN_SHEET=1 npm run web  # buka Lembar Desain di /design
```

## Catatan teknis penting (jangan diulang)

- **Blur di web**: lapisan `BlurView` absolut menutupi `<svg>` yang static → GlassView membuat stacking context (`zIndex: 0`) dan blur di `zIndex: -1`. Jangan dihapus.
- **Blur di Android**: `blurMethod="dimezisBlurViewSdk31Plus"` butuh `BlurTargetView`. Tanpa `BlurTargetProvider`, GlassView memakai fallback translusen. Fase 1: pasang `BlurTargetView` di layar untuk elemen mengambang (nav pill, sheet). Kaca TIDAK boleh berada di dalam target yang sama yang dia blur.
- **Glow**: alpha puncak sudah disetel agar teks/label di atasnya ≥ 4.5:1. Mengubah `accentGlow` wajib lolos `contrast.test.ts`.
- **Preferensi per pengguna**: dimuat dari profil di `AppStore.reload`; pengguna baru (belum setup) menyimpan bahasa/aksen/tema perangkat. Penanda `applying` mencegah nilai perangkat menimpa profil saat muat.
- **Rute auth**: JANGAN tambah `(auth)/index` atau layout grup `(auth)`: `/` jadi ambigu dan tab Home crash ("Tab trigger 'index' … must point to a route within the tabs layout").
- **Konfigurasi publik klien** di `src/config/public.ts` (bukan `app.json` extra: tidak terbawa ke bundle web).
- **Font di Chromium headless mesin ini**: tidak ada font sistem; fixture e2e memuat font lewat API `FontFace`, bukan `@font-face`.
- **Warna bank** di `constants/banks.ts` perkiraan warna merek, tanpa logo; verifikasi ke panduan merek resmi sebelum rilis.
- **Ikon Lucide**: ditetapkan pemilik di PRD Bab 11 (alasan R-04 tertulis di sana).
- NativeWind tidak dipakai; TS 6 butuh `"types": ["jest"]`; mock Reanimated minimal di `jest.setup.ts`; RNTL v14 async; aarch64 → export native `--no-bytecode`; `expo-asset` + `query-string` eksplisit; `PressableScale` pakai `containerStyle` untuk flex; teks nominal web tidak auto-shrink.
- Teks UI tanpa em dash (antislop R-02).
- Bundle id sementara `app.arshif`; ikon aplikasi & splash masih aset default Expo (R-23: butuh arahan logo dari pemilik).

## Fase 2 — yang sudah ada (proyek Supabase `gyxtdpmruuhhkprlhlrk`, ArshifLabs)

**Database** (`supabase/migrations/`, diterapkan lewat `scripts/deploy-supabase.sh`):
- Tabel: profiles, accounts, transactions, transaction_items, plan_limits, usage_counters, fx_rates, notifications, ai_jobs, coach_narrations. Nominal = `bigint` unit terkecil (bukan float).
- Saldo akun dihitung trigger (`recompute_balance`); kolom `balance`, `plan`, `user_id` tidak bisa ditulis klien (hak kolom + trigger).
- RLS di semua tabel; transaksi/item/foto struk hanya boleh merujuk akun/folder milik sendiri (trigger, bukan cuma FK).
- Kuota Bab 7 ditegakkan di server: `quota_try_consume`/`quota_refund` (hanya service role), batas 4 akun Free lewat trigger, `my_usage()` untuk layar.
- Storage privat `receipts` (8 MB) dan `statements` (15 MB), path `<user_id>/<berkas>`; signed URL 10 menit.
- pg_cron: `fx-sync` 3x sehari lewat pg_net + secret Vault (`project_url`, `cron_secret`), bersih notifikasi > 90 hari, log AI > 180 hari.
- Uji lokal tanpa Docker: `npm run test:db` (PGlite + stub Supabase, 22 skenario).

**Edge Functions** (`supabase/functions/`, kontrak zod bersama `_shared/contracts.ts`): scan-receipt, voice-log, import-statement, coach, fx-sync, delete-account. `verify_jwt = false` (kunci format baru), token diverifikasi di kode. Rate limit 10 AI/menit/pengguna, kuota diambil atomik sebelum AI dan dikembalikan bila gagal, semua percobaan dicatat di `ai_jobs`.

**Klien**: login email OTP (`(auth)/masuk`, `(auth)/verifikasi`), setup 3 langkah (`setup`), gerbang rute `Stack.Protected` di `_layout.tsx`, store dari Supabase dengan sinkron optimistik (`state/sync.ts`; gagal = toast + muat ulang), preferensi bahasa/aksen/tema per pengguna, lonceng Realtime, kurs harian asli ("kurs per tanggal"), kamera/galeri + kompres 1600 px, rekam suara (expo-audio), pemilih PDF, foto struk di detail, ekspor JSON/CSV, hapus akun, tambah akun, keluar. Data contoh (`data/seed.ts`, `sample-state.ts`) hanya untuk test dan Lembar Desain.

### Checkpoint LIVE (2026-11-05)
- `npm run test:live` 10/10: login lewat kode OTP Supabase Auth, RLS lintas pengguna, trigger saldo, plan/saldo tidak bisa ditulis, kurs ECB, 401/400/403 di function, **scan struk sungguhan** (INDOMARET, total 87.500, 4 item, kuota +1, ~4,5 detik), storage terisolasi, hapus akun cascade.
- `npm run e2e:web` 30/30 tanpa error konsol, terhadap Supabase live: setup pengguna baru, simpan bertahan setelah muat ulang, preferensi tersimpan, **scan dari UI**, **import PDF dari UI** (5 baris, duplikat tidak dicentang), bahasa perangkat vs profil.
- Kurs: 7.720 baris, 256 hari kerja, terbaru 2026-11-04 (IDR 18.129 / MYR 4,064 / TRY 50,022 per USD).
- Voice Log diuji manual dengan rekaman TTS: transkrip benar, "kemarin" → tanggal absolut, akun GoPay cocok, ~6 detik.
- Keduanya butuh `SUPABASE_SECRET_KEY` di env (pengguna uji dibuat lewat admin API, tanpa email). Jangan di-commit.

### Keputusan terbuka (perlu jawaban Ahmad)
- **Email OTP 6 digit**: paket Free Supabase dengan email bawaan tidak mengizinkan ubah templat, dan templat bawaan hanya berisi tautan (tanpa kode). Batas kirim juga 2 email/jam. Pilihan: (a) pasang SMTP sendiri (mis. Resend/Brevo, perlu domain pengirim) lalu templat berisi `{{ .Token }}` diterapkan oleh `deploy-supabase.sh`; atau (b) ganti alur ke magic link + deep link. Sampai diputuskan, pengguna sungguhan belum bisa login lewat aplikasi (login teruji lewat API).

### Konflik dengan PRD (dicatat, bukan diam-diam)
- **Model AI**: PRD Bab 10 `gemini-2.5-flash` sudah ditutup Google untuk pengguna baru. Dipakai `gemini-3.1-flash-lite` (utama, ~4,5 detik scan) + `gemini-3.5-flash` (cadangan), bisa diganti lewat secret `GEMINI_MODEL` / `GEMINI_FALLBACK_MODEL`.
- **Kurs**: PRD = ExchangeRate-API per jam; dipakai Frankfurter/ECB harian (keputusan Ahmad 2026-11-05).
- **Kuota scan** terpotong saat AI berhasil membaca, bukan saat Simpan (PRD FR-OCR-4), supaya kuota tidak bisa dipakai gratis dengan membaca tanpa menyimpan.
- **PDF rekening koran** dihapus langsung setelah dibaca (PRD: 30 hari). PDF berkata sandi belum didukung (PRD: password opsional).
- **Daftar transaksi** memuat semua transaksi saat start (per 1000 baris), belum paginasi kursor 50/halaman (NFR).
- **Voice Log** ~6 detik (target NFR < 4 detik).

### Belum ada di Fase 2
- ML Kit document scanner (FR-OCR-6) butuh dev build; sekarang image picker.
- Batas per kategori (FR-SET-2) belum bisa diatur → kepatuhan anggaran = penuh; pilar tagihan penuh (modul Tagihan belum ada); delta skor bulan lalu belum ada (riwayat skor).
- Notifikasi otomatis (budget 80/100%, recap Senin 07.00) belum dijadwalkan; tabel + Realtime sudah siap.
- Transaksi hasil import memakai jam 00:00.

## Fase 3: monetisasi (dibangun lokal, BELUM di-deploy)

Detail, daftar kunci, dan checklist dashboard: `docs/fase3-pembayaran.md`.

- **Server**: migrasi `20261106000005_monetization.sql` memperluas sistem kuota Fase 2 (jenis batas month/day/total/feature, trigger batas generik, `my_usage` dengan jenis), tabel `prices`, `orders`, `webhook_events`, `admin_users`, RPC admin. Cron: pesanan kedaluwarsa + sinkron entitlement.
- **Edge Functions**: `checkout-create`, `xendit-webhook`, `paddle-webhook`, `revenuecat-webhook`, `entitlement-sync`, `admin-grant`. RevenueCat = sumber kebenaran; paid web -> grant entitlement promosi (REST v2) sesuai durasi -> cermin di profil -> notifikasi in-app.
- **Aplikasi**: `react-native-purchases` (Expo Go = Preview API Mode, pembelian sungguhan butuh dev build), halaman Premium, status pesanan (Realtime + polling), Sukses, Pricing publik `/harga`, Admin `/admin` (web, role admin). Sheet paywall membuka halaman Premium dengan alasannya. Badge PRO pada fitur terkunci.
- **Feature flag**: link checkout web di iOS/Android hanya untuk wilayah `EXPO_PUBLIC_WEB_CHECKOUT_*_REGIONS` (bawaan kosong).
- **Uji**: `billing.test.ts` (HMAC Paddle, token, transisi status, perpanjangan masa), `plan-mirror.test.ts` (kuota + harga klien = seed server), 9 uji DB baru. Beli sandbox ujung ke ujung belum bisa: menunggu kunci.

## Sisa sebelum rilis

- Kunci RevenueCat/Xendit/Paddle + produk dashboard (lihat dokumen Fase 3), lalu uji beli bulanan + tahunan sampai lunas, webhook, grant, pulihkan.
- Fitur Goals/Tagihan/Utang/Langganan/Invoice/Alat Pajak/Tanya Coach/recap bulanan belum dibangun; batasnya sudah ada di server, tinggal pasang trigger saat tabelnya dibuat.
- Selesaikan keputusan email OTP; login Google (FR-AUTH-1).
- Hardening: cabut token akses Supabase dan kunci Gemini yang pernah ditempel di percakapan, buat ulang.
- Host web (untuk `/harga`, checkout web, `/admin`) dan `APP_URL` belum ditentukan.

## Fase 5: Smart Log (migrasi 10 live 2026-11-06; migrasi 11 belum)

Detail lengkap, langkah development build, pemasangan di Xiaomi, dan Metro: `docs/fase5-smartlog.md`.

- **Native**: module lokal `modules/smart-log` (Kotlin, Expo Modules API): `SmartLogListenerService` + antrean
  SharedPreferences; manifest service digabung otomatis. Tidak jalan di Expo Go (`SmartLogNative` = null di Expo Go,
  iOS, web; layar menampilkan penjelasan). `expo-dev-client` + `eas.json` profil `development` (APK).
- **Parser** `src/lib/smartlog/parser.ts` (di HP, murni) + daftar 20 package `src/lib/smartlog/apps.ts`
  (package id dicek ke Google Play 2026-11-05). Pemrosesan `src/lib/smartlog/process.ts`, provider `src/state/smartlog.tsx`.
- **Server**: migrasi 10 (`smartlog_links`, `smartlog_items`, RPC ingest/confirm/dismiss/undo, kuota automation di
  dalam RPC), migrasi 11 (cron bersih 60 hari).
- **Layar**: Pengaturan -> Automation (`/otomasi`), To Review (`/otomasi/tinjau`), Ubah dulu (`/otomasi/catat`),
  banner di tab Transaksi. Toast mendapat tombol aksi.
- **Uji**: `npm run test:smartlog` (alur penuh di PGlite), `test:db` +10 skenario, jest parser + layar. `verify` ikut
  menjalankan `test:smartlog`. Skrip memuat TS aplikasi langsung lewat type stripping Node 22 (`scripts/ts-hooks.mjs`).
- **Temuan samping (belum diubah)**: teks `textMuted`/`textSecondary` di atas lapisan `track` di dalam kartu kaca
  turun ke 3,35 sampai 4,47:1 di tema gelap. Layar Smart Log tidak memakai `track` di belakang teks; komponen lama
  yang memakainya (mis. chip tidak terpilih) perlu dicek.
- **Kotlin belum pernah dikompilasi** (mesin ini aarch64 tanpa Android SDK). Build EAS pertama = cek kompilasi.


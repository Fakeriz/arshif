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
- [x] **Fase 1 — UI layar inti dengan data contoh** (2026-11-05) — menunggu konfirmasi sebelum Fase 2
- [ ] Fase 2 — Backend Supabase (LIVE: login, scan, kurs sungguhan)
- [ ] Fase 3 — Monetisasi (RevenueCat + Xendit + Paddle) & rilis

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

**Verifikasi**: `npm run verify` (typecheck + 662 test + export web/android/ios). `npm run e2e:web` (klik-tembus 25 langkah di Chromium; butuh `npx playwright install chromium`, jalankan setelah `npm run export:web`).

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

Dicek di 390px, gelap + terang, aksen Merah/Biru, termasuk fallback tanpa blur. Hierarki dan keterbacaan terjaga di Home, Transaksi, Anggaran, Coach, Pengaturan, sheet, dan dialog. **Tidak ada layar yang perlu pengurangan kaca.** Belum dicek di perangkat nyata (lihat "Belum terverifikasi").

### Bug yang ketemu lewat uji dan sudah diperbaiki

- Di web, `accessibilityState` tidak menjadi `aria-checked/selected`, jadi toggle, chip, tab, dan radio tidak terbaca statusnya. Semua diganti prop `aria-*` (jangan pakai `accessibilityState` lagi).
- Bucket Tabungan salah diberi label "Terlalu cepat" dan progress merah.
- Ring fokus muncul setelah klik mouse; sekarang hanya untuk keyboard (`PressableScale`).
- Em dash di teks UI dibersihkan (R-02).

### Belum terverifikasi / belum ada

- **Perangkat nyata**: blur Android (sengaja fallback translusen sampai ada `BlurTargetView` + uji di dev build), haptic, safe area notch, keyboard numerik, gestur tarik sheet.
- **Kamera, rekam suara, pemilih berkas PDF**: UI-nya ada, perangkatnya Fase 2 (label jujur di layar).
- **i18n ID/MS/TR/EN**: belum; semua teks Indonesia. Selector bahasa sengaja tidak dipasang sampai i18n ada.
- **Belum dibangun (di luar cakupan inti)**: onboarding/login, Planning hub, Invoices, Tools, Admin, Smart Log, Split Bill dari struk, chat Tanya Coach (Premium), PIN/biometrik, kelola kategori.
- Persistensi: tema/aksen/preferensi hilang saat aplikasi ditutup (Fase 2: simpan ke profil).

## Cara menjalankan

```bash
npm ci
npm run web          # buka http://localhost:8081/design
npm start            # Expo Go / dev build
npm run verify       # typecheck + test + export web/android/ios
npm run export:web && npm run e2e:web   # klik-tembus Chromium
EXPO_PUBLIC_DESIGN_SHEET=1 npm run web  # buka Lembar Desain di /design
```

## Catatan teknis penting (jangan diulang)

- **Blur di web**: lapisan `BlurView` absolut menutupi `<svg>` yang static → GlassView membuat stacking context (`zIndex: 0`) dan blur di `zIndex: -1`. Jangan dihapus.
- **Blur di Android**: `blurMethod="dimezisBlurViewSdk31Plus"` butuh `BlurTargetView`. Tanpa `BlurTargetProvider`, GlassView memakai fallback translusen. Fase 1: pasang `BlurTargetView` di layar untuk elemen mengambang (nav pill, sheet). Kaca TIDAK boleh berada di dalam target yang sama yang dia blur.
- **Glow**: alpha puncak sudah disetel agar teks/label di atasnya ≥ 4.5:1. Mengubah `accentGlow` wajib lolos `contrast.test.ts`.
- **Penyimpanan aksen**: Fase 0 hanya state; Fase 2 simpan ke profil Supabase lewat `onAccentChange`, muat lewat `initialAccent`.
- **Warna bank** di `constants/banks.ts` perkiraan warna merek, tanpa logo; verifikasi ke panduan merek resmi sebelum rilis.
- **Ikon Lucide**: ditetapkan pemilik di PRD Bab 11 (alasan R-04 tertulis di sana).
- NativeWind tidak dipakai; TS 6 butuh `"types": ["jest"]`; mock Reanimated minimal di `jest.setup.ts`; RNTL v14 async; aarch64 → export native `--no-bytecode`; `expo-asset` + `query-string` eksplisit; `PressableScale` pakai `containerStyle` untuk flex; teks nominal web tidak auto-shrink.
- Teks UI tanpa em dash (antislop R-02).
- Bundle id sementara `app.arshif`; ikon aplikasi & splash masih aset default Expo (R-23: butuh arahan logo dari pemilik).

## Untuk Fase 2

- Ganti `src/state/` (store memori) dengan Supabase (Auth, RLS, query), bentuk hook `useLedger/useBudget/useHealth` dipertahankan. Hapus `useDemoState` dan paksaan `?state=`.
- Edge Functions: OCR struk, Voice Log, Import PDF, Coach, sync kurs. Kuota ditegakkan di server.
- Simpan aksen/tema/preferensi per pengguna (`ThemeProvider.onAccentChange`, `initialAccent`).
- Pasang kamera (ML Kit scanner), rekam suara, pemilih PDF; uji blur Android di dev build.
- i18n ID/MS/TR/EN, lalu aktifkan selector bahasa.
- Checkpoint LIVE: login sungguhan, scan sungguhan, kurs sungguhan.

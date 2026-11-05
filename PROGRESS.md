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

- [x] **Fase 0 — Fondasi** (2026-11-05), direvisi ke "Kaca & Aksen" (2026-11-05) — **menunggu persetujuan ulang**
- [ ] Fase 1 — UI layar inti dengan data dummy
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

## Cara menjalankan

```bash
npm ci
npm run web          # buka http://localhost:8081/design
npm start            # Expo Go / dev build
npm run verify       # typecheck + test + export web/android/ios
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

## Untuk Fase 1 (setelah disetujui)

- Ganti `src/app/index.tsx` (redirect) dengan alur onboarding → setup → tab.
- Layar Pengaturan memakai `AccentPicker` (sudah jadi).
- i18n (ID/MS/TR/EN) belum dipasang.
- Lembar Desain dipindah ke rute khusus dev (`__DEV__`).
- Visual check: verifikasi hierarki kaca tiap layar (lihat override R-10).

# PROGRESS — Arshif Rebuild

Ringkasan untuk melanjutkan di sesi baru. Sumber kebenaran: `docs/arshif-prd.md` (PRD acuan) + `docs/arshif-fitur-lengkap-prd.md` (cek silang) + `docs/arshif-starter-prompt-rebuild-claude.md` (aturan kerja).

## Keputusan slot (dijawab Ahmad, 2026-11-05)

| Slot | Jawaban |
|---|---|
| Stack | Expo (SDK 58, Expo Router, TS strict) + Supabase |
| Tone | Premium |
| Tema | Dark + light (ikut sistem, bisa dipaksa) |
| Referensi visual | Tidak ada. Lembar Desain Fase 0 (`/design`) jadi pembanding visual check Fase 1; standar 99% tidak berlaku |
| Cakupan layar v1 | Inti dulu: Home, Transaksi, Tambah (Capture), Anggaran, Coach, Pengaturan |

Keputusan terkunci lain (Stripe dilarang, Paddle web global, Worthful/Belanje adopsi, dll.) ada di Lampiran PRD.

## Status fase

- [x] **Fase 0 — Fondasi** (2026-11-05) — menunggu persetujuan Lembar Desain
- [ ] Fase 1 — UI layar inti dengan data dummy
- [ ] Fase 2 — Backend Supabase (LIVE: login, scan, kurs sungguhan)
- [ ] Fase 3 — Monetisasi (RevenueCat + Xendit + Paddle) & rilis

## Fase 0 — yang sudah ada

- **Identitas "Tinta & Kuningan"**: `src/theme/tokens.ts` — palet dark/light, warna kategori, radius (6/10/14/20/28/full), spasi 4-pt, tipografi (Fraunces judul, Plus Jakarta Sans UI + angka tabular), gerak 150–300ms.
- **Theme**: `src/theme/ThemeProvider.tsx` (system/dark/light), `src/theme/motion.ts` (reduced-motion aware + haptic).
- **Lib**: `src/lib/money.ts` (integer minor units, format deterministik Rp/RM/₺/$, parse input, konversi kurs BigInt tanpa float), `src/lib/chart.ts` (geometri grafik), `src/lib/contrast.ts` (WCAG).
- **Komponen** (`src/components/ui/`, semua ≤ ~200 baris): Button, Card, Input, AmountInput, CurrencyText, Badge/ProBadge, Chip, ProgressBar, DonutChart (+DonutLegend), HealthGauge, CashflowChart (+CashflowSummary), BottomSheet, Dialog, Tabs, Skeleton/SkeletonText, EmptyState (empty/error/limit/offline), Toast (Provider + useToast), ListItem/ListItemSkeleton, CategoryIcon, plus primitif AppText, PressableScale, Icon.
- **Kategori bawaan**: `src/constants/categories.ts` (21 kategori → bucket 50/30/20).
- **Lembar Desain**: rute `/design` (`src/app/design.tsx` + `src/features/design-sheet/`). `/` redirect ke `/design` selama Fase 0.
- **Test** (154): kontras AA semua token (dark+light), money, chart, render komponen.

## Cara menjalankan

```bash
npm ci
npm run web          # buka http://localhost:8081/design
npm start            # Expo Go / dev build
npm run verify       # typecheck + test + export web/android/ios
```

## Catatan teknis penting (jangan diulang)

- **NativeWind TIDAK dipakai** (PRD Bab 10 merekomendasikan): v4 belum resmi mendukung Reanimated 4/SDK 58, v5 masih RC. Styling pakai `StyleSheet` + token bertipe.
- **TypeScript 6** tidak auto-load `@types/*` → `tsconfig.json` punya `"types": ["jest"]`.
- **Jest**: mock Reanimated minimal di `jest.setup.ts` (mock resmi Reanimated 4 gagal di jest-expo). Jika komponen memakai API Reanimated baru, tambahkan di mock. `lucide-react-native` dipetakan ke build CJS. RNTL v14: `render`/`fireEvent` async → selalu `await`.
- **Mesin dev aarch64**: `hermesc` dari npm hanya x86-64 → export Android/iOS lokal pakai `--no-bytecode`. Bytecode Hermes dikompilasi di EAS Build.
- `expo-asset` dan `query-string` ada eksplisit di `dependencies` (cacat build lama).
- `PressableScale`: gaya layout (flex) untuk slot di dalam baris → prop `containerStyle`, bukan `style`.
- Teks nominal di web tidak bisa auto-shrink (`adjustsFontSizeToFit` hanya native) → desain tata letak agar nominal tidak terpotong (lihat CashflowSummary).
- Bundle id sementara: `app.arshif` (asumsi, ganti bila perlu).
- Ikon aplikasi & splash masih aset default Expo — diganti di Fase 1/3.

## Untuk Fase 1 (setelah disetujui)

- Ganti `src/app/index.tsx` (redirect) dengan alur onboarding → setup → tab.
- i18n (ID/MS/TR/EN) belum dipasang — mulai di Fase 1.
- Kartu akun per bank (warna khas + nama bank, tanpa logo) — token bank belum dibuat.
- Lembar Desain dipindah ke rute khusus dev (`__DEV__`) agar tidak ikut rilis.

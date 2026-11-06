# Fase 8: admin web (PRD FR-ADM-1..4)

Status: dibangun dan diuji lokal. Live: hanya secret `APP_URL` dan penanda admin untuk hafizhxcv@gmail.com.
**Belum di-deploy**: migrasi 14, Edge Functions (`admin-user`, `fx-sync`, `entitlement-sync`), dan web Vercel.

## Host: Vercel, proyek arshifstudio

Diputuskan Ahmad 2026-11-06. Admin web, `/harga`, dan checkout web tinggal di Vercel.

- `APP_URL` = `https://arshifstudio.vercel.app` (sudah diset sebagai secret Supabase). Kalau nanti ada custom domain,
  ganti: `npx supabase secrets set APP_URL=https://domainmu`.
- `vercel.json` di repo hanya berisi rewrite SPA (`/(.*)` -> `/index.html`). Ekspor web Expo `output: single` hanya
  menghasilkan `index.html`, jadi tanpa rewrite `/admin` dan `/harga` menjawab 404 di Vercel. File statis tetap
  dilayani lebih dulu.
- Pengaturan proyek di dashboard Vercel (langkah pemilik; sesi ini tidak punya token Vercel):

  | Pengaturan | Nilai |
  |---|---|
  | Framework Preset | Other |
  | Root Directory | `./` (root repo) |
  | Install Command | `npm ci` (lockfile npm; tambah `--legacy-peer-deps` hanya kalau build gagal karena peer dependency) |
  | Build Command | `npx expo export --platform web` |
  | Output Directory | `dist` |
  | Env (Production + Preview) | `EXPO_PUBLIC_SUPABASE_URL=https://gyxtdpmruuhhkprlhlrk.supabase.co`, `EXPO_PUBLIC_SUPABASE_ANON_KEY=` kunci publishable dari `src/config/public.ts` |

  Kedua env bersifat publik (publishable key). Tanpa env pun build memakai nilai bawaan di `src/config/public.ts`.
  Aplikasi menerima `EXPO_PUBLIC_SUPABASE_KEY` maupun `EXPO_PUBLIC_SUPABASE_ANON_KEY`.

## Urutan deploy (setelah izin pemilik)

1. `SUPABASE_ACCESS_TOKEN=... ./scripts/deploy-supabase.sh` (menerapkan migrasi 14 dan semua function).
2. Hapus function lama yang sudah diganti `admin-user`: `npx supabase functions delete admin-grant`.
3. Push ke `main` -> Vercel build (setelah pengaturan dashboard di atas).

Migrasi harus lebih dulu dari web. Web yang lebih baru tetap aman di atas skema lama (layar ditangguhkan memakai
cek truthy, panggilan `touch_last_seen` gagal diam-diam), tapi panel admin baru butuh RPC migrasi 14.

## Yang dibangun

**Migrasi 14** `20261112000014_admin.sql`:
- `profiles.last_seen_at`, `profiles.suspended_at` (tidak bisa ditulis klien).
- `user_activity_days` (user, hari WIB): satu baris per pengguna per hari. RPC `touch_last_seen()` dipanggil
  aplikasi saat data dimuat dan saat kembali aktif; `last_seen_at` ditulis paling sering 1x per 10 menit.
  **DAU** = jumlah baris hari ini. Pencatatan baru mulai saat migrasi 14 diterapkan, jadi hari sebelumnya kosong.
- `fx_sync_runs`: log setiap sinkron kurs (cron atau admin), dibaca panel.
- RPC admin (semua `assert_admin()`): `admin_dashboard`, `admin_search_users`, `admin_user_detail`,
  `admin_fx_status`, `admin_broadcast`, `admin_broadcast_count`. Tabel baru tanpa akses klien sama sekali.
- Broadcast memakai kunci i18n `domain.notif.broadcastTitle/Message` yang isinya `{title}` / `{message}`, jadi
  tidak perlu kolom baru di `notifications`. Akun yang ditangguhkan dilewati.

**Edge Functions**:
- `admin-user` (pengganti `admin-grant`): `grant`, `revoke`, `suspend`, `unsuspend`. Suspend = ban Supabase Auth
  (login baru dan refresh token ditolak) + `suspended_at`; aplikasi menampilkan layar "Akun ditangguhkan".
  Token akses yang sudah terbit tetap berlaku sampai kedaluwarsa (maks. 1 jam), layar tetap menahan akses.
  Akun admin tidak bisa ditangguhkan dari panel.
- **Grant tanpa RevenueCat**: selama `RC_SECRET_KEY`/`RC_PROJECT_ID`/`RC_ENTITLEMENT_ID` kosong, masa Premium
  dihitung dari pesanan lunas di `orders` (grant manual). Begitu kunci diisi, jalur RevenueCat dipakai lagi.
  Cron `entitlement-sync` sekarang tetap jalan tanpa kunci (Premium kedaluwarsa diturunkan ke Free).
  Catatan: Premium hafizhxcv@gmail.com saat ini (sampai 6 Des 2026, sumber manual) dibuat langsung lewat SQL tanpa
  pesanan. Akan turun ke Free saat lewat tanggalnya, atau lebih cepat bila pemiliknya diberi/dicabut grant lewat
  panel. Beri grant lewat panel kalau ingin tercatat.
- `fx-sync` menerima token admin (tombol "Sinkronkan sekarang") selain secret cron, dan mencatat ke `fx_sync_runs`.

**Web** `/admin` (rute di luar gerbang onboarding, `Redirect` ke Home di iOS/Android, tombol Admin di Pengaturan
hanya muncul di web untuk admin). Teks Bahasa Indonesia saja (`src/features/admin/copy.ts`).
Bagian (di URL `?bagian=`): Dasbor, Pengguna, Log AI, Pesanan, Kurs, Broadcast. Setiap bagian punya keadaan muat,
gagal (dengan Coba lagi), dan kosong. Belum login: ajakan masuk, kembali ke `/admin` setelah kode OTP.

**Estimasi pendapatan**: jumlah pesanan web lunas (Xendit + Paddle) bulan berjalan per mata uang. Pendapatan toko
dari RevenueCat belum terhubung (kunci kosong), panel menyebutkannya, tidak menebak angka.

## Uji

- `npm run test:db`: +4 skenario admin (RPC ditolak non-admin, tabel admin tertutup, DAU sekali per hari, wildcard
  pencarian di-escape, broadcast segmen + lewati akun ditangguhkan, log kurs).
- `npm run e2e:web`: langkah "Admin: ..." (tanpa login, dasbor, grant + cabut di pengguna uji, tangguhkan + layar
  ditangguhkan + pulihkan, log AI, pesanan kosong, sinkron kurs, broadcast sampai di lonceng) dan "Premium web USD".
  Langkah admin login sebagai `E2E_ADMIN_EMAIL` (bawaan hafizhxcv@gmail.com) lewat `generateLink` admin API,
  tanpa email terkirim.

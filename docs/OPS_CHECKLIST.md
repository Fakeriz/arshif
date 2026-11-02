# Checklist operasional yang belum bisa dikerjakan dari repo

Empat hal di bawah butuh akses dashboard/akun, bukan kode. Kodenya sudah siap;
yang kurang hanya nilai env dan satu secret di database.

## 1. NEXT_PUBLIC_SITE_URL (Vercel)

Tanpa env ini `metadataBase` jatuh ke `https://arshif.biz.id` (lihat
`app/layout.js`), jadi link OG/share tetap benar selama domain produksinya itu.
Isi env kalau domainnya berbeda:

- Vercel → Project `arshif` → Settings → Environment Variables
- Key `NEXT_PUBLIC_SITE_URL`, value `https://arshif.biz.id`, centang Production
- Redeploy

Cek hasil: buka halaman utama, lihat `og:url` di view-source, harus domain
produksi, bukan localhost.

## 2. TELEGRAM_WEBHOOK_SECRET (Supabase Vault)

`app/api/telegram-webhook-user/route.js` mengembalikan 503 bila secret ini
kosong, dan 401 bila header tidak cocok. Trigger pendaftaran user di Supabase
membacanya dari Vault.

1. Supabase → Project → Settings → Vault → New secret
2. Name `TELEGRAM_WEBHOOK_SECRET`, value string acak 32+ karakter
3. Simpan nilai yang sama di Vercel Environment Variables (Production)
4. Pastikan trigger `notify_new_user` mengirim header
   `x-telegram-webhook-secret` dengan nilai tersebut
5. Redeploy Vercel

Verifikasi: daftar akun baru di production, pesan Telegram harus masuk. Kalau
tidak masuk, cek log function dan pastikan header terkirim.

## 3. Sentry (opsional)

`instrumentation.js` (server) dan `app/providers.js` (client) hanya aktif bila
DSN ada. Tanpa DSN aplikasi jalan normal, hanya tidak ada laporan error.

- sentry.io → Create Project (Next.js) → Settings → Client Keys (DSN)
- Vercel: `NEXT_PUBLIC_SENTRY_DSN` (Production + Preview), redeploy
- Server: tambahkan `SENTRY_DSN` bila ingin DSN terpisah dari client

## 4. Email support@arshif.biz.id

Butuh mailbox aktif dan DNS (MX/SPF/DKIM) di domain. Setelah aktif, perbarui
alamat di `lib/i18n.js` (kunci `support_email` / teks bantuan) dan halaman
legal, lalu redeploy.

## Yang sudah otomatis

- Cron backup harian: `scripts/db-backup-cron.js`, retensi 7 hari, panduan di
  `docs/DB_BACKUP.md`.
- CI: `.github/workflows/ci.yml` (node check, test, build) dengan env
  placeholder, tidak butuh secret repo.
- Splash, bahasa default `id`, mata uang `IDR`: sudah di kode.

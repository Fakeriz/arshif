# Sentry di Vercel (opsional)

Error monitoring Sentry **mati secara default**. Aplikasi aman jalan tanpa
env ini — kode melakukan lazy init dan guard bila DSN tidak diset
(`app/providers.js` return awal bila `dsn` kosong; `app/layout.js` hanya
menyuntik `window.__SENTRY_DSN__` bila env ada).

## Menyalakan Sentry

1. Buat project di [sentry.io](https://sentry.io) (platform: Next.js),
   salin **Public DSN** (format `https://***@o0.ingest.sentry.io/0`).
2. Di dashboard Vercel: **Project → Settings → Environment Variables**,
   tambahkan:
   - Key: `NEXT_PUBLIC_SENTRY_DSN`
   - Value: DSN dari langkah 1
   - Environments: centang **Production** (opsional: Preview), lalu **Save**.
3. Redeploy (**Deployments → Redeploy**) agar env terbaca saat build —
   `app/layout.js` membaca env ini di server saat render.

## Cakupan

- Client: `app/providers.js` (lazy init, hanya bila DSN ada).
- Server: `instrumentation.js` — `register()` untuk route handler/server
  component dan `onRequestError()` untuk error yang lolos dari error boundary.
  Keduanya membaca `SENTRY_DSN` (atau `NEXT_PUBLIC_SENTRY_DSN` sebagai
  fallback) dan langsung berhenti bila tidak diset.

## Mematikan kembali

Hapus variable di atas lalu redeploy. Tanpa DSN tidak ada request keluar
ke Sentry dan tidak ada error di console.

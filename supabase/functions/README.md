# Edge Functions Arshif

| Function | Pemicu | Kuota | Catatan |
|---|---|---|---|
| `scan-receipt` | klien (token pengguna) | `scan` | foto dari bucket `receipts`, maks 8 MB |
| `voice-log` | klien | `automation` | audio base64 inline, maks 60 detik |
| `import-statement` | klien | `importPdf` | PDF dari bucket `statements`, dihapus setelah diproses |
| `coach` | klien | tanpa kuota (rate limit) | hanya ringkasan angka, di-cache per minggu + bahasa |
| `fx-sync` | pg_cron (`x-cron-secret`) atau admin (token, `admin_users`) | - | Frankfurter/ECB, backfill 365 hari bila riwayat < 30 hari; tiap percobaan dicatat di `fx_sync_runs` |
| `asset-prices-sync` | pg_cron tiap jam (`x-cron-secret`) atau admin | - | harga aset live per kunci netral (`IDX:BBCA`, `US:AAPL`, `CRYPTO:BTC`, `GOLD:XAU`) ke `asset_prices`; satu kode gagal tidak menggagalkan yang lain; tiap percobaan dicatat di `asset_price_runs`. Penyedia harga belum dipasang (`no_provider`) |
| `delete-account` | klien | - | hapus storage + pengguna Auth (cascade) |
| `checkout-create` | klien | maks 5 pesanan/10 menit | harga dari tabel `prices`; IDR/MYR -> Xendit Invoice, USD -> transaksi Paddle |
| `xendit-webhook` | Xendit (`x-callback-token`) | - | invoice PAID/SETTLED/EXPIRED, `refund.succeeded`; idempoten |
| `paddle-webhook` | Paddle (`Paddle-Signature`, HMAC) | - | transaction.completed/paid/payment_failed, refund (adjustment); idempoten |
| `revenuecat-webhook` | RevenueCat (`Authorization`) | - | siapa pun yang berubah -> `syncPlan` dari REST API; idempoten |
| `entitlement-sync` | klien (6/menit) atau pg_cron | - | cocokkan paket dengan RevenueCat (tanpa kunci: dengan pesanan lunas); cron: Premium kedaluwarsa + grant gagal |
| `admin-user` | klien, hanya `admin_users` | - | grant Premium manual (pesanan `manual`), cabut grant manual, tangguhkan/pulihkan akun (ban Auth + `profiles.suspended_at`) |

Aturan bersama (`_shared/guard.ts`): rate limit 10 permintaan AI/menit/pengguna, kuota diambil atomik
sebelum AI dipanggil dan dikembalikan bila gagal, setiap percobaan dicatat di `ai_jobs`.

`verify_jwt = false` untuk semua function (kunci format baru tidak didukung verifikasi bawaan);
token diverifikasi di kode lewat `requireUser` (`auth.getUser`).

## Secret

```bash
npx supabase secrets set GEMINI_API_KEY=...     # Google AI Studio
npx supabase secrets set CRON_SECRET=...        # acak, sama dengan secret Vault `cron_secret`
```

`SUPABASE_URL` dan `SUPABASE_SECRET_KEYS` disediakan otomatis oleh platform.

Pembayaran (Fase 3). Nilai TIDAK ditulis di repo; daftar lengkap + asal tiap kunci di `docs/fase3-pembayaran.md`:

```bash
npx supabase secrets set RC_SECRET_KEY=... RC_PROJECT_ID=... RC_ENTITLEMENT_ID=... RC_WEBHOOK_AUTH=...
npx supabase secrets set XENDIT_SECRET_KEY=... XENDIT_CALLBACK_TOKEN=...
npx supabase secrets set PADDLE_API_KEY=... PADDLE_WEBHOOK_SECRET=... PADDLE_PRICE_MONTHLY=... PADDLE_PRICE_YEARLY=...
npx supabase secrets set APP_URL=https://<domain web aplikasi>
# PADDLE_ENV tidak diset = sandbox. production hanya setelah izin pemilik.
```

Function pembayaran menjawab `503 not_configured` (bukan 500) selama kunci penyedia belum diset.

## Deploy

```bash
export SUPABASE_ACCESS_TOKEN=...
npx supabase link --project-ref gyxtdpmruuhhkprlhlrk
npx supabase db push
npx supabase functions deploy --use-api   # tanpa Docker: bundling di server
```

## Uji

- `npx tsc -p supabase/functions`: typecheck function (deklarasi Deno minimal di `deno.d.ts`).
- `npx jest src/__tests__/edge-shared.test.ts`: helper murni (konversi nominal, normalisasi keluaran AI, kontrak).
- `npx jest src/__tests__/billing.test.ts`: verifikasi webhook (HMAC Paddle, token), transisi status pesanan, perpanjangan masa Premium.
- `npm run test:db`: kuota harian/total/fitur, trigger batas generik, pesanan hanya dibaca pemiliknya, RPC admin.

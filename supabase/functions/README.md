# Edge Functions Arshif

| Function | Pemicu | Kuota | Catatan |
|---|---|---|---|
| `scan-receipt` | klien (token pengguna) | `scan` | foto dari bucket `receipts`, maks 8 MB |
| `voice-log` | klien | `automation` | audio base64 inline, maks 60 detik |
| `import-statement` | klien | `importPdf` | PDF dari bucket `statements`, dihapus setelah diproses |
| `coach` | klien | tanpa kuota (rate limit) | hanya ringkasan angka, di-cache per minggu + bahasa |
| `fx-sync` | pg_cron (`x-cron-secret`) | - | Frankfurter/ECB, backfill 365 hari bila riwayat < 30 hari |
| `delete-account` | klien | - | hapus storage + pengguna Auth (cascade) |

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

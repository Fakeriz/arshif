# Playbook Operasional & Guardrails Backend Arshif

Panduan ringkas operasional backend Arshif (Supabase Postgres 17 + Deno Edge Functions + pg_cron + Vercel + Expo) mengikuti **Mbak Sari Production Playbook (`vibecoder-backend`)**.

---

## 1. Posisi Tangga Adopsi (Right-Sizing)

Arshif berjalan sebagai **Serverless Modular Monolith** di atas Supabase + Vercel. Hindari over-engineering:

| Komponen | Status Saat Ini | Syarat Baru Perlu Naik Level |
| :--- | :--- | :--- |
| **PostgreSQL 17 (Supabase)** | Aktif: RLS per `user_id`, advisory lock, `lock_timeout = 3s`, urutan lock UUID ascending (`ORDER BY x ASC`), idempotency table, PGlite CI tests. | Pertimbangkan Read Replica atau PgBouncer tuning bila QPS baca tinggi (>10k req/min) dan CPU DB > 70% terus-menerus. |
| **Edge Functions (Deno)** | Aktif: stateless, correlation ID (`X-Request-ID`), log JSON teredaksi, rate limit PostgreSQL (`edge_rate_limits`), in-process singleflight + jitter di `symbol-search`. | Gunakan Redis (Upstash) hanya jika `symbol-search` atau rate limit antar region butuh shared hot cache > 5.000 RPS. |
| **Job Asinkron (`pg_cron` + `pg_net`)** | Aktif: `fx-sync`, `asset-prices-sync`, `entitlement-sync`, `planning-reminders`, dan cleanup harian (`webhook_events`, `idempotency_keys`, `edge_rate_limits`, `sync_runs`). | Pisahkan worker queue khusus (Transactional Outbox + worker terpisah) bila ada pemrosesan dokumen/PDF massal paralel > 30 detik. |
| **Container / Kubernetes** | **Ditunda secara sadar.** Tidak dibutuhkan selama runtime dijalankan Supabase Edge + Vercel. | Hanya pertimbangkan Cloud Run atau K8s bila berpindah dari Supabase Edge/Vercel dengan trafik > 50k req/min dan tim ops khusus. |

---

## 2. Aturan Migrasi Zero-Downtime (Expand-Contract)

Karena aplikasi mobile (`iOS`/`Android`) tidak bisa dipaksa update dalam hitungan detik:

1. **Additive First:** Tambahkan kolom baru sebagai nullable atau dengan `DEFAULT`, jangan langsung mengubah kontrak kolom lama yang masih dibaca klien `N-1`.
2. **Dilarang `DROP COLUMN` / `RENAME COLUMN` langsung** ke traffic aktif. Gunakan pola **Expand -> Migrate -> Contract** minimal 1-2 rilis terpisah setelah versi klien lama pensiun.
3. **Index di Tabel Besar Production:** Gunakan `CREATE INDEX CONCURRENTLY IF NOT EXISTS ...` agar tidak mengunci operasi tulis (`INSERT`/`UPDATE`).
   - Letakkan `-- no-transaction` **persis di baris pertama** file migrasi `.sql` tersebut agar [scripts/deploy-supabase.sh](file:///home/ubuntu/arshif-src/repo/scripts/deploy-supabase.sh) menjalankannya di luar blok `BEGIN; ... COMMIT;`.

---

## 3. Backup 3-2-1 & Latihan Restore Triwulanan (RPO / RTO)

> *Backup yang tidak pernah diuji hanyalah harapan.*

- **Target Pemulihan:**
  - **RPO (Max Data Loss):** <= 24 jam (snapshot harian; <= 5 menit jika PITR Supabase aktif).
  - **RTO (Max Downtime):** <= 60 menit.
- **Lapisan Backup:**
  1. Otomatis harian/PITR di proyek Supabase (`db_backups`).
  2. Export terenkripsi pengguna akhir (`.arshif` AES-256-GCM lewat menu Pengaturan -> Cadangan) ke penyimpanan pengguna / Google Drive.
  3. Snapshot manual terenkripsi sebelum migrasi berisiko tinggi ke object storage terpisah (S3/R2).
- **Latihan Restore Triwulanan (Drill Checklist):**
  1. Dump database staging/prod tanpa secret ke arsip terkompresi:
     ```bash
     pg_dump "$SUPABASE_DB_URL" --format=custom --no-owner --no-acl -f arshif-drill.dump
     ```
  2. Siapkan database latihan lokal / proyek staging bersih, lalu uji restore:
     ```bash
     createdb arshif_restore_drill
     pg_restore --no-owner --no-acl -d arshif_restore_drill arshif-drill.dump
     ```
  3. Verifikasi hitungan baris tabel inti (`profiles`, `accounts`, `transactions`, `orders`, `invoices`, `idempotency_keys`) dan hapus `arshif-drill.dump` setelah selesai.
  4. Catat tanggal drill, durasi aktual (`RTO`), dan deviasi yang ditemukan.

---

## 4. SOP Darurat Secret Bocor

Jika secret pernah ter-commit ke Git atau bocor lewat log/peramban (menghapus commit Git saja **tidak** cukup karena bot menyalin commit dalam hitungan detik):

1. **Revoke & Rotate segera** di dashboard masing-masing penyedia:
   - `SUPABASE_SECRET_KEYS` / `SUPABASE_SERVICE_ROLE_KEY` & `SUPABASE_ACCESS_TOKEN`
   - `GEMINI_API_KEY`, `GOOGLE_MAPS_API_KEY`
   - `XENDIT_SECRET_KEY`, `XENDIT_CALLBACK_TOKEN`
   - `PADDLE_API_KEY`, `PADDLE_WEBHOOK_SECRET`
   - `RC_SECRET_KEY`, `RC_WEBHOOK_AUTH`
   - `CRON_SECRET` (wajib sinkron di **Edge secrets** dan **Supabase Vault `cron_secret`**)
2. **Simpan ulang lewat `npx supabase secrets set` & GitHub Environments (`production`)**.
3. **Audit log & tagihan penyedia** selama jendela paparan (pesanan mencurigakan di `public.orders`, lonjakan `public.ai_jobs`, dan usage Gemini/Maps/Xendit).

---

## 5. Runbook Triage Jam 2 Pagi

### A. Cek Kesehatan Service (Uptime & Deploy)
- **Liveness (apakah runtime Edge hidup?):**
  ```bash
  curl -i "https://gyxtdpmruuhhkprlhlrk.supabase.co/functions/v1/health?check=live"
  ```
- **Readiness (apakah env inti + PostgreSQL sehat < 2 detik?):**
  ```bash
  curl -i "https://gyxtdpmruuhhkprlhlrk.supabase.co/functions/v1/health?check=ready"
  ```
  Status `503` dengan `"db": "timeout"` atau `"env": "missing"` menandakan masalah konektivitas DB/konfigurasi.

### B. Lacak Satu Request Pengguna (`X-Request-ID`)
1. Klien otomatis mengirim `X-Request-ID` pada setiap `invokeFn()` dan menyimpannya di `FnError.requestId`.
2. Cari JSON log Edge Function memakai `requestId` tersebut di Supabase Dashboard -> Edge Functions Logs.
3. Semua `Authorization`, token, email, dan `audio`/base64 sudah ter-redaksi sebagai `[REDACTED]`.

### C. Triage Pembayaran & Grant Premium Gagal
- Cek pesanan lunas yang masih menunggu retry grant atau ditandai `partial_refund` / `amount_mismatch` / `price_mismatch`:
  ```sql
  select id, user_id, provider, status, grant_error, granted_until, created_at
  from public.orders
  where grant_error is not null
  order by created_at desc
  limit 50;
  ```
- Cek antrean `idempotency_keys` atau `webhook_events` yang belum selesai (`processed_at is null`):
  ```sql
  select provider, event_id, claimed_at, processed_at
  from public.webhook_events
  where processed_at is null
  order by claimed_at desc
  limit 50;
  ```
- Cron `entitlement-sync` berjalan otomatis setiap jam di menit `:20` untuk mencoba ulang grant pesanan yang tertahan sementara akibat RevenueCat 5xx.

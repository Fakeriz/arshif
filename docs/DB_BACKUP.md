# DB Backup Cron (Supabase)

Backup harian tabel utama ke folder `backups/` dengan rotasi 7 hari.

## Cara kerja

`scripts/db-backup-cron.js` punya dua mode:

- Mode bawaan (REST): baca tiap tabel lewat Supabase REST API pakai
  `SUPABASE_SERVICE_ROLE_KEY`, simpan satu file JSON per tabel.
  Tidak butuh `pg_dump`, cocok untuk cron di VPS apa pun.
- Mode `--pg`: `pg_dump --data-only` lewat `DATABASE_URL`,
  hasil satu file `dump.sql`. Dipakai kalau butuh snapshot SQL penuh.

Setiap jalan, script membuat folder `backups/backup-YYYYMMDD-HHMM/`
berisi file data plus `manifest.json`, lalu menghapus folder backup
yang umurnya lewat `BACKUP_RETENTION_DAYS` (bawaan 7).

## Setup cron

1. Isi env di server (jangan commit):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=server-only-service-role-key
# Khusus mode --pg:
DATABASE_URL=postgresql://postgres:password@db.your-project.supabase.co:5432/postgres
# Opsional:
BACKUP_DIR=/var/backups/arshif
BACKUP_RETENTION_DAYS=7
```

2. Pasang cron harian jam 02:00:

```cron
0 2 * * * cd /path/ke/arshif && /usr/bin/node scripts/db-backup-cron.js >> /var/log/arshif-backup.log 2>&1
```

Untuk mode SQL penuh, tambah flag `--pg` (pastikan `pg_dump` terinstal):

```cron
0 2 * * * cd /path/ke/arshif && /usr/bin/node scripts/db-backup-cron.js --pg >> /var/log/arshif-backup.log 2>&1
```

3. Verifikasi jalan pertama manual:

```bash
node scripts/db-backup-cron.js
ls backups/
```

## Restore

Mode REST: tiap `<tabel>.json` adalah array baris. Insert ulang via
Supabase SQL Editor atau script, contoh untuk satu tabel:

```sql
-- Buat baris baru dari JSON (id lama ikut jika masih unik,
-- atau buang kolom id/user ulang sesuai kebutuhan)
```

Cara paling aman: baca file JSON lalu insert per baris lewat
service_role client, dengan `user_id` asli tetap dipertahankan.
Jangan restore ke database produksi tanpa snapshot dulu.

Mode `--pg`: restore file `dump.sql` ke database kosong/baru:

```bash
psql "$DATABASE_URL_BARU" < backups/backup-YYYYMMDD-HHMM/dump.sql
```

## Catatan

- Folder `backups/` berisi data produksi, jangan commit ke git.
- Service role key hanya dipakai server side, jangan taruh di env `NEXT_PUBLIC_*`.
- Untuk backup otomatis terkelola (point in time recovery),
  aktifkan juga fitur backup bawaan di dashboard Supabase.

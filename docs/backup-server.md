# Backup harian DB di server tailscale

Server: `b76840424dd8` (tailscale `100.100.73.73`, Ubuntu 24.04, 8 core, 23 GB RAM).
Dipilih karena idle dan punya 25 GB free; akses lewat tailscale SSH, tanpa kunci
yang disimpan di repo.

## Yang sudah terpasang

| Komponen | Lokasi | Catatan |
| --- | --- | --- |
| Repo | `/srv/arshif` | clone dari `github.com/Fakeriz/arshif`, `git pull --ff-only` tiap jalan |
| Kredensial | `/srv/backups/arshif/.env` | `chmod 600`, hanya 2 variabel + `BACKUP_DIR` + retensi |
| Output backup | `/srv/backups/arshif/backup-YYYYMMDD-HHMM/` | satu folder per run, satu file JSON per tabel + `manifest.json` |
| Wrapper | `/usr/local/bin/arshif-backup.sh` | flock (satu instance), cek disk >= 1 GB, log |
| Cron | `0 16 * * *` (00:00 MYT) | cron diinstall manual, `service cron start` |
| Log | `/var/log/arshif-backup.log` | append; baris `OK:`/`FAIL:` per run |
| Penanda sukses | `/srv/backups/arshif/last-success` | timestamp ISO, untuk monitoring |

Retensi default 14 hari, dipotong oleh `prune()` di script (hanya folder
berpola `backup-YYYYMMDD-HHMM`).

## Status: BELUM AKTIF

Backup **belum pernah sukses** karena kredensial asli tidak ada di mesin dev:
`.env.local` repo berisi placeholder (`http://localhost:9999`), dan
`SUPABASE_ACCESS_TOKEN` untuk Management API juga tidak tersedia di sana.
Guard `envCredential()` menolak placeholder, jadi run pertama gagal dengan
pesan jelas alih-alih menghasilkan backup 0 baris.

Untuk mengaktifkan, jalankan sekali (dari mesin yang punya kredensial):

```bash
ssh root@100.100.73.73
cat > /srv/backups/arshif/.env <<'ENV'
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
BACKUP_DIR=/srv/backups/arshif
BACKUP_RETENTION_DAYS=14
ENV
chmod 600 /srv/backups/arshif/.env
/usr/local/bin/arshif-backup.sh && tail -3 /var/log/arshif-backup.log
```

Alternatif lebih lengkap (schema + fungsi, bukan hanya data): set
`DATABASE_URL` di file env yang sama lalu jalankan
`node scripts/db-backup-cron.js --pg`. `pg_dump` 16 sudah terpasang.

## Yang sudah diverifikasi

- Paginasi REST: tabel uji 2500 baris terbaca penuh dalam 3 halaman
  (`transactions-0` … `transactions-2499`), 38 file output, manifest 37 tabel.
- Prune: folder > retensi dihapus, folder non-backup tidak disentuh (test).
- Guard: URL `localhost` / key placeholder ditolak sebelum menulis apa pun.
- Wrapper: `flock` mencegah tumpang tindih, disk < 1 GB membatalkan run.
- `pg_dump` tersedia untuk mode `--pg`.

Verifikasi diulang dengan mock Supabase lokal (`scripts/mock-supabase.mjs`),
bukan data prod, supaya tidak perlu kredensial asli untuk menguji jalur ini.

## Catatan

- Script memakai REST `select=*` per tabel; kolom JSON besar (mis. `items`,
  `receipt_cache`) ikut terbawa, jadi ukuran backup bisa melebihi ukuran logis.
- Service role key hanya ada di server ini dan Vercel. Kalau server ini
  di-rebuild, env harus diisi ulang.
- Kalau butuh notifikasi gagal, tambahkan hook di wrapper: baris `FAIL:` sudah
  cukup untuk dipanen oleh monitor apa pun.

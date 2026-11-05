# Fase 4: Planning hub

Status: dibangun dan diuji lokal. **Belum di-deploy** (menunggu izin pemilik).

Tab Anggaran = Planning hub. Konten anggaran tetap di atas, di bawahnya entri ke Goals, Tagihan, Utang & piutang,
Langganan, dan Split bill (`src/features/planning/PlanningEntries.tsx`). Logika anggaran tidak diubah.

## Data (migrasi `20261108000008_planning.sql`, jadwal `20261108000009_cron_planning.sql`)

| Tabel | Isi | Ditulis server saja |
|---|---|---|
| `goals`, `goal_deposits` | target, tenggat, akun setoran; riwayat setoran | `collected`, `status`, `completed_at` (trigger setoran) |
| `bills` | nominal, frekuensi, jatuh tempo, hari jangkar | `paid_periods` (daftar tanggal lunas, bukan boolean), `last_paid_tx` |
| `debts`, `debt_payments` | utang/piutang, APR dalam basis poin, cicilan minimum | `balance`, `status` (trigger pembayaran); pembayaran tidak bisa dihapus |
| `subscriptions` | siklus, perpanjangan berikutnya | perpanjangan yang lewat dimajukan cron |
| `split_bills` | item + peserta (jsonb), pajak, service | |

Semua nominal `bigint` unit terkecil. Referensi ke akun/transaksi/goal/utang/split milik orang lain ditolak
(`planning_check_refs`). Tabel baru dicabut dari default privileges Supabase lalu di-grant per kolom.

### Batas Free/Premium

Memakai sistem migrasi 5 (`enforce_total_limit`), tidak dibangun ulang. `count_owned` sekarang hanya menghitung
baris `status = 'active'`: goal tercapai, utang lunas, dan langganan yang dihentikan tidak memakan jatah.

- Goals: Free 3 aktif.
- Tagihan + utang/piutang gabungan: Free 3.
- Langganan: Free 5 aktif (mengaktifkan lagi juga dicek).

Klien: tombol Tambah memakai badge PRO + sheet paywall saat batas tercapai; penolakan server (`quota_*`) juga
dijawab paywall (`QuotaError`).

### Alur yang membuat transaksi

Transaksi disimpan dulu (`commitTx` di AppStore, kurs harian ikut dihitung), baru entitasnya diperbarui:

- Setor goal: pengeluaran kategori Tabungan, lalu `goal_deposits`. Terkumpul >= target = `completed` +
  notifikasi `goal_reached` (trigger) + konfeti di layar.
- Tandai lunas tagihan: pengeluaran, lalu RPC `bill_mark_paid(bill, tx)` (atomik, idempoten per transaksi):
  periode masuk `paid_periods`, jatuh tempo maju sesuai frekuensi (`next_due`, hari jangkar 31 kembali ke 31).
- Bayar utang: pengeluaran kategori Utang; terima piutang: pemasukan. Lalu `debt_payments` (tidak boleh
  melebihi sisa saldo).
- Split bill: tidak ada pembayaran di aplikasi. Peserta ditandai sudah bayar; bagian yang belum bayar bisa dicatat
  sebagai piutang (toggle). Piutang ditutup tanpa transaksi saat peserta ditandai bayar.

## Pengingat (Edge Function `planning-reminders`, cron tiap jam menit ke-5)

SQL `planning_reminders()`: tagihan H-3 dan hari H (hormati pengaturan notifikasi tagihan), langganan H-2. Mulai jam
07.00 waktu lokal pengguna (`profiles.timezone`, diisi aplikasi dari perangkat). `notifications.dedupe_key` membuat
tiap pengingat terkirim sekali. Notifikasi membawa nominal mentah + mata uang dan tanggal ISO; aplikasi
memformatnya di pusat notifikasi.

## Simulator utang

`src/lib/planning/debts.ts`: bunga bulanan = saldo × APR/12 (BigInt, dibulatkan), cicilan minimum ke semua utang,
sisa anggaran (minimum + ekstra, tetap tiap bulan) ke target: Snowball = saldo terkecil, Avalanche = bunga
tertinggi. Dibandingkan dengan bayar minimum saja untuk "bunga yang dihemat". Utang mata uang lain dikonversi ke
mata uang utama dengan kurs terbaru.

## Split bill

`src/lib/planning/split.ts`: rata, atau per item (item dibagi rata ke peserta yang ditetapkan, item tanpa peserta =
pembayar). Selisih total dan jumlah item (pajak, service) dibagi proporsional. Semua sisa pembulatan ke pembayar;
jumlah bagian selalu = total. Dari detail transaksi ("Split bill") item struk terisi otomatis dengan harga bayar
setelah diskon.

## Deploy (setelah izin)

1. Migrasi 8 dan 9 (`scripts/deploy-supabase.sh` menerapkan yang belum ada).
2. Edge Function `planning-reminders`.
3. Aplikasi baru membutuhkan migrasi 8 (tabel Planning, kolom `profiles.timezone`); deploy migrasi dulu.

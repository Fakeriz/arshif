# Fase 6: Invoice & Quotation + Money & Tax Tools

Status: **migrasi 12 live 2026-11-06** (uji asap live dalam transaksi rollback: nomor INV/QUO, jumlah server, kuota,
`quota_taxFull` untuk Free, anon ditolak). PDF di HP menunggu build EAS development baru.

Akses: Home -> aksi cepat **Lainnya** -> "Invoice & penawaran" (`/invoice`) dan "Alat" (`/alat`). Bottom nav tidak
berubah.

## Invoice & penawaran (FR-INV-1, FR-INV-2)

Migrasi `20261110000012_invoices.sql`.

| Bagian | Cara kerja |
|---|---|
| Tabel `invoices` | jenis (`invoice`/`quote`), klien + kontak, tanggal terbit, jatuh tempo / berlaku sampai, mata uang, item jsonb `{name, qty, unitPrice}`, diskon (nominal), pajak (basis poin), catatan |
| Nomor | trigger `invoices_assign_number`: `INV-2026-0001` / `QUO-2026-0001`, per pengguna, per tahun terbit, per jenis. Penghitung `invoice_counters` dikunci lewat upsert, jadi insert bersamaan tidak dapat nomor sama. Insert gagal = penghitung ikut batal (tidak ada nomor terlewat). Nomor tidak berubah saat dokumen diedit. |
| Jumlah | trigger `invoices_compute` menghitung ulang subtotal, pajak, total dari item. Klien tidak bisa menulis kolom jumlah. Rumus sama dengan `src/lib/invoice.ts` (baris = qty x harga, dibulatkan setengah ke atas; pajak dari subtotal setelah diskon). qty boleh 2 desimal (1,5 jam). |
| Status | invoice: Draf -> Terkirim -> Dibayar. Penawaran: Draf -> Terkirim -> Diterima, lalu "Buat invoice dari penawaran ini" (invoice baru, ikut kuota). |
| Dibayar | aplikasi menyimpan transaksi pemasukan dulu (**id transaksi = id invoice**, kategori Freelance & Proyek, sumber `invoice`, mata uang invoice, akun pilihan, kurs harian bila akun beda mata uang), lalu RPC `invoice_mark_paid`. RPC mengunci baris, menolak transaksi yang tidak cocok (bukan pemasukan, nominal/mata uang beda), dan idempoten. Karena id transaksi = id invoice, primary key menolak transaksi kedua. Status Dibayar hanya bisa lewat RPC; invoice Dibayar terkunci. |
| PDF | HTML -> PDF (`expo-print`) -> lembar bagikan (`expo-sharing`), nama berkas `INV-2026-0001.pdf`. Web: dialog cetak browser. |

Batas: Free 5/bulan gabungan invoice + penawaran, Premium tanpa batas. Pakai `enforce_counter_quota('invoice')` dari
migrasi 5 (penghitung bulanan, periode UTC). Hanya yang dibuat di bulan berjalan yang dihitung; menghapus dokumen
tidak mengembalikan jatah. Klien: badge PRO + sheet paywall, penolakan server `quota_invoice` juga dijawab paywall.

## Money & Tax Tools (FR-TAX-1..4)

| Alat | Paket | Catatan |
|---|---|---|
| Konverter mata uang | Free | kurs harian Frankfurter/ECB yang sama dengan saldo (`lib/fx`), tanggal kurs ditampilkan |
| Kalkulator cicilan / KPR | Free | anuitas (KPR) atau flat; cicilan bulanan, cicilan terakhir (pembulatan), total bunga (`lib/loan.ts`) |
| Estimasi pajak penghasilan | Premium | ID / MY / TR, rincian perhitungan + tabel tarif 2026 di layar (`lib/tax/`) |
| Laporan pajak tahunan | Premium | dari transaksi setahun, dikonversi ke mata uang negara pajak, + PDF |
| PDF Export | Premium | laporan bulanan, laporan pajak, riwayat transaksi (rentang tanggal) |

Gerbang Premium: RPC `feature_gate('taxFull' | 'pdfExport')` membaca paket dari `profiles.plan` di server; Free
mendapat `quota_taxFull` / `quota_pdfExport` -> paywall. Layar Premium memanggilnya saat dibuka, tombol PDF memanggilnya
saat diketuk. Kalkulatornya sendiri berjalan di HP (rumus publik), jadi gerbang ini mencegah pemakaian dari aplikasi
resmi, bukan dari klien yang dimodifikasi.

Disclaimer FR-TAX-4 tampil di hub Alat, setiap layar pajak, dan PDF laporan pajak. Pelaporan resmi (e-Filing) tidak ada.

### Tarif yang dipakai (dicek 2026-11-06)

- **Indonesia, PPh 21 pegawai tetap**: Jan sampai Nov = TER bulanan kategori A/B/C (PP 58/2023, PMK 168/2023, tidak
  berubah untuk 2026). Desember = Pasal 17 UU HPP (5/15/25/30/35%) atas PKP setahun: bruto - biaya jabatan (5%, maks
  Rp6 jt) - iuran pensiun/JHT - PTKP (54 jt + 4,5 jt kawin + 4,5 jt per tanggungan, maks 3), dibulatkan ke ribuan.
  Tidak menghitung PPh 21 DTP 2026 (PMK 105/2025) dan bonus/THR.
- **Malaysia, PCB/MTD**: kadar pemastautin YA 2023+ (tidak berubah untuk YA 2026). Pelepasan diri RM9.000, pasangan
  tidak bekerja RM4.000, anak RM2.000, KWSP maks RM4.000; rebat RM400 (+RM400 pasangan) bila bercukai <= RM35.000;
  setahun dibagi 12. Pelepasan lain, zakat, dan bonus tidak dihitung.
- **Turki, Gelir Vergisi gaji**: tarif ücret 2026 190.000 / 400.000 / 1.500.000 / 5.300.000 TL (15/20/27/35/40%),
  kumulatif per bulan. Matrah = brüt - SGK 14% - işsizlik 1% (plafon SGK 9 x asgari ücret, berlaku 2026). Istisna
  asgari ücret (brüt 33.030 TL) per bulan; hasilnya cocok dengan angka resmi 4.211,33 / Juli 4.537,75 / Agustus 5.615,10.
  Damga vergisi tidak termasuk.
- Laporan tahunan memakai estimasi kasar: seluruh pemasukan = penghasilan kena pajak (ID: dikurangi PTKP, Pasal 17;
  MY: dikurangi pelepasan diri; TR: tarif ücret dışı 1.000.000 TL pada lapis ketiga). Tertulis di layar dan PDF.

Contoh hitungan manual ada di `src/__tests__/tools.test.ts` (nilai yang diharapkan ditulis di tes).

## PDF dan development build

`expo-print` modul native baru. **Development build yang terpasang di Xiaomi belum memilikinya**: di build itu tombol
PDF menampilkan "PDF butuh versi aplikasi terbaru" (dicek lewat `requireOptionalNativeModule('ExpoPrint')`, tidak
crash). Bagian lain fase ini hanya JS dan berjalan di dev build lama lewat Metro. Untuk menguji PDF di HP perlu satu
build EAS development baru setelah izin.

## Uji

- `npm run test:db`: penomoran (0001, 0002, QUO terpisah, pengguna lain sendiri, tahun baru, nomor tetap saat edit),
  jumlah dihitung server, Dibayar sekali (transaksi kedua ditolak, saldo naik sekali), Dibayar hanya lewat RPC,
  RLS, kuota Free 5/bulan (ke-6 ditolak, bulan lalu tidak dihitung, Premium tanpa batas), gerbang `feature_gate`.
- `src/__tests__/tools.test.ts`: PPh 21 (2 contoh + lebih potong), PCB (2 contoh), Gelir Vergisi (contoh + istisna
  bulanan resmi), cicilan anuitas/flat, jumlah invoice, escape HTML PDF.
- `src/__tests__/invoice-tools-screens.test.tsx`: tandai Dibayar dua kali = satu transaksi, alur sheet di layar
  detail, paywall batas invoice, gerbang alat pajak Free/Premium, rincian PPh 21 di layar.

## Deploy (setelah izin)

1. Migrasi 12 (`scripts/deploy-supabase.sh` menerapkan yang belum ada). Aplikasi baru butuh migrasi ini (tabel
   `invoices`, sumber transaksi `invoice`).
2. Tidak ada Edge Function baru.
3. Build EAS development baru bila PDF perlu dicoba di HP.

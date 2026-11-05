# Arshif — Product Requirements Document (PRD)

**Status:** Draft v1 — 2026-11-05
**Sumber:** `arshif-fitur-lengkap-prd.md` (inventaris fitur dari PRD asli Bab 1–12) + keputusan yang dikunci Ahmad 2026-11-05.
**Catatan:** dokumen ini DIBUAT sebagai pengganti PRD spechkit — disusun dalam struktur spec (overview → requirements → acceptance criteria → out of scope → open decisions), siap dilampirkan ke Claude Code bersama starter prompt rebuild. Keputusan yang masih terbuka ada di Bab 12 — jangan dianggap sudah diputuskan.

---

## 1. Ringkasan Produk

**Arshif** adalah asisten keuangan pribadi berbasis AI untuk pekerja lintas negara (Indonesia, Malaysia, Turki).

**Janji inti:** mencatat pemasukan/pengeluaran dalam **kurang dari 10 detik** lewat foto struk (OCR), suara (Voice Log), atau rekening koran PDF. AI mengelompokkan transaksi otomatis dan memberi saran keuangan personal.

**Pembeda:** multi-mata uang real-time untuk **IDR, MYR, TRY, USD**.

**Masalah yang diselesaikan:**
1. Mencatat manual melelahkan; kebanyakan orang berhenti setelah 1–2 minggu.
2. Struk belanja menumpuk dan hilang; detail pajak dan item tidak pernah tercatat.
3. Uang tersebar (tabungan, cash, e-wallet, kartu kredit) sehingga posisi keuangan utuh sulit dilihat.
4. Ekspatriat kesulitan mengelola banyak mata uang sekaligus.
5. Tagihan, langganan, dan cicilan sering terlupa → denda dan kebocoran.
6. Tidak ada "penasihat" yang memberi gambaran jujur tentang kesehatan keuangan.

## 2. Tujuan & Metrik Keberhasilan

| Metrik | Target |
|---|---|
| Waktu mencatat 1 transaksi | < 10 detik |
| Akurasi ekstraksi struk (merchant, total, tanggal) | ≥ 90% |
| Akurasi kategori Voice Log | ≥ 85% |
| Retensi D30 | ≥ 35% |
| Konversi Free → Premium (90 hari) | ≥ 4% |
| Crash-free sessions (Android & iOS) | ≥ 99,5% |

## 3. Pengguna & Peran

- **Guest (tanpa login):** melihat onboarding dan halaman harga, lalu daftar via Google atau Email.
- **Pengguna Free:** pekerja 25–40 tahun, semua fitur inti dengan kuota terbatas (lihat Bab 7).
- **Pengguna Premium:** akun, goals, dan tagihan tanpa batas, kuota AI lebih besar, ekspor PDF, alat pajak lengkap.
- **Admin Arshif:** memantau pengguna, kuota AI, pembayaran web, dan kesehatan sistem lewat panel admin (web).

**Bahasa aplikasi:** Indonesia (default, sapaan "kamu" yang ramah), Melayu, Turki, Inggris. "Anda" hanya di dokumen legal.

## 4. Persyaratan Fungsional

### 4.1 Autentikasi & Onboarding
- **FR-AUTH-1:** Login Google Sign-In dan Email (password + magic link/OTP 6 digit). Password minimal 8 karakter (huruf + angka). Sesi tersimpan aman + auto-refresh. Akun Google dan Email dengan alamat sama ter-link otomatis.
- **FR-AUTH-2:** Setup 3 langkah setelah daftar: (1) mata uang utama (default dari lokasi), (2) akun pertama + saldo awal, (3) gaya budget 50/30/20 atau kustom + penghasilan bulanan.
- **FR-AUTH-3:** Kunci aplikasi opsional (PIN/biometrik). Opsi sembunyikan saldo (ikon mata).

### 4.2 Scan Struk & OCR (Prioritas #1)
- **FR-OCR-1:** Foto struk dari kamera (full-screen, bingkai panduan, flash, pilih dari galeri); gambar dikompres (lebar maks 1600px, JPEG 80%, maks 8 MB; JPEG/PNG/HEIC).
- **FR-OCR-2:** AI (Gemini, hanya via Edge Functions) mengekstrak merchant, tanggal, subtotal, pajak, service charge, diskon, total, mata uang, dan **daftar item** (nama, qty, harga satuan, total) + kategori yang disarankan + confidence.
- **FR-OCR-3:** Layar review — hasil bisa diedit; field confidence < 0,7 ditandai kuning; peringatan jika jumlah item ≠ subtotal (selisih > 1%); jika total kosong/gambar tak terbaca → status gagal dan kuota **tidak** dihitung.
- **FR-OCR-4:** Simpan → transaksi + item belanja tersimpan, saldo akun ter-update, kuota OCR +1. Dari layar review bisa langsung "Split Bill dari struk ini".
- **FR-OCR-5:** Mata uang struk boleh beda dari mata uang akun; konversi pakai kurs tanggal transaksi.
- **FR-OCR-6 (adopsi Belanje):** Capture struk memakai ML Kit document scanner — auto-crop dan deteksi tepi dokumen; ekstraksi isi tetap Gemini di server (FR-OCR-2).

### 4.3 Voice Log (Prioritas #2)
- **FR-VOICE-1:** Rekam suara maks 60 detik, tombol mic besar dengan animasi gelombang.
- **FR-VOICE-2:** Bahasa Indonesia, Melayu, Turki, Inggris (deteksi otomatis). Ekspresi relatif ("kemarin", "minggu lalu", "dün", "semalam") dikonversi ke tanggal absolut sesuai zona waktu pengguna. Angka informal ("goceng", "50k", "lima puluh ribu", "elli lira") dinormalisasi AI.
- **FR-VOICE-3:** AI mengembalikan transkrip + array transaksi (tipe, nominal, mata uang, hint akun, kategori, catatan, tanggal). Layar review menampilkan kartu per transaksi yang bisa diedit, lalu "Simpan Semua". Jika akun tidak disebut, pakai akun default.
- **FR-VOICE-4:** Voice Log mengurangi kuota automation (bukan kuota OCR).

### 4.4 Import Rekening Koran (PDF)
- **FR-PDF-1:** Upload PDF (maks 15 MB / 30 halaman, password PDF opsional), pilih akun tujuan. AI mem-parsing seluruh baris transaksi.
- **FR-PDF-2:** Setiap baris dicocokkan dengan transaksi yang ada (tanggal ±1 hari, nominal sama, deskripsi mirip) → yang cocok ditandai "Kemungkinan duplikat" dan **tidak** dicentang default.
- **FR-PDF-3:** Layar review berupa tabel transaksi, centang/hapus centang, lalu "Import Semua" (batch insert, source = statement). Aturan Smart Automation diterapkan otomatis tanpa menambah kuota automation.
- **FR-PDF-4:** File PDF dihapus dari storage 30 hari setelah import. Import gagal tidak dihitung kuota.

### 4.5 Transaksi Manual & Daftar Transaksi
- **FR-TRX-1:** Form: tipe (pemasukan/pengeluaran/transfer), nominal, mata uang, akun, kategori, tanggal, catatan. Transfer antar-akun (butuh akun asal + tujuan; kurs otomatis jika mata uang berbeda).
- **FR-TRX-2:** Daftar transaksi dikelompokkan per tanggal, dengan search + filter (akun, kategori, tipe, sumber input, rentang tanggal).
- **FR-TRX-3:** Detail transaksi: foto struk, item belanja, konversi mata uang, aksi edit dan hapus.
- **FR-TRX-4 (adopsi Worthful):** Reimbursement — pengeluaran yang diganti teman dicatat BUKAN sebagai pemasukan; ada status pending + tautan ke kartu/transaksi pengganti.

### 4.6 Multi-Akun (Dompet) & Net Worth
- **FR-ACC-1:** Tipe akun: Tabungan, Cash, E-Wallet, Kartu Kredit — masing-masing dengan mata uang sendiri, nama, saldo awal, warna kartu.
- **FR-ACC-2 (DIKUNCI 2026-11-05):** Desain kartu per bank — pengguna bisa pilih bank (mis. Jago, BCA, Maybank, CIMB) dan kartu memakai warna khas + nama bank itu, menggantikan gradasi generik lama. **Tanpa memakai logo resmi bank.**
- **FR-ACC-3:** Kartu kredit menyimpan limit + tanggal tagihan; saldo negatif = utang.
- **FR-ACC-4:** Saldo dihitung otomatis oleh trigger database tiap transaksi insert/update/delete. Nominal disimpan presisi (numeric, bukan float).
- **FR-ACC-5:** Beranda menampilkan **Net Worth**: total aset − utang kartu kredit, dikonversi ke mata uang utama. Harga live investasi TIDAK dipakai untuk net worth (ditolak, lihat Bab 8).
- **FR-ACC-6 (adopsi Worthful):** Shared limit group — dua kartu atau lebih dari satu bank bisa berbagi satu limit gabungan; utilisasi grup dihitung dari gabungan, bukan jumlah limit kartu.
- **FR-ACC-7 (adopsi Worthful):** Annual fee per kartu kredit — nominal iuran, bulan/tanggal ditagih, riwayat bulan yang sudah dibayar, waiver threshold + progress "RpX lagi untuk bebas iuran".
- **FR-ACC-8 (adopsi Worthful):** Tipe akun Paylater/BNPL ditambahkan ke Tabungan, Cash, E-Wallet, dan Kartu Kredit.

### 4.7 Multi-Currency
- **FR-FX-1:** Seluruh mata uang ISO 4217; IDR/MYR/TRY/USD dipin di atas pemilih mata uang.
- **FR-FX-2:** Kurs diperbarui setiap jam (ExchangeRate-API, basis USD); kurs historis disimpan harian untuk konversi transaksi lampau. Jika API kurs gagal, pakai kurs terakhir + label "Kurs per [waktu]".
- **FR-FX-3:** Semua agregasi (budget, net worth, recap) dikonversi ke mata uang utama pengguna.
- **FR-FX-4 (adopsi Worthful):** Aturan kurs per hari — belanja memakai kurs pada harinya (tidak berubah saat kurs bergerak), saldo memakai kurs hari ini. Pengguna bisa isi kurs sendiri per mata uang ("Kurs saya"); kalau tidak ada kurs harian untuk suatu kode, pengguna wajib isi kurs sendiri.

### 4.8 Budgeting 50/30/20
- **FR-BDG-1:** Bagi penghasilan bulanan ke Kebutuhan 50% / Keinginan 30% / Tabungan-Utang 20%; persentase bisa diubah asal total 100%.
- **FR-BDG-2:** Setiap kategori terhubung ke satu bucket. Halaman Budget: donat 3 bucket + progress per bucket dan per kategori; peringatan jika melebihi batas.
- **FR-BDG-3:** Notifikasi in-app saat pemakaian bucket mencapai 80% dan 100% (sekali per bucket per bulan).
- **FR-BDG-4:** Setoran Savings Goals dan pembayaran utang dihitung ke bucket 20%.
- **FR-BDG-5 (adopsi Worthful):** Budget pace + safe to spend — pace 3 tingkat (Sesuai laju / Agak cepat / Terlalu cepat) dari laju belanja vs waktu periode berjalan; "Aman dibelanjakan" (sisa ÷ hari tersisa); salin budget bulan lalu; saran rata-rata 3 bulan.
- **FR-BDG-6 (adopsi Worthful):** Payday — pengguna bisa mengatur bulan budget mulai dari tanggal gajian, bukan tanggal 1.

### 4.9 Savings Goals
- **FR-GOAL-1:** Buat goal: nama, target nominal, mata uang, tenggat, setoran dari akun tertentu; progress bar + saran setoran per bulan = (target − terkumpul) / sisa bulan.
- **FR-GOAL-2:** Goal tercapai → status completed + animasi konfeti + notifikasi. Riwayat setoran per goal.

### 4.10 Bill Tracker (Tagihan)
- **FR-BILL-1:** Tagihan berulang: nama, nominal, mata uang, frekuensi (mingguan/bulanan/kuartalan/tahunan), tanggal jatuh tempo; kalender jatuh tempo.
- **FR-BILL-2:** "Tandai Lunas" → otomatis membuat transaksi pengeluaran + menggeser jatuh tempo ke periode berikutnya.
- **FR-BILL-3:** Notifikasi in-app H-3 dan hari H. Tagihan lewat jatuh tempo → status overdue + badge merah.
- **FR-BILL-4 (adopsi Worthful):** Status lunas disimpan sebagai daftar tanggal per periode (paidPeriods), bukan boolean. Tampilan kalender jatuh tempo + pengelompokan: Jatuh tempo minggu ini / ≤3 hari / besok / hari ini / Terlambat; filter Lunas / Belum lunas.

### 4.11 Debt/Loan Manager + Simulator Pelunasan
- **FR-DEBT-1:** Catat utang maupun piutang: saldo, bunga per tahun (APR), cicilan minimum, pihak lawan, tanggal jatuh tempo.
- **FR-DEBT-2:** Simulator Snowball vs Avalanche: input "anggaran ekstra per bulan" → hitung urutan lunas, tanggal lunas, dan total bunga yang dihemat untuk kedua metode. Perhitungan bulanan: bunga = saldo × (APR/12); cicilan minimum dibayar ke semua utang, sisanya ke target sesuai metode.
- **FR-DEBT-3:** Pembayaran utang membuat transaksi + mengurangi sisa saldo. Utang dihitung ke limit gabungan "Loans & Bills".

### 4.12 Split Bill
- **FR-SPLIT-1:** Dari detail struk atau manual: tambah peserta (nama + kontak opsional), pilih bagi rata atau per item (tetapkan tiap item struk ke peserta). Pajak dan service charge dibagi proporsional.
- **FR-SPLIT-2:** Total semua bagian harus = total tagihan; sisa pembulatan dibebankan ke pemilik. Tandai siapa sudah membayar; tombol "Bagikan" menghasilkan ringkasan teks rincian per orang.
- **FR-SPLIT-3:** Bagian peserta yang belum membayar bisa tercatat sebagai piutang di Debt Manager (toggle opsional). Pembayaran split bill di dalam aplikasi TIDAK termasuk (hanya mencatat status lunas).

### 4.13 Subscription Tracker (Langganan)
- **FR-SUB-1:** Tambah dari daftar populer (Netflix, Spotify, YouTube Premium, iCloud, ChatGPT) atau kustom.
- **FR-SUB-2:** Total biaya bulanan dan tahunan dalam mata uang utama; tanggal perpanjangan; mata uang asing dikonversi otomatis. Notifikasi in-app H-2 sebelum perpanjangan.

### 4.14 Smart Automation
- **FR-AUTO-1:** Aturan auto-kategori: "Jika [merchant/catatan] mengandung [kata], maka [kategori/akun]".
- **FR-AUTO-2:** Transaksi berulang otomatis (mis. gaji setiap tanggal 25).
- **FR-AUTO-3:** Setiap eksekusi aturan, transaksi berulang, dan Voice Log menambah kuota automation. Jika kuota habis: aturan tidak jalan, transaksi masuk kategori "Lainnya", pengguna dapat notifikasi.

### 4.15 Invoices & Quotations (Freelancer)
- **FR-INV-1:** Buat invoice/penawaran: data klien, item, pajak, diskon, mata uang, jatuh tempo.
- **FR-INV-2:** Nomor otomatis per pengguna: `INV-2025-0001` / `QUO-2025-0001`. PDF dibuat dan dibagikan; saat invoice ditandai "Dibayar" → otomatis membuat transaksi pemasukan.

### 4.16 Money & Tax Tools
- **FR-TAX-1:** Konverter mata uang, kalkulator cicilan/KPR.
- **FR-TAX-2:** Estimasi pajak penghasilan: PPh 21 Indonesia (TER), PCB/MTD Malaysia, Gelir Vergisi Turki.
- **FR-TAX-3:** Basic (Free): konverter + kalkulator cicilan. Full (Premium): seluruh estimasi pajak, laporan pajak tahunan dari data transaksi, dan PDF Export (laporan bulanan, laporan pajak, riwayat transaksi).
- **FR-TAX-4:** Disclaimer: hasil hanya estimasi, bukan nasihat pajak resmi. Pelaporan pajak resmi (e-Filing) TIDAK termasuk.

### 4.17 AI Coach + Financial Health Score
- **FR-COACH-1:** Health Score 0–100, dihitung deterministik (rumus, bukan LLM) dari 5 pilar: rasio tabungan (25), kepatuhan budget (20), rasio utang terhadap pendapatan (20), dana darurat dalam bulan pengeluaran (20), ketepatan bayar tagihan (15).
- **FR-COACH-2:** AI (Gemini) hanya menarasikan skor dengan bahasa ramah + 3 aksi konkret.
- **FR-COACH-3:** Recap mingguan (setiap Senin 07:00 waktu lokal): agregasi minggu lalu → recap tersimpan + notifikasi in-app. Recap bulanan (tanggal 1, Premium) + tab "Tanya Coach" (pertanyaan bebas, 20/hari, Premium).
- **FR-COACH-4:** Recap ditulis dalam bahasa aplikasi pengguna (ID/MS/TR/EN). AI hanya menerima ringkasan angka, bukan data mentah sensitif.
- **FR-COACH-5 (adopsi Belanje — Weekly Replay):** Recap mingguan disajikan dengan gaya visual yang merayakan (ala Wrapped): highlight minggu itu, bukan sekadar tabel angka.

### 4.18 Notifikasi (In-App Saja)
- **FR-NOTIF-1:** Pusat notifikasi (ikon lonceng + badge live via Realtime) + toast saat aplikasi terbuka.
- **FR-NOTIF-2:** Tipe: bill_due, budget_alert, weekly_recap, monthly_recap, goal_reached, subscription_renewal, quota_warning, system. Tiap tipe bisa diaktifkan/dinonaktifkan di Pengaturan. Notifikasi > 90 hari dihapus otomatis.
- **FR-NOTIF-3:** Push notification (FCM/APNs), email, dan WhatsApp SENGAJA tidak ada di MVP.

### 4.19 Premium & Pembayaran
- **FR-PAY-1:** In-app (iOS/Android): RevenueCat, produk `arshif_premium_monthly` dan `arshif_premium_yearly`, entitlement `premium`; tombol "Pulihkan Pembelian". Webhook RevenueCat → update plan. RevenueCat adalah sumber kebenaran entitlement.
- **FR-PAY-2:** Web checkout: pilih paket + metode; **Xendit** untuk IDR/MYR (VA, QRIS, e-wallet, FPX), **Paddle** untuk USD/TRY/global (pengganti Stripe, DIKUNCI 2026-11-05; Paddle sebagai Merchant of Record mengurus pajak/VAT global). **Stripe DILARANG TOTAL — termasuk sebagai fallback.**
- **FR-PAY-3:** Paddle hanya untuk web checkout, bukan in-app; iOS tetap tidak menampilkan link checkout eksternal kecuali di wilayah yang diizinkan (feature flag). Webhook terverifikasi (signature/token) + idempoten; saat order paid → grant entitlement premium via RevenueCat REST API (promotional entitlement) sesuai durasi → plan ter-update + notifikasi in-app.
- **FR-PAY-4:** Status order: pending, paid, expired, failed, refunded.
- **FR-PAY-5:** Semua limit ditegakkan di server (bukan cuma disembunyikan di UI); fitur terkunci ditandai badge PRO + sheet paywall saat limit tercapai.

### 4.20 Panel Admin (Web)
- **FR-ADM-1:** Dasbor: total pengguna, DAU, pengguna Premium, pemakaian AI hari ini, estimasi pendapatan.
- **FR-ADM-2:** Pengguna: pencarian, detail paket, kuota, aksi suspend + grant Premium manual.
- **FR-ADM-3:** Pemakaian AI: log OCR/Voice/Import, rasio gagal, rata-rata latensi. Pesanan web (Xendit + Paddle) + status; Kurs: status sinkronisasi terakhir + tombol sinkronisasi manual; Broadcast: kirim notifikasi in-app ke segmen pengguna.
- **FR-ADM-4:** Hanya role admin yang bisa mengakses; data admin terpisah dari data pengguna biasa.

### 4.21 Pengaturan & Akun
- **FR-SET-1:** Profil, mata uang utama, bahasa (ID/MS/TR/EN), keamanan (PIN/biometrik), preferensi notifikasi per tipe.
- **FR-SET-2:** Kelola kategori kustom + bucket 50/30/20-nya.
- **FR-SET-3:** Ekspor data (JSON/CSV) dan hapus akun (cascade delete + storage) — kepatuhan GDPR, UU PDP Indonesia, PDPA Malaysia, KVKK Turki.

### 4.22 Smart Log — Capture Notifikasi Bank (v1, adopsi Worthful; dikonfirmasi juga oleh Belanje)
- **FR-SLOG-1:** Dengan izin Notification Listener dan automation ON, aplikasi menangkap notifikasi bank (Android; iOS via Shortcuts) dan mengubahnya menjadi transaksi. Tiap package bank ditautkan ke satu kartu.
- **FR-SLOG-2:** Parser (regex) membuang OTP/PIN/login, transaksi gagal/pending, dan promo; wajib ada kata kunci transaksi; buang baris saldo/limit; ambil nominal + mata uang pertama; tanggal = waktu notifikasi; kartu = tautan package, lalu normalisasi nama bank (myBCA→BCA, Livin→Mandiri, BRImo→BRI).
- **FR-SLOG-3:** Review-first — auto-apply HANYA untuk kasus paling yakin: expense + IDR + kartu tertaut + lolos semua cek. Selain itu masuk inbox **To Review** (transaksi meragukan/duplikat juga masuk sini); pengguna konfirmasi sebelum transaksi tercatat. Daftar bank yang didukung: myBCA, Livin Mandiri, BRImo, wondr BNI, Jenius, CIMB, Permata, BSI, Jago, blu, SeaBank, GoPay, OVO, DANA, ShopeePay, Gojek.
- **FR-SLOG-4:** Notifikasi "Recorded" + Undo/Edit untuk yang auto-apply; "Needs a check" untuk yang masuk antrean. Antrean dibaca dan dikosongkan saat inbox dibuka (sekali pakai).
- **FR-SLOG-5:** Smart Log mengurangi kuota automation (sama seperti Voice Log dan aturan auto-kategori).

## 5. Struktur Navigasi & Halaman

- **Public (tanpa login):** Welcome onboarding (carousel 3 slide: "Scan Struk", "Bicara, Langsung Tercatat", "Semua Mata Uang" + CTA "Mulai Gratis"), Sign In (Google + Email + OTP), Sign Up, Forgot Password, Verify OTP (6 digit), Pricing, Terms, Privacy.
- **Setup (setelah daftar):** mata uang utama → akun pertama → gaya budget.
- **Tab utama (5 tab + tombol tengah "+ Catat"):** Home (net worth, kartu akun swipeable, ringkasan budget, 5 transaksi terakhir, kartu Health Score, tagihan terdekat, lonceng), Transaksi (list per tanggal + search + filter), Capture ("+" → bottom sheet: Scan Struk / Voice Log / Import PDF / Manual), Planning (hub: Budget, Goals, Tagihan, Utang, Langganan, Split Bill), Coach (Health Score, recap, insight).
- **Halaman stack:** Scan + Review Struk, Voice + Review Voice, Import + Review Import, Transaksi Baru + Detail Transaksi, Akun (list/tambah/detail), Budget, Goals, Bills, Debts (+ simulator), Splits, Subscriptions, Automation, Invoices, Tools, Notifications, Categories, Settings, Premium (paywall) + Success.
- **Web checkout:** pilih paket + metode, status pembayaran (pending/paid/expired/failed, auto-refresh).
- **Admin (web):** dasbor, pengguna, AI usage, orders, kurs, broadcast.

## 6. Kriteria Penerimaan Per Fase

- **Fase 0 — Fondasi:** repo + design tokens + component library lengkap (Button, Card, Input, AmountInput, CurrencyText, Badge/ProBadge, Chip, ProgressBar, DonutChart interaktif, Gauge Health Score, grafik arus kas, BottomSheet, Dialog, Tabs, Skeleton, EmptyState, Toast, ListItem, CategoryIcon). JANGAN mulai halaman sebelum fondasi beres.
- **Fase 1 — UI semua layar v1** dengan data dummy realistis Bahasa Indonesia (DILARANG Lorem Ipsum). Setiap komponen wajib punya state loading, empty, error, dan limit-tercapai. Kartu akun di Home memakai desain per bank (Bab 4.6). Visual check: screenshot tiap layar, bandingkan berdampingan dengan referensi, perbaiki sampai mendekati referensi (standar: sedekat mungkin, 99% untuk bagian yang ditandai wajib sama).
- **Fase 2 — Backend:** database + RLS + Auth + Storage + Edge Functions (OCR struk, Voice Log, Import PDF, AI Coach, sync kurs) + data dinamis menggantikan dummy. Checkpoint WAJIB: jalan LIVE — login sungguhan, scan sungguhan, kurs sungguhan. Demo mode mock saja TIDAK dihitung selesai.
- **Fase 3 — Monetisasi & rilis:** RevenueCat (in-app) + Xendit (IDR/MYR) + Paddle (web global). Hardening keamanan, SEO/ASO, performa, testing end-to-end, lalu deploy.
- **Aturan eksekusi:** kerjakan PER FASE, tuntas dan berurutan; setelah satu fase selesai, BERHENTI, laporkan, dan TUNGGU konfirmasi sebelum fase berikutnya. Commit per fase. Jangan force push, jangan commit `.env`/secret. Jangan membuat halaman placeholder atau tulisan "segera hadir".

## 7. Limit Free vs Premium

| Fitur | FREE | PREMIUM |
|---|---|---|
| Akun & dompet | maks 4 | tanpa batas |
| Savings Goals aktif | maks 3 | tanpa batas |
| Tagihan + Utang (gabungan) | maks 3 | tanpa batas |
| Langganan | maks 5 | tanpa batas |
| Smart Automation (termasuk Voice Log) | 30/bulan | tanpa batas |
| Scan Struk & OCR | 20/bulan | 300/bulan |
| Import PDF rekening koran | 1/bulan | 10/bulan |
| Invoice & Quotation | 5/bulan | tanpa batas |
| Money & Tax Tools | Basic | Full + PDF Export |
| AI Coach | recap mingguan | mingguan + bulanan + Tanya Coach (20/hari) |

Kuota direset tiap tanggal 1. Pekerjaan AI yang gagal tidak memotong kuota. Saat limit tercapai, tampilkan paywall (bukan error mentah).

## 8. Out of Scope (SENGAJA Tidak Ada di MVP)

- Sinkronisasi otomatis ke bank (Open Banking/API bank) — digantikan import PDF.
- Push notification, email, WhatsApp (hanya in-app).
- Akun bersama/keluarga (shared wallet multi-user) — BUKAN v1; masuk roadmap pasca-MVP sebagai partner sharing (keputusan adopsi Worthful 2026-11-05).
- Trip (budget + pengeluaran per perjalanan) dan Item Prices (riwayat harga barang + barcode scan) — pasca-MVP, lihat Bab 13.
- Pelacakan investasi (saham, kripto, reksa dana) + harga pasar — termasuk harga live untuk net worth.
- Offline-first gratis (ala Worthful) — DITOLAK.
- Lifetime purchase unlimited (ala Worthful) — DITOLAK; tetap subscription monthly/yearly, yearly dibuat hemat lewat Xendit untuk IDR/MYR.
- Import CSV/Excel dan rekening koran gambar multi-halaman (MVP hanya PDF).
- Widget home screen, Apple Watch, Wear OS — pasca-MVP, lihat Bab 13.
- Pelaporan pajak resmi (e-Filing).
- Pembayaran split bill di dalam aplikasi.
- Light theme — MVP dark mode saja (lihat Bab 12, masih bisa diubah lewat jawaban arah desain).

## 9. Persyaratan Non-Fungsional

- **Performa:** cold start < 2,5 detik; OCR end-to-end < 6 detik; Voice Log < 4 detik; list dengan paginasi kursor (50/halaman); kompresi gambar di klien; agregasi berat di database (bukan klien).
- **Keamanan:** RLS `user_id = auth.uid()` di semua tabel; secret hanya di Edge Functions (Gemini, Supabase service role, Xendit, RevenueCat, Paddle — BUKAN Stripe); validasi Zod di klien dan server; sanitasi output AI sebelum render ke PDF; rate limit 10 request AI/menit/pengguna; webhook terverifikasi + idempoten; bucket storage privat (signed URL 10 menit); PDF rekening koran dihapus 30 hari setelah import. Tanpa `service_role` di klien.
- **Privasi:** ekspor data (JSON/CSV), hapus akun (cascade delete + storage); GDPR, UU PDP Indonesia, PDPA Malaysia, KVKK Turki.
- **Kualitas:** TypeScript strict; komponen maksimal ~200 baris; nominal uang integer unit terkecil/numeric (JANGAN float); format angka/mata uang lewat helper currency; tambah/ubah test saat mengubah logika (kuota, konversi mata uang, parsing, simulasi utang); monitoring Sentry + PostHog.
- **Aksesibilitas:** kontras teks minimal WCAG AA, state focus terlihat, hormati `prefers-reduced-motion`.

## 10. Stack yang Direkomendasikan

- **Aplikasi:** Expo SDK 52+ (Expo Router, TypeScript strict), NativeWind v4.
- **Backend:** Supabase (Postgres + RLS + Auth + Storage + Edge Functions + Realtime + pg_cron).
- **AI:** Gemini `gemini-2.5-flash`, HANYA dipanggil dari Edge Functions, tidak pernah dari klien.
- **Kurs:** ExchangeRate-API (sync per jam).
- **Pembayaran:** RevenueCat (in-app) + Xendit (web IDR/MYR) + Paddle (web global).
- **OTA updates:** Expo Updates (EAS Update) — update JS tanpa lewat store (pola Belanje).
- **Catatan:** alternatif Next.js App Router + Drizzle pernah tercatat di AGENTS.md lama — TIDAK dipakai untuk rebuild ini kecuali Ahmad memutuskan lain (lihat Bab 12).

## 11. Design System (Referensi Awal dari PRD Lama — BOLEH Diubah via Bab 12)

- Dark mode saja (MVP). Warna: background `#0A0A0A`, card `#1A1A1A` (border putih 8% opacity), sheet/modal `#222222`, primary `#00C896` (emerald), aksen/CTA `#6366F1` (indigo), teks `#FFFFFF` / sekunder `#94A3B8` / redup `#64748B`, pengeluaran `#F43F5E`, warning `#F59E0B`, info `#38BDF8`.
- Font Inter; saldo display 36 Bold tabular-nums; H1 28 / H2 22 / H3 17 SemiBold; body 15; caption 13.
- Radius: card 16, button/input 12, chip/badge full, bottom sheet 24 (sudut atas). Button primary tinggi 52, teks 16 SemiBold, efek tekan scale 0.97.
- Ikon: Lucide (line, stroke 1.75, ukuran 20/24). Kategori = ikon dalam lingkaran 40px dengan warna kategori opacity 15%.
- Aturan angka: pemasukan hijau dengan prefix "+", pengeluaran putih dengan prefix "−"; merah hanya untuk overbudget.
- Micro-animation: saldo count-up, progress bar mengisi perlahan, gelombang mic, garis scan bergerak; haptic saat transaksi tersimpan/scan berhasil/tombol utama.
- Loading: skeleton shimmer gelap (bukan spinner polos). Empty state: ilustrasi line-icon besar + kalimat ramah + CTA. Fitur terkunci: badge "PRO" gradasi indigo-emerald.
- **PERINGATAN:** identitas visual final WAJIB berasal dari jawaban arah desain di Bab 12, BUKAN default "seperti Revolut". Yang di bab ini hanya titik awal dari PRD lama.

## 12. Keputusan Terbuka (Untuk Ahmad — JANGAN Ditebak)

1. **Stack final:** Expo SDK 52+ + Supabase (direkomendasikan di Bab 10) atau Next.js + Drizzle? Konfirmasi satu.
2. **Arah desain (4 jawaban):**
   - Tone/rasa: [ mis. fintech bersih-serius / premium / playful / minimal ]
   - Tema: [ dark saja / light saja / keduanya ]
   - Referensi visual: [ lampirkan 2–3 screenshot/pin Pinterest + layar tujuannya + bagian mana yang wajib sama persis vs boleh adaptasi ]
   - Cakupan layar v1: [ semua halaman Bab 5 / hanya Home, Transaksi, Tambah, Anggaran, Coach, Pengaturan ]
3. **Cakupan layar v1 rebuild:** semua halaman Bab 5 ikut di v1, atau dipangkas ke inti dulu?

## 13. Adopsi Fitur dari Worthful & Belanje (DIKUNCI 2026-11-05)

Sumber: bedah APK Worthful 1.1 (`~/workspace/analysis/worthful/features.md`) dan Belanje 5.2.2 (`~/workspace/analysis/belanje/features.md`).

### 13.1 Masuk v1
| Fitur | Sumber | FR |
|---|---|---|
| Smart Log — capture notifikasi bank, review-first | Worthful (+ Belanje) | 4.22 (FR-SLOG-1..5) |
| Desain kartu per bank (warna khas + nama bank, tanpa logo resmi) | Worthful | FR-ACC-2 |
| Budget pace + safe to spend | Worthful | FR-BDG-5 |
| Shared limit group | Worthful | FR-ACC-6 |
| Annual fee + waiver tracking | Worthful | FR-ACC-7 |
| Tipe akun Paylater/BNPL | Worthful | FR-ACC-8 |
| Aturan kurs per hari + "Kurs saya" | Worthful | FR-FX-4 |
| Bills: kalender jatuh tempo + pengelompokan + paidPeriods | Worthful | FR-BILL-4 |
| Reimbursement | Worthful | FR-TRX-4 |
| Payday (bulan budget dari tanggal gajian) | Worthful | FR-BDG-6 |
| ML Kit document scanner (capture struk) | Belanje | FR-OCR-6 |
| Weekly Replay (gaya recap mingguan) | Belanje | FR-COACH-5 |
| OTA updates (Expo Updates) | Belanje | Bab 10 |

### 13.2 Pasca-MVP (roadmap)
- **Partner sharing / Shared Space** — Worthful + Belanje (sudah dikunci pasca-MVP).
- **Rewards per kartu** — poin/cashback/miles + riwayat redemption (Worthful).
- **Aset & Net Worth lengkap** — properti, kendaraan, saham, emas, dll + goals aset (Worthful).
- **KPR tracker** — floating rate, prepay + penalti, jadwal (Worthful).
- **Trip** — budget + pengeluaran per perjalanan (Belanje).
- **Item Prices** — riwayat harga barang + barcode scan; dibangun di atas item struk (FR-OCR-2) (Belanje).
- **Laporan Excel** — Arshif sudah punya PDF export Premium; Excel tambahan (Worthful).
- **Widgets** — Home Screen, Lock Screen, Quick Log (Worthful + Belanje).

### 13.3 Sudah ada di Arshif (jangan diduplikasi)
Voice Log, Split Bill, Goals, Loans, Subscriptions, Budget, Recurring, Reports, Receipt OCR, hapus akun.

### 13.4 Tetap DITOLAK (jangan diambil)
Harga live investasi untuk net worth, offline-first gratis, lifetime purchase unlimited.

## Lampiran: Keputusan yang Sudah DIKUNCI (Jangan Ditawar Lagi)

| Keputusan | Isi | Tanggal |
|---|---|---|
| Nasib build lama | Buang total; repo Fase 1–2 tidak dipakai sama sekali (hanya jadi daftar larangan) | 2026-11-05 ~10:10 |
| Adopsi Worthful — v1 | Desain kartu per bank (warna khas + nama bank, tanpa logo resmi) | 2026-11-05 ~10:00 |
| Adopsi Worthful — pasca-MVP | Partner sharing | 2026-11-05 ~10:00 |
| Adopsi Worthful — ditolak | Offline-first gratis; lifetime purchase unlimited; harga live investasi untuk net worth | 2026-11-05 ~10:00 |
| Adopsi Worthful & Belanje | v1: Smart Log, budget pace, shared limit, annual fee, Paylater, kurs-per-hari, bills kalender, reimbursement, payday, ML Kit scanner, Weekly Replay, OTA. Pasca-MVP: partner sharing, rewards, aset, KPR, Trip, Item Prices, Excel, widgets. Ditolak tetap: harga live investasi, offline-first, lifetime. Detail di Bab 13 PRD. | 2026-11-05 ~15:30 |
| Pembayaran | Stripe DILARANG TOTAL (Ahmad tidak bisa daftar); RevenueCat + Xendit tetap | 2026-11-05 ~10:20 |
| Pembayaran global | Paddle (Merchant of Record), web checkout saja, sandbox-first | 2026-11-05 ~10:21 |

**Daftar larangan dari build lama (jangan diulang):** dependensi tidak lengkap (`expo-asset`, `query-string` hilang dari `package.json`); mode mock diklaim selesai padahal belum live; celah RLS; over-engineering ala Claude (satu tugas satu fungsi, komponen ≤ ~200 baris); UI generik dan bug layout kecil dibiarkan; visual check lawan referensi wajib tiap layar.

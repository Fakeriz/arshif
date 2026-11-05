# Arshif — Deskripsi Lengkap Fitur (untuk PRD rebuild)

Dokumen ini merangkum SEMUA fitur Arshif dari PRD asli (Bab 1–12) untuk dipakai sebagai bahan PRD baru di spechkit.tech. Bukan dokumen PRD jadi — ini inventaris fitur yang bisa ditempel/diadaptasi ke template PRD di sana.

---

## 1. Ringkasan Produk

- **Nama:** Arshif — asisten keuangan pribadi berbasis AI, pengalaman bergaya fintech modern (terinspirasi Revolut).
- **Janji inti:** mencatat pemasukan dan pengeluaran dalam **kurang dari 10 detik** lewat foto struk, suara, atau rekening koran PDF. AI mengelompokkan transaksi secara otomatis dan memberi saran keuangan yang personal.
- **Pembeda:** multi-mata uang real-time yang dioptimalkan untuk **IDR, MYR, TRY, dan USD** — cocok untuk pekerja lintas negara dan ekspatriat (Indonesia, Malaysia, Turki).
- **Masalah yang diselesaikan:**
  1. Mencatat manual melelahkan; kebanyakan orang berhenti setelah 1–2 minggu.
  2. Struk belanja menumpuk dan hilang; detail pajak dan item tidak pernah tercatat.
  3. Uang tersebar (tabungan, cash, e-wallet, kartu kredit) sehingga posisi keuangan utuh sulit dilihat.
  4. Ekspatriat kesulitan mengelola banyak mata uang sekaligus.
  5. Tagihan, langganan, dan cicilan sering terlupa → denda dan kebocoran.
  6. Tidak ada "penasihat" yang memberi gambaran jujur tentang kesehatan keuangan.
- **Target keberhasilan:** 1 transaksi < 10 detik; akurasi ekstraksi struk ≥ 90% (merchant, total, tanggal); akurasi kategori Voice Log ≥ 85%; retensi D30 ≥ 35%; konversi Free → Premium ≥ 4% dalam 90 hari; crash-free sessions ≥ 99,5% di Android dan iOS.

## 2. Peran Pengguna

- **Guest (tanpa login):** melihat onboarding dan halaman harga, lalu daftar via Google atau Email.
- **Pengguna Free:** pekerja 25–40 tahun, semua fitur inti dengan kuota terbatas.
- **Pengguna Premium:** akun, goals, dan tagihan tanpa batas, kuota AI lebih besar, ekspor PDF, dan alat pajak lengkap.
- **Admin Arshif:** memantau pengguna, kuota AI, pembayaran web, dan kesehatan sistem lewat panel admin (web).

## 3. Fitur Inti

### A. Autentikasi & Onboarding
- Login: **Google Sign-In** dan **Email** (password + magic link/OTP 6 digit).
- Setelah daftar ada setup 3 langkah: (1) pilih mata uang utama (default dari lokasi: IDR/MYR/TRY/USD/dll), (2) buat akun pertama + saldo awal, (3) pilih gaya budget 50/30/20 atau kustom + isi penghasilan bulanan.
- Password minimal 8 karakter (huruf + angka). Sesi tersimpan aman + auto-refresh. Akun Google dan Email dengan alamat sama ter-link otomatis.
- Kunci aplikasi opsional: PIN/biometrik. Opsi sembunyikan saldo (ikon mata).

### B. Scan Struk & OCR (Prioritas #1)
- Foto struk dari kamera (full-screen, bingkai panduan, flash, pilih dari galeri) atau galeri; gambar dikompres (lebar maks 1600px, JPEG 80%, maks 8 MB; format JPEG/PNG/HEIC).
- AI (Gemini) mengekstrak: merchant, tanggal, subtotal, pajak, service charge, diskon, total, mata uang, dan **daftar item** (nama, qty, harga satuan, total) + kategori yang disarankan + confidence.
- Layar review: hasil ekstraksi bisa diedit; field confidence < 0,7 ditandai kuning; peringatan jika jumlah item ≠ subtotal (selisih > 1%); jika total kosong/gambar tak terbaca → status gagal dan kuota **tidak** dihitung.
- Simpan → transaksi + item belanja tersimpan, saldo akun ter-update, kuota OCR bertambah 1. Dari layar review bisa langsung "Split Bill dari struk ini".
- Mata uang struk boleh beda dari mata uang akun; konversi pakai kurs tanggal transaksi.

### C. Voice Log (Prioritas #2)
- Rekam suara maks 60 detik, tombol mic besar dengan animasi gelombang. Contoh: "tadi makan siang 45 ribu pakai GoPay" atau multi-transaksi dalam satu rekaman ("isi bensin 150 ribu pakai kartu kredit, terus parkir 5 ribu cash").
- Bahasa: **Indonesia, Melayu, Turki, Inggris** (deteksi otomatis). Ekspresi relatif ("kemarin", "minggu lalu", "dün", "semalam") dikonversi ke tanggal absolut sesuai zona waktu pengguna. Angka informal ("goceng", "50k", "lima puluh ribu", "elli lira") dinormalisasi AI.
- AI mengembalikan transkrip + array transaksi (tipe, nominal, mata uang, hint akun, kategori, catatan, tanggal). Layar review menampilkan kartu per transaksi yang bisa diedit, lalu "Simpan Semua".
- Jika akun tidak disebut, pakai akun default. Voice Log mengurangi kuota automation (bukan kuota OCR).

### D. Import Rekening Koran (PDF)
- Upload PDF (maks 15 MB / 30 halaman, password PDF opsional), pilih akun tujuan.
- AI mem-parsing seluruh baris transaksi. Setiap baris dicocokkan dengan transaksi yang ada (tanggal ±1 hari, nominal sama, deskripsi mirip) → yang cocok ditandai "Kemungkinan duplikat" dan **tidak** dicentang default.
- Layar review: tabel transaksi, centang/hapus centang, lalu "Import Semua" (batch insert, source = statement). Aturan Smart Automation diterapkan otomatis ke hasil import tanpa menambah kuota automation.
- File PDF dihapus dari storage 30 hari setelah import (privasi). Import gagal tidak dihitung kuota.

### E. Pencatatan Transaksi Manual
- Form: tipe (pemasukan/pengeluaran/transfer), nominal, mata uang, akun, kategori, tanggal, catatan.
- Transfer antar-akun (butuh akun asal + tujuan; kurs otomatis jika mata uang berbeda).
- Daftar transaksi dikelompokkan per tanggal, dengan search + filter (akun, kategori, tipe, sumber input, rentang tanggal).
- Detail transaksi: foto struk, item belanja, konversi mata uang, aksi edit dan hapus.

### F. Multi-Akun (Dompet)
- Tipe akun: **Tabungan, Cash, E-Wallet, Kartu Kredit** — masing-masing dengan mata uang sendiri, nama, saldo awal, warna kartu.
- Desain kartu per bank (keputusan adopsi Worthful 2026-11-05, MASUK v1 rebuild): pengguna bisa pilih bank (mis. Jago, BCA, Maybank, CIMB) dan kartu memakai warna khas + nama bank itu, menggantikan gradasi generik lama. Tanpa memakai logo resmi bank.
- Kartu kredit: menyimpan limit + tanggal tagihan; saldo negatif = utang.
- Saldo dihitung otomatis oleh trigger database tiap transaksi insert/update/delete. Nominal disimpan presisi (numeric, bukan float).
- Beranda menampilkan **Net Worth**: total aset − utang kartu kredit, dikonversi ke mata uang utama.

### G. Multi-Currency Real-Time
- Seluruh mata uang ISO 4217; IDR/MYR/TRY/USD dipin di atas pemilih mata uang.
- Kurs diperbarui setiap jam (ExchangeRate-API, basis USD); kurs historis disimpan harian untuk konversi transaksi lampau. Jika API kurs gagal, pakai kurs terakhir + label "Kurs per [waktu]".
- Semua agregasi (budget, net worth, recap) dikonversi ke mata uang utama pengguna.

### H. Budgeting 50/30/20
- Bagi penghasilan bulanan ke **Kebutuhan 50% / Keinginan 30% / Tabungan-Utang 20%**; persentase bisa diubah (mis. 60/20/20) asal total 100%.
- Setiap kategori terhubung ke satu bucket (mis. Makanan Pokok → Kebutuhan, Nongkrong → Keinginan).
- Halaman Budget: donat 3 bucket + progress per bucket dan per kategori; peringatan jika melebihi batas.
- Notifikasi in-app saat pemakaian bucket mencapai 80% dan 100% (sekali per bucket per bulan).
- Setoran Savings Goals dan pembayaran utang dihitung ke bucket 20%.

### I. Savings Goals
- Buat goal: nama, target nominal, mata uang, tenggat, setoran dari akun tertentu; progress bar + saran setoran per bulan = (target − terkumpul) / sisa bulan.
- Goal tercapai → status completed + animasi konfeti + notifikasi.
- Riwayat setoran per goal.

### J. Bill Tracker (Tagihan)
- Tagihan berulang: nama, nominal, mata uang, frekuensi (mingguan/bulanan/kuartalan/tahunan), tanggal jatuh tempo; kalender jatuh tempo.
- "Tandai Lunas" → otomatis membuat transaksi pengeluaran + menggeser jatuh tempo ke periode berikutnya.
- Notifikasi in-app H-3 dan hari H. Tagihan lewat jatuh tempo → status overdue + badge merah.

### K. Debt/Loan Manager + Simulator Pelunasan
- Catat utang maupun piutang: saldo, bunga per tahun (APR), cicilan minimum, pihak lawan, tanggal jatuh tempo.
- **Simulator Snowball vs Avalanche:** input "anggaran ekstra per bulan" → hitung urutan lunas, tanggal lunas, dan total bunga yang dihemat untuk metode Snowball (saldo terkecil dulu) dibandingkan Avalanche (bunga tertinggi dulu). Perhitungan bulanan: bunga = saldo × (APR/12); cicilan minimum dibayar ke semua utang, sisanya ke target sesuai metode.
- Pembayaran utang membuat transaksi + mengurangi sisa saldo. Utang dihitung ke limit gabungan "Loans & Bills".

### L. Split Bill
- Dari detail struk atau manual: tambah peserta (nama + kontak opsional), pilih **bagi rata** atau **per item** (tetapkan tiap item struk ke peserta). Pajak dan service charge dibagi proporsional.
- Total semua bagian harus = total tagihan; sisa pembulatan dibebankan ke pemilik.
- Tandai siapa sudah membayar; tombol "Bagikan" menghasilkan ringkasan teks rincian per orang.
- Bagian peserta yang belum membayar bisa tercatat sebagai piutang di Debt Manager (toggle opsional).
- Pembayaran split bill langsung di dalam aplikasi TIDAK termasuk (hanya mencatat status lunas).

### M. Subscription Tracker (Langganan)
- Tambah dari daftar populer (Netflix, Spotify, YouTube Premium, iCloud, ChatGPT) atau kustom.
- Total biaya bulanan dan tahunan dalam mata uang utama; tanggal perpanjangan; mata uang asing dikonversi otomatis.
- Notifikasi in-app H-2 sebelum perpanjangan.

### N. Smart Automation
- Aturan auto-kategori: "Jika [merchant/catatan] mengandung [kata], maka [kategori/akun]" (mis. merchant mengandung "Indomaret" → Belanja Harian).
- Transaksi berulang otomatis (mis. gaji setiap tanggal 25).
- Setiap eksekusi aturan, transaksi berulang, dan Voice Log menambah kuota automation. Jika kuota habis: aturan tidak jalan, transaksi masuk kategori "Lainnya", pengguna dapat notifikasi.

### O. Invoices & Quotations (Freelancer)
- Buat invoice/penawaran: data klien, item, pajak, diskon, mata uang, jatuh tempo.
- Nomor otomatis per pengguna: `INV-2025-0001` / `QUO-2025-0001`. PDF dibuat dan dibagikan; saat invoice ditandai "Dibayar" → otomatis membuat transaksi pemasukan.

### P. Money & Tax Tools
- Konverter mata uang, kalkulator cicilan/KPR.
- Estimasi pajak penghasilan: **PPh 21 Indonesia (TER), PCB/MTD Malaysia, Gelir Vergisi Turki**.
- Basic (Free): konverter + kalkulator cicilan. Full (Premium): seluruh estimasi pajak, laporan pajak tahunan dari data transaksi, dan **PDF Export** (laporan bulanan, laporan pajak, riwayat transaksi).
- Disclaimer: hasil hanya estimasi, bukan nasihat pajak resmi. Pelaporan pajak resmi (e-Filing) TIDAK termasuk.

### Q. AI Coach + Financial Health Score
- **Health Score 0–100**, dihitung deterministik (rumus, bukan LLM) dari 5 pilar: rasio tabungan (25), kepatuhan budget (20), rasio utang terhadap pendapatan (20), dana darurat dalam bulan pengeluaran (20), ketepatan bayar tagihan (15).
- AI (Gemini) hanya menarasikan skor dengan bahasa ramah + 3 aksi konkret.
- **Recap mingguan** (setiap Senin 07:00 waktu lokal): agregasi minggu lalu → recap tersimpan + notifikasi in-app.
- **Recap bulanan** (tanggal 1, Premium) + tab **"Tanya Coach"** (pertanyaan bebas, 20/hari, Premium).
- Recap ditulis dalam bahasa aplikasi pengguna (ID/MS/TR/EN). AI hanya menerima ringkasan angka, bukan data mentah sensitif.

### R. Notifikasi (In-App Saja)
- Pusat notifikasi (ikon lonceng + badge live via Realtime) + toast saat aplikasi terbuka.
- Tipe: bill_due, budget_alert, weekly_recap, monthly_recap, goal_reached, subscription_renewal, quota_warning, system.
- Tiap tipe bisa diaktifkan/dinonaktifkan di Pengaturan. Notifikasi > 90 hari dihapus otomatis.
- Push notification (FCM/APNs), email, dan WhatsApp SENGAJA tidak ada di MVP.

### S. Premium & Pembayaran
- **In-app (iOS/Android):** RevenueCat, produk `arshif_premium_monthly` dan `arshif_premium_yearly`, entitlement `premium`; tombol "Pulihkan Pembelian". Webhook RevenueCat → update plan. RevenueCat adalah sumber kebenaran entitlement.
- **Web checkout:** pilih paket + metode; **Xendit** untuk IDR/MYR (VA, QRIS, e-wallet, FPX), **Paddle** untuk USD/TRY/global (pengganti Stripe, DIKUNCI 2026-11-05; Paddle sebagai Merchant of Record mengurus pajak/VAT global). **Stripe DILARANG di PRD baru (Ahmad tidak bisa daftar Stripe)** — jangan pakai Stripe, termasuk sebagai fallback. Paddle hanya untuk web checkout, bukan in-app; iOS tetap tidak menampilkan link checkout eksternal kecuali di wilayah yang diizinkan (feature flag). Webhook terverifikasi (signature/token) + idempoten; saat order paid → grant entitlement premium via RevenueCat REST API (promotional entitlement) sesuai durasi → plan ter-update + notifikasi in-app.
- Status order: pending, paid, expired, failed, refunded. iOS tidak menampilkan link checkout eksternal kecuali di wilayah yang diizinkan (feature flag).
- **Gating:** semua limit ditegakkan di server (bukan cuma disembunyikan di UI); fitur terkunci ditandai badge PRO + sheet paywall saat limit tercapai.

### T. Panel Admin (Web)
- Dasbor: total pengguna, DAU, pengguna Premium, pemakaian AI hari ini, estimasi pendapatan.
- Pengguna: pencarian, detail paket, kuota, aksi suspend + grant Premium manual.
- Pemakaian AI: log OCR/Voice/Import, rasio gagal, rata-rata latensi.
- Pesanan web (Xendit + Paddle) + status; Kurs: status sinkronisasi terakhir + tombol sinkronisasi manual; Broadcast: kirim notifikasi in-app ke segmen pengguna.
- Hanya role admin yang bisa mengakses; data admin terpisah dari data pengguna biasa.

### U. Pengaturan & Akun
- Profil, mata uang utama, bahasa (ID/MS/TR/EN), keamanan (PIN/biometrik), preferensi notifikasi per tipe.
- Kelola kategori kustom + bucket 50/30/20-nya.
- Ekspor data (JSON/CSV) dan hapus akun (cascade delete + storage) — kepatuhan GDPR, UU PDP Indonesia, PDPA Malaysia, KVKK Turki.

## 4. Daftar Halaman (Struktur Navigasi)

- **Public (tanpa login):** Welcome onboarding (carousel 3 slide: "Scan Struk", "Bicara, Langsung Tercatat", "Semua Mata Uang" + CTA "Mulai Gratis"), Sign In (Google + Email + OTP), Sign Up, Forgot Password, Verify OTP (6 digit), Pricing, Terms, Privacy.
- **Setup (setelah daftar):** mata uang utama → akun pertama → gaya budget.
- **Tab utama (5 tab + tombol tengah "+ Catat"):** Home (net worth, kartu akun swipeable, ringkasan budget, 5 transaksi terakhir, kartu Health Score, tagihan terdekat, lonceng), Transaksi (list per tanggal + search + filter), Capture ("+" → bottom sheet: Scan Struk / Voice Log / Import PDF / Manual), Planning (hub: Budget, Goals, Tagihan, Utang, Langganan, Split Bill), Coach (Health Score, recap, insight).
- **Halaman stack:** Scan + Review Struk, Voice + Review Voice, Import + Review Import, Transaksi Baru + Detail Transaksi, Akun (list/tambah/detail), Budget, Goals, Bills, Debts (+ simulator), Splits, Subscriptions, Automation, Invoices, Tools, Notifications, Categories, Settings, Premium (paywall) + Success.
- **Web checkout:** pilih paket + metode, status pembayaran (pending/paid/expired/failed, auto-refresh).
- **Admin (web):** dasbor, pengguna, AI usage, orders, kurs, broadcast.

## 5. Limit Free vs Premium

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

## 6. Yang SENGAJA Tidak Ada di MVP (Out of Scope)

- Sinkronisasi otomatis ke bank (Open Banking/API bank) — digantikan import PDF.
- Push notification, email, WhatsApp (hanya in-app).
- Akun bersama/keluarga (shared wallet multi-user) — BUKAN v1; masuk roadmap pasca-MVP sebagai partner sharing (keputusan adopsi Worthful 2026-11-05).
- Pelacakan investasi (saham, kripto, reksa dana) + harga pasar — termasuk harga live untuk net worth, ditolak untuk PRD baru selama investasi masih out of scope.
- Offline-first gratis (ala Worthful) — DITOLAK untuk PRD baru; Arshif tetap cloud + kuota yang ditegakkan di server.
- Lifetime purchase unlimited (ala Worthful $24.99) — DITOLAK untuk PRD baru; tetap subscription monthly/yearly, dengan yearly dibuat hemat lewat Xendit untuk IDR/MYR.
- Import CSV/Excel dan rekening koran gambar multi-halaman (MVP hanya PDF).
- Light theme (MVP dark mode saja).
- Widget home screen, Apple Watch, Wear OS.
- Pelaporan pajak resmi (e-Filing).
- Pembayaran split bill di dalam aplikasi.

## 7. Design System (Gaya Visual)

- **Dark mode saja** (MVP), gaya Revolut-inspired: premium, tenang, terpercaya; banyak ruang kosong; saldo selalu jadi fokus.
- Warna: background `#0A0A0A`, card `#1A1A1A` (border putih 8% opacity), sheet/modal `#222222`, primary `#00C896` (emerald, saldo positif/pemasukan/progress), aksen/CTA `#6366F1` (indigo), teks putih `#FFFFFF` / sekunder `#94A3B8` / redup `#64748B`, pengeluaran merah `#F43F5E`, warning `#F59E0B`, info `#38BDF8`. Gradasi kartu akun: indigo→emerald, ungu gelap, hijau gelap.
- Font **Inter**; saldo display 36 Bold tabular-nums; H1 28 / H2 22 / H3 17 SemiBold; body 15; caption 13.
- Radius: card 16, button/input 12, chip/badge full, bottom sheet 24 (sudut atas). Button primary tinggi 52, teks 16 SemiBold, efek tekan scale 0.97.
- Ikon: Lucide (line, stroke 1.75, ukuran 20/24). Kategori = ikon dalam lingkaran 40px dengan warna kategori opacity 15%.
- Aturan angka: pemasukan hijau dengan prefix "+", pengeluaran putih dengan prefix "−"; merah hanya untuk overbudget.
- Micro-animation: saldo count-up, progress bar mengisi perlahan, gelombang mic, garis scan bergerak; haptic saat transaksi tersimpan/scan berhasil/tombol utama; glassmorphism halus di tab bar, header saat scroll, overlay kamera.
- Loading: skeleton shimmer gelap (bukan spinner polos). Empty state: ilustrasi line-icon besar + kalimat ramah + CTA. Fitur terkunci: badge "PRO" gradasi indigo-emerald.
- Bahasa UI: Indonesia default yang ramah dan singkat, sapaan "kamu" di aplikasi ("Anda" hanya di dokumen legal); i18n ID/MS/TR/EN. Format angka per locale (Rp 45.000, RM 12.50, ₺350,00, $9.99).

## 8. Fondasi Teknis (Catatan Sejarah Build Lama — TIDAK Dipakai Ulang, Keputusan 2026-11-05: Buang Total)

- Stack lama: Expo SDK 52+ (Expo Router, TypeScript strict), NativeWind v4, Supabase (Postgres + RLS + Auth + Storage + Edge Functions + Realtime + pg_cron), Gemini `gemini-2.5-flash` (hanya dipanggil dari Edge Functions, tidak pernah dari klien), ExchangeRate-API (sync kurs per jam), RevenueCat, Xendit (IDR/MYR), Stripe (USD/TRY/global — HANYA sejarah build lama, DILARANG di PRD baru 2026-11-05).
- Keamanan: RLS `user_id = auth.uid()` di semua tabel; secret hanya di Edge Functions; validasi Zod di klien dan server; sanitasi output AI sebelum render ke PDF; rate limit 10 request AI/menit/pengguna; webhook terverifikasi + idempoten; bucket storage privat (signed URL 10 menit); PDF rekening koran dihapus 30 hari setelah import.
- Performa: kompresi gambar di klien, list dengan paginasi kursor (50/halaman), cache + optimistic update, agregasi berat di database (bukan klien), cold start < 2,5 detik, OCR end-to-end < 6 detik, Voice Log < 4 detik, monitoring Sentry + PostHog.

## 9. Keputusan yang Harus Ditetapkan di PRD Baru (Belum Diputuskan)

1. **Stack rebuild:** PRD lama memakai Expo; catatan AGENTS.md lama memakai Next.js + Drizzle. PRD baru harus menetapkan satu — jangan dibiarkan ganda.
2. **Nasib build lama — DIKUNCI 2026-11-05 (Ahmad setuju):** buang total, tetap build baru di Claude. Repo Fase 1–2 TIDAK dipakai sama sekali — tidak boleh dicopy kode, skema, atau polanya. Satu-satunya sumber adalah PRD baru spechkit + dokumen inventaris ini. Repo lama hanya jadi daftar larangan: dependensi tidak lengkap (`expo-asset`, `query-string`), mode mock yang diklaim selesai padahal belum live, celah RLS, over-engineering, dan UI generik/jelek.
3. **Cakupan layar v1 rebuild:** apakah semua halaman di Bab 4 ikut di v1, atau dipangkas ke inti (Home, Transaksi, Tambah, Anggaran, Coach, Pengaturan) dulu?
4. **Keputusan adopsi Worthful — DIKUNCI 2026-11-05 (Ahmad setuju):**
   - MASUK v1: desain kartu per bank (warna khas + nama bank, tanpa logo resmi).
   - MASUK roadmap pasca-MVP (bukan v1): partner sharing.
   - DITOLAK: offline-first gratis, lifetime purchase unlimited, dan harga live investasi untuk net worth.
5. **Pembayaran — DIKUNCI 2026-11-05 (Ahmad: jangan pakai Stripe, tidak bisa daftar di situ):** Stripe dilarang total di PRD baru, termasuk sebagai fallback. Yang tetap: RevenueCat (in-app) + Xendit (web IDR/MYR). Pengganti Stripe untuk web global (USD/TRY/global) DIKUNCI 2026-11-05 ~10:21: **Paddle** (Merchant of Record; skill Paddle sudah terpasang sejak 27 Okt, alur sandbox-first).

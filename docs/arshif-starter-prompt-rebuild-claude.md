# Starter Prompt Rebuild Arshif (untuk Claude)

## Cara pakai (ini BUKAN bagian dari prompt — jangan ikut ditempel)

1. Siapkan dulu PRD baru dari spechkit.tech + dokumen inventaris fitur (`arshif-fitur-lengkap-prd.md`).
2. Isi semua slot bertanda `[ ... ]` di dalam prompt. Slot yang masih kosong akan membuat Claude bertanya dulu sebelum coding — itu disengaja, jangan dihapus aturannya.
3. Salin HANYA teks di antara `=== MULAI PROMPT ===` dan `=== AKHIR PROMPT ===`, lampirkan PRD + dokumen fitur, lalu tempel ke Claude (chat atau Claude Code).
4. Tunggu ringkasan pemahaman + pertanyaan kesiapan dari Claude sebelum menyuruh mulai Fase 0.

---

=== MULAI PROMPT ===

Halo! Kamu berperan sebagai Senior Fullstack Architect dan Lead Developer.
Saya ingin me-REBUILD aplikasi keuangan pribadi bernama **Arshif** dari nol. Baca PRD yang saya lampirkan (hasil spechkit.tech) dan dokumen inventaris fitur Arshif secara menyeluruh sebelum menjawab.

## 0. KEPUTUSAN YANG HARUS DIISI SEBELUM CODING

- **PRD acuan:** file PRD spechkit yang saya lampirkan + dokumen inventaris fitur Arshif.
- **Stack (PILIH SATU, hapus yang lain):** [ Expo SDK 52+ (Expo Router, TypeScript strict) / Next.js App Router + Drizzle ]
- **Nasib build lama (DIKUNCI 2026-11-05):** buang total — repo Fase 1–2 TIDAK dipakai sama sekali. TIDAK boleh dicopy kode, skema database, atau pola-nya. Satu-satunya sumber kebenaran adalah PRD spechkit + dokumen inventaris fitur. Repo lama hanya jadi daftar larangan di Bab 2A.
- **Keputusan adopsi Worthful (DIKUNCI 2026-11-05, jangan ditawar lagi):** v1 = desain kartu per bank (warna khas + nama bank, tanpa logo resmi bank); pasca-MVP = partner sharing; DITOLAK = offline-first gratis, lifetime purchase unlimited, dan harga live investasi untuk net worth. Monetisasi tetap subscription monthly/yearly (yearly dibuat hemat lewat Xendit untuk IDR/MYR).
- **Pembayaran (DIKUNCI 2026-11-05):** Stripe DILARANG TOTAL — Ahmad tidak bisa daftar di situ. Tetap: RevenueCat (in-app) + Xendit (web IDR/MYR) + **Paddle untuk web global USD/TRY/global (DIKUNCI 2026-11-05 ~10:21, Merchant of Record)**. Paddle hanya untuk web checkout, bukan in-app.
- **Arah desain — ini yang membuat Arshif TIDAK jadi klon Revolut, jadi wajib diisi:**
  - Tone/rasa: [ mis. fintech bersih-serius / premium / playful / minimal ]
  - Tema: [ dark saja / light saja / keduanya ]
  - Referensi visual: [ lampirkan 2–3 screenshot/pin + layar tujuannya + bagian mana yang wajib sama persis vs boleh adaptasi ]
  - Cakupan layar v1: [ semua halaman PRD / hanya Home, Transaksi, Tambah, Anggaran, Coach, Pengaturan ]
- **ATURAN:** Jika ada slot di atas yang masih kosong, JANGAN menebak dan JANGAN mulai coding. Tanyakan slot itu dulu, lalu tunggu jawaban saya.

## 1. KONTEKS PRODUK

- Arshif = asisten keuangan pribadi berbasis AI. Janji inti: mencatat pemasukan/pengeluaran dalam **kurang dari 10 detik** lewat **foto struk (OCR)**, **suara (Voice Log)**, atau **rekening koran PDF** — lalu AI mengelompokkan transaksi otomatis dan memberi saran keuangan personal.
- Pembeda: multi-mata uang real-time untuk **IDR, MYR, TRY, USD** — untuk pekerja lintas negara dan ekspatriat (Indonesia, Malaysia, Turki).
- Pengguna: Guest, Free (kuota terbatas), Premium (tanpa batas + PDF Export + alat pajak lengkap), Admin (panel web).
- Bahasa aplikasi: Indonesia, Melayu, Turki, Inggris. Bahasa default Indonesia yang ramah, sapaan "kamu".
- Prioritas fitur: Scan Struk & OCR dulu, lalu Voice Log. Notifikasi: in-app saja (tanpa push/email/WA di v1).

## 2. SUMBER KEBENARAN

- PRD spechkit = sumber kebenaran fitur, alur, dan limit Free/Premium. Dokumen inventaris fitur = cek silang. Kalau bertentangan, PRD spechkit menang — dan catat konfliknya di laporan fase.
- Jangan menambah fitur di luar PRD tanpa persetujuan saya.
- Repo lama BUKAN sumber kebenaran dan BUKAN referensi kode — jangan dibuka, jangan ditiru, jangan diimpor.

## 2A. DAFTAR LARANGAN DARI BUILD LAMA (JANGAN DIULANG)

- Dependensi tidak lengkap: `package.json` harus lengkap sejak awal dan diverifikasi dengan fresh install + build, bukan tambalan di `node_modules` (cacat lama: `expo-asset` dan `query-string` hilang).
- Mode mock TIDAK dihitung selesai: Fase 2 hanya sah kalau login sungguhan, scan sungguhan, dan kurs sungguhan sudah jalan live.
- RLS bolong: otorisasi per aksi di semua tabel, tanpa `service_role` di klien, dan setiap celah RLS harus dilaporkan sebelum diperbaiki.
- Over-engineering ala Claude: satu tugas satu fungsi, jangan bikin abstraksi berlapis-lapis kalau belum dibutuhkan, komponen maksimal sekitar 200 baris (pecah jika lebih).
- UI generik dan bug layout kecil dibiarkan: tiap layar wajib visual check lawan referensi, termasuk teks yang kepotong dan blank screen saat load pertama.
- Out of scope v1 (JANGAN dibangun): sinkronisasi bank otomatis (Open Banking), push notification, akun bersama/keluarga (partner sharing = pasca-MVP, bukan v1), investasi + harga live, offline-first gratis, lifetime purchase unlimited, import CSV/Excel, widget/wearable, e-Filing pajak, pembayaran split bill di dalam aplikasi.

## 3. URUTAN BUILD (FASE)

- **Fase 0 — Fondasi:** setup repo + design tokens (warna, tipografi, radius, spacing, ikon, bahasa gerak) + component library. Komponen wajib: Button, Card, Input, AmountInput, CurrencyText, Badge/ProBadge, Chip, ProgressBar, DonutChart interaktif, Gauge Health Score, grafik arus kas, BottomSheet, Dialog, Tabs, Skeleton, EmptyState, Toast, ListItem, CategoryIcon. JANGAN mulai halaman sebelum fondasi ini beres.
- **Fase 1 — UI semua layar v1** dengan data dummy realistis Bahasa Indonesia (DILARANG Lorem Ipsum). Setiap komponen wajib punya state loading, empty, error, dan limit-tercapai. Kartu akun di Home memakai desain per bank (warna khas + nama bank, tanpa logo resmi bank), bukan gradasi generik. Visual check: screenshot tiap layar, bandingkan berdampingan dengan referensi, perbaiki selisih penempatan/warna/tipografi sampai mendekati referensi — standar saya: sedekat mungkin (99% untuk bagian yang ditandai wajib sama).
- **Fase 2 — Backend:** database + RLS + Auth + Storage + Edge Functions (OCR struk, Voice Log, Import PDF, AI Coach, sync kurs) + data dinamis menggantikan dummy. Checkpoint WAJIB: jalan LIVE — login sungguhan, scan sungguhan, kurs sungguhan. Demo mode mock saja TIDAK dihitung selesai.
- **Fase 3 — Monetisasi & rilis:** RevenueCat (in-app) + Xendit (IDR/MYR) + Paddle (web global USD/TRY/global) untuk web checkout. **Stripe DILARANG TOTAL (keputusan 2026-11-05: Ahmad tidak bisa daftar Stripe)** — jangan pakai Stripe, termasuk sebagai fallback. Paddle hanya untuk web checkout, bukan in-app. Lalu hardening keamanan, SEO/ASO, performa, testing end-to-end, lalu deploy.

## 4. ATURAN EKSEKUSI MODE PHASE (WAJIB DIPATUHI)

1. Kerjakan PER FASE, tuntas dan berurutan, tanpa meminta konfirmasi di setiap task di dalam fase.
2. Setelah satu fase selesai tuntas, BERHENTI. Laporkan: checklist task yang selesai, file/folder utama yang dibuat, perintah untuk menjalankan & menguji, serta kendala/asumsi yang diambil. Lalu TUNGGU konfirmasi saya sebelum memulai fase berikutnya.
3. **PROGRESS.md:** ringkas progres di akhir tiap fase agar sesi baru (mis. habis limit) bisa lanjut tanpa mengulang. Jika konteks mulai panjang, ringkas dulu, baru lanjut.
4. **Git:** commit per fase dengan pesan yang jelas. Jangan force push, jangan rewrite history, jangan commit file `.env` atau secret.
5. JANGAN membuat halaman placeholder atau tulisan "segera hadir". Setiap layar v1 wajib lengkap dengan UI final.
6. **Satu fitur kompleks yang selesai penuh > lima halaman generik.** Jangan kejar jumlah halaman; kejar kedalaman: semua state (loading, empty, error, kuota habis, limit tercapai) harus ada dan berfungsi.
7. Verifikasi dengan menjalankan (build/test/run), bukan klaim. Laporkan perintah yang dijalankan beserta hasilnya. Jika gagal, laporkan errornya apa adanya — jangan membela percobaan pertama.

## 5. ATURAN DESAIN (ANTI-KLON + ANTI-SLOP)

- Identitas visual WAJIB berasal dari slot arah desain di Bab 0, BUKAN default "seperti Revolut". Pola UX boleh mirip standar fintech (bottom nav, kartu akun, donat budget) — tapi warna, tipografi, bentuk kartu, dan bahasa gerak harus milik Arshif sendiri.
- Referensi visual dipakai sebagai pengukur, bukan pajangan: tiap layar dibandingkan dengan referensinya dan selisihnya diperbaiki secara iteratif.
- Satu set ikon (Lucide), satu skala radius, satu bahasa gerak (spring/ease, 150–300ms, transform + opacity saja). Tanpa gradien ungu-biru generik, tanpa glow neon, tanpa badge dekoratif, tanpa hero generik.
- Data dummy realistis dan beragam sesuai pengguna ID/MY/TR (nama, merchant, nominal yang masuk akal). Angka di halaman publik hanya dari data asli.
- Kontras teks minimal WCAG AA, state focus terlihat, hormati `prefers-reduced-motion`.

## 6. ATURAN TEKNIS & KEAMANAN

- TypeScript strict. Komponen maksimal sekitar 200 baris — pecah jika lebih.
- Nominal uang: integer unit terkecil atau numeric presisi — JANGAN float. Format angka/mata uang lewat helper currency, bukan `toFixed` yang tersebar.
- Secret (kunci Gemini, Supabase service role, Xendit, RevenueCat, Paddle — BUKAN Stripe) HANYA di server/Edge Functions — tidak pernah di bundle klien, komentar, atau log. Validasi input di server (Zod). Otorisasi per aksi (setiap query dibatasi ke pemilik akun). RLS aktif di semua tabel. Webhook pembayaran terverifikasi signature-nya dan idempoten.
- Kuota & limit Free/Premium ditegakkan di server, bukan cuma disembunyikan di UI. Pekerjaan AI yang gagal TIDAK memotong kuota.
- Tambah/ubah test saat mengubah logika (kuota, konversi mata uang, parsing, simulasi utang).
- Catatan khusus Expo (abaikan jika stack = Next.js): pastikan `package.json` berisi `expo-asset` dan `query-string` di dependencies — cacat build lama: keduanya hanya ada di `node_modules` sehingga fresh install di mesin lain gagal. Verifikasi dengan fresh install + build.

## 7. CARA MULAI

Jika kamu sudah membaca dan memahami PRD, dokumen fitur, dan slot keputusan di atas, berikan ringkasan singkat pemahamanmu (tujuan produk, 3 cara input, struktur fase, dan arah desain yang kamu tangkap), lalu tanyakan kesiapan saya untuk mulai **Fase 0**. Jika ada slot yang masih kosong, tanyakan slot itu dulu — jangan mulai coding.

=== AKHIR PROMPT ===

# Catat Transaksi dari AI Coach: riset fitur

Pertanyaan: apakah user bisa mencatat transaksi langsung dari chat coach, dan
bagaimana bentuknya? Riset singkat: pola pemain lain, batasan teknis Gemini,
dan rekomendasi untuk Arshif.

## Apa yang dilakukan pemain lain

- Cleo: chat adalah antarmuka utamanya. Transaksi dari rekening bank di-label
  otomatis (merchant enrichment), lalu dijawab lewat chat ("habis belanja
  berapa bulan ini?"). Mode "deep dive" memakai model penalaran untuk pola.
- Monarch Money: asisten percakapan untuk pertanyaan, bukan pencatatan.
  Pencatatan tetap manual.
- Copilot Money: AI bekerja senyap di categorization, bukan dialog.
- OpenAI (ChatGPT finance view, Mei 2026): koneksi Plaid, menjawab pertanyaan,
  menampilkan dashboard. Juga tidak mencatat dari chat.
- Era: tanpa chatbot sendiri; data keuangan diekspos via MCP ke AI lain.
- Kesimpulan pasar: chat untuk MENANYA ada di semua pemain; chat untuk
  MENCATAT hampir tidak ada yang lakukan penuh. Celah inilah yang bisa diambil.

## Batasan teknis Gemini untuk fitur ini

- responseMimeType application/json TIDAK bisa dipakai bersama function
  calling di model 2.5 (error "Function calling with a response mime type
  'application/json' is unsupported"). Sudah jadi isu terbuka sejak 2025.
- Artinya: kalau pakai tool/function calling murni, output coach tidak lagi
  bisa dipaksa JSON schema.
- Dua jalan yang tetap bisa:
  1. Tanpa tool: coach diberi instruksi menandai transaksi dengan blok khusus
     di jawaban teks (misal blok fenced ```arshif-tx), server mengekstrak blok
     itu dengan regex lalu menyimpannya. Sederhana, tetap satu panggilan.
  2. Dengan tool (function calling): model memanggil "log_transaction".
     Lebih rapi secara semantik, tapi output bebas (bukan JSON schema),
     dan butuh dua langkah model (call lalu ringkasan) = 2x kuota.

## Rekomendasi untuk Arshif

Tahap 1 (disarankan dulu): tombol chip di bawah jawaban coach.
- Coach mendeteksi maksud "catat" ("catat kopi 25rb tadi pagi") dan membalas
  dengan blok data + pertanyaan pelengkap bila field kurang.
- UI menampilkan chip "Catat ke buku" yang membuka AddTransactionSheet dengan
  initial data. User melihat form asli, mengedit, lalu menyimpan sendiri.
- Kelebihan: saldo, idempotensi, dan validasi tetap lewat jalur yang sudah
  ada; tidak ada path tulis baru; tidak ada risiko AI mengubah data diam-diam.
- Kekurangan: butuh satu klik tambahan.

Tahap 2 (opsional, setelah tahap 1 terbukti): tulis langsung dari chat dengan
konfirmasi eksplisit. Data diposting lewat endpoint yang sama dengan form;
tombol "Ya, catat" milik user, bukan keputusan model. Pisahkan kuota chat
dan kuota tulis agar tidak bisa dipakai spam.

Batas token dan biaya: konteks coach sekarang memakai TOON (hemat 31% pada
data contoh; daftar transaksi seragam hemat hingga 57%). Menambah riwayat
transaksi lengkap ke chat tetap harus dibatasi: agregat dulu di client,
dan bila butuh detail, kirim hanya transaksi bulan berjalan dalam TOON.

## Yang tidak diadopsi

- Function calling penuh untuk menulis ke database langsung dari model.
- Mengirim seluruh riwayat transaksi dalam tiap chat (boros dan lambat).

# Cadangan akun (Pengaturan > Cadangan)

Satu file `.arshif` berisi semua data akun, terenkripsi AES-256-GCM dengan kunci pemulihan yang hanya dipegang pengguna.

## Isi file

- Ikut: akun, transaksi + item struk, budget, grup limit, kurs saya, tagihan, utang/piutang + pembayaran, goal + setoran,
  langganan, split bill, invoice, aset, alert harga, riwayat kekayaan bersih, preferensi profil (mata uang, gajian,
  tampilan, notifikasi, kategori buatan), dan foto/PDF struk bila toggle "Sertakan foto & PDF struk" menyala.
- Tidak ikut: paket Premium, kuota, pesanan (tidak boleh dipulihkan dari file), notifikasi, cache Coach,
  tautan Smart Log (khusus per HP).

## Format

`ARSHIFBK` | versi (1 byte) | panjang header (uint32 BE) | header JSON `{ createdAt, receipts }` | nonce 12 byte | AES-256-GCM.
Header ikut diautentikasi (AAD): mengubah header membuat file ditolak. Isi terenkripsi = JSON
`{ v: 1, profile, tables, receipts }` (struk sebagai base64). Kode: `src/lib/backup/crypto.ts`, `src/lib/backup/data.ts`.

## Kunci pemulihan

- 32 byte acak (`expo-crypto`), ditampilkan sekali sebagai base32 Crockford, 52 karakter dalam 13 grup.
  O/I/L yang tertukar dan huruf kecil tetap terbaca.
- Pengguna harus mengetik 4 karakter terakhir sebelum cadangan pertama dibuat.
- Android/iOS: disimpan di Secure Store supaya cadangan berikutnya memakai kunci yang sama. Web: tidak disimpan.
- Kunci hilang = cadangan tidak bisa dibuka siapa pun, termasuk Arshif. Itu disengaja.

## Pemulihan (gabung)

Fungsi database `restore_rows(p_table, p_rows)` (migrasi `20261122000026_restore_rows.sql`), SECURITY DEFINER dengan pengaman:
`user_id` selalu `auth.uid()`; update hanya baris milik pengguna yang sama (`where t.user_id = auth.uid()`);
kolom dibatasi ke kolom yang boleh ditulis klien + `id` (kolom turunan seperti `accounts.balance` tidak ikut);
trigger kepemilikan dan kuota paket tetap berjalan; daftar tabel dikunci. Baris yang gagal dilewati dan dihitung.
Struk diunggah ulang ke folder pengguna yang sedang masuk dan `receipt_path` transaksi disesuaikan.
Diuji di `scripts/db-test.mjs` (blok "cadangan").

## Pengingat

Per perangkat (AsyncStorage): Mati / tiap 7 hari / tiap 30 hari (bawaan 30). Saat jatuh tempo, menu Pengaturan
menampilkan "Waktunya cadangan".

## Google Drive

Scope `https://www.googleapis.com/auth/drive.file`: Arshif hanya bisa melihat dan membuat berkas yang dibuatnya sendiri.
Unggah resumable (tanpa batas 5 MB multipart). Layar Cadangan menampilkan status (terhubung sebagai email, atau belum)
dan riwayat cadangan di Drive (disimpan juga di perangkat); ketuk satu untuk memulihkan.
Web: login dengan pindah halaman, BUKAN popup (popup di browser HP/PWA terbuka sebagai tab baru sehingga aplikasi tampak
dibuka ulang). Google kembali ke `/pengaturan/cadangan#access_token=...`; token ditangkap di `_layout` (cek `state`),
dihapus dari URL, disimpan di sessionStorage sampai kedaluwarsa (1 jam). Android/iOS: expo-auth-session, token di memori.
Tanpa client ID untuk platform yang berjalan, semua tombol Drive disembunyikan.

| Variabel (EAS env / `.env`) | Isi |
|---|---|
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | OAuth client tipe "Web application". Authorized JavaScript origins: `https://arshif.biz.id`. Authorized redirect URIs: `https://arshif.biz.id/pengaturan/cadangan` (persis, tanpa garis miring di akhir) |
| `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` | OAuth client tipe "Android": package `app.arshif` + SHA-1 sertifikat (EAS: `eas credentials`, ambil SHA-1 keystore produksi dan upload Play) |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | OAuth client tipe "iOS": bundle ID `app.arshif` |

Langkah di Google Cloud Console: aktifkan Google Drive API; OAuth consent screen (eksternal, nama Arshif, domain
`arshif.biz.id`, kebijakan privasi), tambahkan scope `drive.file`; buat tiga client di atas. Cek di Console apakah
verifikasi aplikasi diminta untuk scope ini sebelum rilis publik.

## Build

`expo-secure-store` dan `expo-auth-session` butuh build native baru (bukan hanya update OTA).

## Belum selesai (menunggu client ID Google)

- iOS: tambahkan reversed client ID (`com.googleusercontent.apps.<id>`) ke `ios.infoPlist.CFBundleURLTypes` di `app.json`,
  supaya login Google bisa kembali ke aplikasi.
- Android: pastikan redirect `app.arshif:/oauthredirect` diterima (client Android dengan SHA-1 yang benar).
- Uji login + unggah + daftar + unduh di web, Android, dan iOS dengan akun Google sungguhan.

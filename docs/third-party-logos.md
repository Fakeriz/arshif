# Logo pihak ketiga: idn-finlogos

Artwork kartu (`src/components/ui/CardArt.tsx`, layar "Pilih Tampilan Kartu") memakai logo SVG dari paket npm
[`idn-finlogos`](https://github.com/hafidznoor/idn-finlogos) versi **2.5.0** (dipasang dengan versi exact).

## Lisensi

| Bagian | Lisensi |
|---|---|
| Aset logo SVG (`dist/icons/`) | **CC BY-NC 4.0**: https://creativecommons.org/licenses/by-nc/4.0/ (kurasi: Hafidz Noor Fauzi) |
| Kode pembungkus paket (JS/TS, skrip) | MIT |
| Logo itu sendiri | Merek dagang milik masing-masing bank, e-wallet, penyedia paylater, dan jaringan kartu |

Kewajiban CC BY-NC 4.0 dan cara Arshif memenuhinya:

- **Atribusi + tautan lisensi:** teks "Logo: idn-finlogos oleh Hafidz Noor Fauzi, lisensi CC BY-NC 4.0" di akhir daftar
  layar "Pilih Tampilan Kartu" (ketuk untuk membuka teks lisensi), komentar di `src/lib/finlogos.ts`, dan dokumen ini.
- **Tandai perubahan:** bentuk logo tidak diubah; logo hanya diskalakan dan dipasang langsung di atas warna kartu
  (latar SVG memang transparan, putih hanya ada di `clipPath` yang tidak digambar). **Warna diubah bila perlu
  kontras** (`fitLogo` di `src/lib/finlogos.ts`):
  - Logo bank/penyedia: bila ada warna logo dengan kontras < 3:1 terhadap kartu, semua warna logo diganti tinta
    kartu (putih di kartu gelap), dan bagian putih di dalam logo diganti warna kartu supaya potongannya tetap terbaca.
    Di kartu terang yang kontrasnya cukup, warna asli dipakai. Karena warna kartu = warna merek bank, semua logo
    bank di katalog saat ini tampil satu warna.
  - Logo jaringan: warna asli. Hanya logo satu warna yang gagal kontras (Visa, American Express di kartu biru/merah)
    diganti tinta kartu. Mastercard, JCB, GPN, UnionPay tidak pernah diwarnai ulang (versi satu warna membuat
    bentuknya yang bertumpuk menyatu).
- **NonCommercial:** aset tidak boleh dipakai untuk tujuan komersial. NOTICE paket juga menyebut pemakaian di produk
  komersial butuh izin pemilik merek masing-masing. Arshif punya paket berbayar (Premium); keputusan memakai paket ini
  diambil pemilik produk (Ahmad, 2026-11-08). Izin merek/lisensi komersial perlu diselesaikan sebelum rilis publik.

## Logo yang dipakai (slug diperiksa terhadap `dist/manifest.json`)

- **Bank & e-wallet (ID):** bca, mandiri, bri, bni, bsi, cimb-niaga, permata, jago, jenius, blu-bca, seabank,
  gopay, ovo, dana, shopee-pay
- **Paylater:** akulaku, kredivo, indodana; logo produk gopaylater (GoPay Later) dan akulaku-paylater (Akulaku PayLater)
- **Jaringan kartu:** visa, mastercard, jcb, gpn, american-express, union-pay

## Tidak ada di paket: memakai teks

- **Bank Malaysia:** Maybank, CIMB, Public Bank, RHB, Touch 'n Go. Catatan: paket punya slug `maybank` (Maybank
  Indonesia, kategori bank Indonesia). Sesuai keputusan, bank Malaysia tetap memakai teks.
- **Bank Turki:** Ziraat, İş Bankası, Akbank, Garanti BBVA, Yapı Kredi
- **Jaringan kartu:** troy (Turki)
- **Tunai:** tidak memakai logo.

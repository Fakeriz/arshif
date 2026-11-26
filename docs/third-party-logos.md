# Logo pihak ketiga di Arshif

Dokumen ini mencatat bagaimana Arshif menampilkan identitas visual kartu rekening dan ikon aset yang dilacak pengguna.

## 1. Kartu rekening (`BankCard`)

Kartu rekening (`src/components/ui/BankCard.tsx`) memakai warna identitas bank dan teks tanpa logo bank pihak ketiga. Paket `idn-finlogos` sudah dihapus dari proyek pada commit `418565f`.

## 2. Ikon aset (`AssetIcon`)

Ikon aset pada Tab Aset, detail aset, pemilih simbol (`SymbolPicker`), formulir aset, dan ringkasan portofolio (`RecapTab`) dikelola lewat `src/components/ui/AssetIcon.tsx`, `src/lib/assetIcons.ts`, dan snapshot slug `src/data/assetLogos.ts` (dibuat manual lewat `scripts/gen-asset-logos.mjs`).

Pencarian logo menggunakan rantai sumber publik bertingkat:

| Jenis aset | Urutan sumber logo | Fallback offline / gagal |
|---|---|---|
| Saham Indonesia (`stock_id` / IDX) | 1) TradingView badge 96px (`s3-symbol-logo.tradingview.com/<slug>--96.png` dari snapshot `IDX_LOGO_SLUGS`), 2) FinancialModelingPrep (`<CODE>.JK.png`) | Monogram Monokrom (SVG) |
| Saham & ETF AS (`stock_us` / US) | 1) TradingView badge 96px (`US_LOGO_SLUGS`), 2) FinancialModelingPrep (`<CODE>.png` dan varian `<CODE>` bertanda `-` untuk kelas saham seperti `BRK.B`), 3) jsDelivr `nvstly/icons` | Monogram Monokrom (SVG) |
| Kripto (`crypto`) | 1) TradingView (`crypto/XTVC<CODE>--96.png`), 2) CDN statis CoinGecko untuk 18 koin didukung (`COINGECKO_ICON_URLS`), 3) jsDelivr CC0 `spothq/cryptocurrency-icons` | Monogram Monokrom (SVG) |
| Emas (`gold`) & komoditas (`other`) | TradingView badge 96px (`metal/gold`, `metal/silver`, `metal/platinum`, `metal/palladium`, `metal/copper`, `crude-oil`, `natural-gas`, `gasoline`, `coal`, `coffee`, `wheat`, `corn`, `sugar`, `cocoa`, `cotton`) | Ikon semantik Lucide |
| Properti, kendaraan, aset manual lain, baris neraca | Tidak memanggil gambar remote | Ikon semantik Lucide sesuai sub-jenis |

## 3. Atribusi dan merek dagang

- Semua logo emiten saham, ETF, jaringan aset kripto, dan komoditas adalah merek dagang milik masing-masing penerbit atau pemilik haknya.
- Logo ditampilkan semata-mata untuk identifikasi nominatif kepemilikan yang dicatat pengguna di dalam Arshif, bukan bentuk afiliasi atau dukungan resmi.
- Koleksi fallback kripto `spothq/cryptocurrency-icons` berlisensi CC0 1.0 Universal (domain publik).
- Bila sumber gambar remote tidak tersedia atau perangkat sedang offline, `AssetIcon` selalu jatuh dengan aman ke monogram Monokrom atau ikon Lucide tanpa memblokir antarmuka.

# Arshif: Design System "Monokrom"

Revisi arah desain dari "Kaca & Aksen" ke **Monokrom**: tenang, padat informasi, dan terasa seperti alat keuangan yang serius. Referensi visual: kit kartu bergaya shadcn (versi gelap & terang), dan sejak 2026-11-20 palet batu & kertas serta bahasa gerak dari Talmo Studio. Desain semua layar ada di file `.pen` (pen.dev).

Sumber kebenaran nilai: `src/theme/tokens.ts`. Dokumen ini menjelaskan *kenapa* dan *bagaimana memakainya*.

---

## 1. Prinsip

1. **Angka adalah pahlawan.** Saldo, target, dan nominal tampil besar dan tebal; semua elemen lain mundur ke abu-abu.
2. **Warna = makna, bukan dekorasi.** Antarmuka hitam-putih-abu. Warna hanya muncul untuk naik/turun, peringatan, status, dan ikon kategori.
3. **Kedalaman lewat nada, bukan efek.** Tidak ada blur atau glow di panel. Lapisan dibedakan oleh selisih nada: kanvas → kartu → panel inset.
4. **Token pen.dev (revisi 2026-11-21).** Kartu 24, sheet/dialog 28, input/select/chip 14 (tinggi input 42), tombol pill (selebar teks 42, lebar penuh 48), tombol ikon 44 bulat, badge/toggle/segmented pill. Kotak ikon 32/40/48/56: ikon 45%, radius 30% (lingkaran kategori tetap bulat). Judul halaman besar rata kiri.
5. **Primary terbalik.** Tombol utama memakai warna teks sebagai latar: terang di tema gelap, hitam di tema terang.
6. **Aksesibel sejak token.** Setiap pasangan teks/latar ≥ 4.5:1, grafis ≥ 3:1, diuji otomatis di `__tests__/contrast.test.ts`.

---

## 2. Warna

### 2.1 Netral (per tema)

Palet **batu & kertas** (revisi 2026-11-20, mengikuti bahasa visual Talmo Studio): kanvas batu hangat, kartu kertas, panel inset abu kecokelatan. Netral hangat membuat kartu tinta (2.4) dan angka lebih menonjol dibanding abu-putih dingin.

| Token | Gelap | Terang | Pakai untuk |
|---|---|---|---|
| `bg` | `#0D0D0D` | `#E5E5E2` | Kanvas layar (batu) |
| `surface` / `glass` | `#161616` | `#F2F2F2` | Kartu utama (kertas) |
| `surfaceRaised` / `glassStrong` | `#262626` | `#FAFAFA` | Sheet, dialog, tab bar, popover |
| `surfaceSunken` | `#2B2B2B` | `#D8D6D4` | Panel inset di dalam kartu, isian input, tombol secondary |
| `border` / `glassBorder` | `rgba(255,255,255,.08)` | `rgba(8,8,8,.075)` | Garis kartu, pemisah baris |
| `borderStrong` | `rgba(255,255,255,.15)` | `rgba(8,8,8,.15)` | Tombol outline, checkbox kosong, kartu `outline` |
| `text` | `#E0E0E0` | `#0A0A0A` | Judul, angka, label utama |
| `textSecondary` | `#C9C9C9` | `#575655` | Subjudul kartu, deskripsi |
| `textMuted` | `#A4A4A4` | `#575655` | Label sumbu, placeholder, meta |
| `track` | `rgba(255,255,255,.10)` | `rgba(8,8,8,.10)` | Jalur progress bar, toggle mati |
| `overlay` | `rgba(0,0,0,.6)` | `rgba(0,0,0,.32)` | Latar di balik sheet/dialog |

> Nama `glass*` dipertahankan agar komponen lama tetap jalan, tapi nilainya kini **solid**. Komponen baru sebaiknya memakai `surface` / `surfaceRaised`.
>
> Teks gelap di tema gelap sengaja `#E0E0E0`, bukan putih penuh, agar tidak menyilaukan. Di tema terang `textSecondary` dan `textMuted` sama (`#575655`): abu yang lebih terang gagal 4.5:1 di atas panel inset `#D8D6D4`.

### 2.2 Semantik

| Token | Gelap | Terang | Aturan |
|---|---|---|---|
| `positive` | `#7FC79B` | `#265C3B` | Pemasukan, kenaikan, target tercapai |
| `negative` | `#F08A80` | `#A8322B` | Pengeluaran berlebih, over budget, error |
| `warning` | `#E0B05C` | `#7A4E00` | Status "Pending Setup", jatuh tempo dekat |
| `info` | `#9DB8DE` | `#3D5A80` | Tautan informatif, tips |

Hijau dan merah tanah yang kalem, bukan warna lampu lalu lintas. Setiap token punya pasangan `*Soft` (tinta 10–14%) untuk latar badge status. Badge status selalu memakai **titik berwarna + teks netral** (contoh: ● Pending Setup), bukan teks berwarna penuh.

**Teks berwarna semantik hanya di atas `bg` atau `surface`**, jangan di atas `surfaceSunken`: hijau terang di atas `#D8D6D4` hanya 4.38:1.

### 2.3 Aksen

**Tidak ada aksen berwarna** (dihapus 2026-11-20, monokrom seperti Talmo). `accent` = warna tinta: tombol primary, chip terpilih, segmented tinta, tab bar aktif. Pilihan warna aksen di Pengaturan sudah dihapus; kolom `profiles.accent` di database tidak lagi dibaca atau ditulis.

| | Gelap | Terang |
|---|---|---|
| `accent` (isi tombol primary) | `#E0E0E0` | `#0A0A0A` |
| `onAccent` | `#0A0A0A` | `#F4F4F4` |
| `accentText` (link, tombol ghost) | `#E0E0E0` | `#0A0A0A` |
| `accentSoft` (sorotan tipis) | `rgba(255,255,255,.08)` | `rgba(8,8,8,.06)` |
| `focus` (ring fokus) | `#C9C9C9` | `#575655` |

Permukaan tambahan dari Talmo: `surfaceAlt` (`#EDEDED` / `#1C1C1C`, track segmented & input gelap) dan `fill` (`rgba(8,8,8,.06)` / `rgba(255,255,255,.07)`, badge abu & toggle mati).

### 2.4 Kartu tinta

- **Kartu tinta (`inkCard`)**: tepat **satu per layar**, memegang angka terpenting layar itu (kekayaan bersih, saldo akun, total tagihan). Ini titik fokus dan motif identitas Arshif.
  - Terang: isi `#0A0A0A`, teks `#E0E0E0`, redup `#A4A4A4`.
  - Gelap: **terbalik**, isi `#E0E0E0`, teks `#0A0A0A`, redup `#575655`, naik `#22573A`, turun `#8C2621` (lebih gelap agar badge tren tetap 4.5:1). Kartu gelap di atas kanvas `#0D0D0D` tidak lagi menonjol, jadi dibalik agar tetap titik paling kontras.
  - Pakai komponen `InkCard` (`src/theme/ThemeProvider.tsx`): ia menimpa warna teks, naik/turun, dan track untuk semua anak, jadi `AppText`, `BalanceText`, dan `TrendBadge` otomatis benar. Contoh: `BalanceBlock` di Beranda.

### 2.5 Grafik

- **`chartRamp`**: 5 tingkat abu, dari data lama/kecil (paling pudar) ke sorotan (paling kontras). Bulan berjalan atau batang terpilih = indeks terakhir.
  - Gelap: `#3A3A3A → #525252 → #737373 → #A3A3A3 → #E5E5E5`
  - Terang: `#D4D4D4 → #A3A3A3 → #737373 → #404040 → #171717`
- **`chartArea`**: grafik garis, isian tipis di bawah garis abu (`#A3A3A3` gelap, `#737373` terang agar garis tetap 3:1 di kartu kertas), tanpa titik data kecuali disentuh.
- Batang memakai radius atas `radius.bar` (6), jarak antar batang ≈ 25% lebar batang.
- **`categoryHues`** kini skala abu (monokrom): kategori dibedakan ikon + label, irisan donut bersebelahan berselang terang/gelap. Kartu bank tetap memakai warna bank (identitas yang dikenali pengguna).

---

## 3. Tipografi

Satu keluarga: **Plus Jakarta Sans** (keputusan PRD tetap). Angka memakai `fontVariant: ['tabular-nums']`.

| Varian | Ukuran / tinggi baris | Bobot | Contoh di referensi |
|---|---|---|---|
| `balanceHero` | 38 / 42, -0.95 | SemiBold | Saldo utama Home |
| `amountHero` | 30 / 34, -0.6 | SemiBold | Nominal besar |
| `display` | 34 / 36, -0.85 | SemiBold | Lembar desain |
| `h1` | 28 / 30, -0.7 | SemiBold | **Judul halaman** (Talmo `.phead h1`) |
| `h2` | 20 / 25 | SemiBold | Judul seksi |
| `h3` | 15 / 19 | SemiBold | **Judul kartu** (Talmo `.chead h3`) |
| `body` / `bodyStrong` | 14 / 20 | Medium / SemiBold | Isi, nama item |
| `amount` | 14 / 20 | SemiBold | Nominal di baris |
| `caption` | 12.5 / 17 | Medium | Subjudul kartu, deskripsi baris, label |
| `overline` | 11 / 14 | SemiBold | Label kecil (sentence case, tanpa jarak huruf lebar) |
| `button` | 13.5 / 18 | SemiBold | Label tombol (lg: 15) |

Bobot judul 600 (SemiBold), bukan Bold, seperti Talmo. Teks di kolom isian memakai varian `input` (16/22): di bawah 16px Safari iOS memperbesar halaman saat kolom difokus.

Hierarki di dalam kartu selalu: `h3` (text) → `caption` (textSecondary) → konten.

---

## 4. Bentuk, ruang, elevasi

### Radius (`radius`)

| Alias | Nilai | Untuk |
|---|---|---|
| `card` / `lg` | 24 | Kartu, skeleton kartu, panel mengambang |
| `inset` | 14 | Panel di dalam kartu, textarea |
| `button` | 999 | Semua tombol (pill); tinggi 42 selebar teks, 48 lebar penuh |
| `chip` | 14 | Chip filter (satu keluarga dengan input) |
| `seg` / `segItem` | 999 / 999 | Track dan thumb segmented control (pill) |
| `field` | 14 | Input satu baris, select, tanggal (tinggi 42) |
| `badge` | 999 | Badge hitungan & status |
| `control` | 999 | Toggle, tombol ikon bulat 44 |
| `bar` | 6 | Batang grafik |
| `sheet` | 28 | Bottom sheet, dialog |

Kotak ikon (`iconBox`): tentukan container dulu (32/40/48/56), ikon = 45% dibulatkan genap (14/18/22/24), radius = 30% (10/12/14/16). Lingkaran kategori tetap bulat, ikonnya ikut tabel. Target ketuk minimal 44 lewat `hitSlop` bila visual lebih kecil.

### Ruang (`space`, `layout`)

- Grid 4 pt. Tepi layar `layout.screenGutter` = 16.
- Padding kartu `layout.cardPadding` = 16; padding panel inset `layout.insetPadding` = 12.
- Jarak antar kartu `layout.cardGap` = 12.
- Di dalam kartu: judul → subjudul 2, subjudul → konten 16, antar baris 12.

### Elevasi (`elevation`)

- **Gelap:** tanpa bayangan; kartu `#161616` di kanvas `#0D0D0D` sudah cukup.
- **Terang:** kartu kertas `#F2F2F2` dengan bayangan tipis (`#080808`, `opacity .08, radius 14, y 8`) + garis `border`; tombol primary punya bayangan sendiri (`elevation.light.primary`).
- `floating` (tab bar, sheet, toast) memakai bayangan lebih tegas di kedua tema.
- Blur hanya untuk tab bar mengambang (`layout.blur.floating`); panel tidak blur.

### Ukuran kontrol

Tombol `lg 50 / md 40 / sm 32` (bawaan `md`), input 42, segmented item 40 + padding 4, toggle 42×24, ikon Lucide stroke 1.75 ukuran 16/20/24.

---

## 5. Komponen

| Komponen | Spesifikasi |
|---|---|
| **Card** | `surface`, radius `card`, padding 18/20, garis `border`; terang + `elevation.light.card`. Header: judul `h3` + subjudul `caption` redup. |
| **Panel inset** | `surfaceSunken`, radius `inset`, padding 12. |
| **Button primary** | Pill (`radius.button`), tinggi 42 selebar teks / 48 lebar penuh, isi `accent`, teks `onAccent`, bayangan primary di tema terang. |
| **Button secondary** | Isi kertas (`surface`; gelap `surfaceAlt`) + garis `borderStrong`, teks `text`. |
| **Button danger** | Seperti secondary, teks `negative`. |
| **Button ghost** | Teks `accentText` saja. |
| **Segmented (`Tabs`)** | Gaya Arshif Motion Kit: track pill `surfaceSunken`, padding 4, tanpa garis; item tinggi 40, `bodyStrong` redup; terpilih: thumb pill (`surfaceRaised`, gelap `surface`) dengan bayangan lembut. Varian `tone="ink"`: thumb tinta. Jangan dibungkus `Card` sendiri. |
| **Tabs underline** | Tinggi 42, `bodyStrong` redup, terpilih `text` + garis bawah tinta 2 px. |
| **Chip** | Tinggi 36, radius 14, isi kertas + garis `border`, `caption` SemiBold redup. Terpilih: isi tinta, teks `onAccent`, tanpa centang. |
| **Input / Select** | Radius 14, tinggi 42, isi kertas (gelap `surfaceAlt`) + garis `borderStrong`; fokus garis tinta 1.5 px. |
| **Badge** | Pill tinggi 20, isi `fill`, `overline` SemiBold. Status memakai `*Soft` + warna semantik. |
| **Toggle** | 42×24 pill, kenop putih 18 (gelap+aktif: hitam); mati `fill` + garis, aktif `accent`. |
| **Progress bar** | Satu komponen `ProgressBar`: tinggi 8, pill (jalur dan isian), jalur `track`, isi menurut status (aman/peringatan/lewat) atau `accent` untuk progres netral; di kartu tinta warna ikut terbalik. Transisi 500 ms. |
| **Baris daftar (`ListItem`)** | Padding vertikal 14, celah 14, garis pemisah `border`; judul `bodyStrong`, keterangan `caption` redup. |
| **Grup menu (`MenuGroup`)** | Label grup `caption` SemiBold redup; kartu padding sisi 20; ikon 18 `textMuted` tanpa kotak (Talmo `.menu__item`). |
| **Header layar (`ScreenHeader`)** | Baris tombol bulat 44 (kembali kiri, aksi kanan), lalu judul `h1` rata kiri + subjudul opsional. |
| **Tab bar** | Pill kaca mengambang (radius penuh), tab aktif berlatar `accentSoft` dengan ikon dan label tinta; tombol "+ Catat" bulat tinta 52 di tengah. |
| **Empty state** | Ikon 20 dalam lingkaran 52 `surfaceRaised` bergaris, judul `h3`, pesan `caption` redup, satu tombol `md`. |
| **Fade-out list** | Item yang terpotong di dasar kartu memudar (`opacity.faded`) sebagai isyarat ada lanjutan. |

---

## 6. Pola layar finansial

- **Kartu saldo:** overline label → `amountHero` → badge status → panel inset berisi rincian (label `caption` kiri, `amount` kanan, garis pemisah sebelum total) → catatan `caption`.
- **Target tabungan:** tumpukan panel inset; tiap panel: overline nama → nominal `amountHero` → progress → keterangan. Target yang belum aktif tampil dengan `textMuted`.
- **Riwayat/arus kas:** grafik batang `chartRamp`, label bulan `caption` muted di bawah, panel inset ringkasan di bawah grafik, tombol primary "Lihat laporan".
- **Form (target, ambang):** label `bodyStrong` → input radius `field`; dua field sebaris jika pendek (nominal + tanggal). Nominal besar yang sedang diatur ditampilkan sebagai `amountHero` di kanan label.
- **Zona bahaya:** dipisah garis, ikon `negative`, teks tetap netral; aksi destruktif lewat dialog konfirmasi.

---

## 7. Gerak

Tidak berubah dari `motion.ts`: 150 / 220 / 300 ms, hanya transform + opacity, tekan skala 0.97, haptic hanya pada primary. Hormati reduce motion.

**Ganti tema (web):** lingkaran yang membesar dari titik ketuk, 600 ms `cubic-bezier(.22,1,.36,1)`, lewat View Transitions (`src/theme/viewTransition.web.ts`), seperti Talmo. Native dan reduce motion: langsung berganti.

### 7.1 Mikro-interaksi (Motion Kit)

Diadaptasi dari kit referensi mikro-interaksi, disaring lewat aturan Monokrom: tanpa gradasi, tanpa warna dekoratif, hanya transform + opasitas. Contoh hidup: Lembar Desain, seksi "Gerak".

**Blok bangun** (`src/theme/motion.ts`, `components/ui/PopIn.tsx`):

| Blok | Gerak | Pakai untuk |
|---|---|---|
| `usePresence` / `PopIn` | skala + opasitas dengan pegas, elemen tetap terpasang | centang, lencana hitungan, tombol kirim, sorotan baris |
| `useEnter` / `PopOnMount` | masuk sekali saat dipasang (geser/skala), bisa bergiliran lewat `delay` | opsi menu, gelembung chat, avatar baru, ikon yang berganti |
| `RollingNumber` | hanya karakter yang berubah yang bergulir, searah perubahan | nominal, penghitung, hitung mundur |

**Komponen yang ditingkatkan:** `Checkbox` (isi tumbuh + centang meletup), `Chip` (centang meletup), `Toggle` (jalur crossfade), `Button` (`done`), `Input` (`valid`), `Dialog` (masuk dengan pegas).

**Komponen baru:** `Stepper`, `Slider`, `RadioList`, `Select`, `Accordion`, `Tooltip`, `StarRating`, `OtpInput`, `Calendar`, `Composer`, `ChatBubble` + `TypingDots`, `Countdown`, `MiniBars`, `StepList`, `UploadProgress`, `VoicePlayer`, `AvatarStack`, `SpeedDial`.

Aturan tambahan:
- **Tinggi tidak dianimasikan.** `Accordion` dan `Select` mengubah tinggi langsung; yang bergerak isinya (geser + pudar) dan panahnya.
- **Status berhasil bukan nonaktif.** `Button done` menahan tekanan tanpa meredup.
- **Terisi = warna teks.** Bintang, batang terpilih, dan batang gelombang yang sudah diputar memakai `text` / ujung `chartRamp`, bukan aksen berwarna.
- Gerak berulang (`TypingDots`, karet `OtpInput`) diam saat reduce motion.


---

## 8. Migrasi dari "Kaca & Aksen"

Sudah dilakukan di token:
- Nilai `palettes` → netral monokrom; `glass*` jadi solid.
- Aksen `netral` + jadi `DEFAULT_ACCENT`; label i18n 4 bahasa; migrasi `20261113000015_accent_netral.sql` (check constraint + default kolom).
- Skala radius dan tipe dipadatkan; token baru `chartRamp`, `chartArea`, `elevation`, `opacity`, `layout.screenGutter/cardPadding/insetPadding/cardGap`.

Langkah lanjutan di komponen:
1. `Button`, `Input`, `Chip`, `Badge`, `Toggle` → `radius.control`.
2. `Card` → `radius.card`, tambah `elevation[scheme].card`; `GlassView` boleh render `View` biasa bila `layout.blur.panel === 0`. Bagian `GlassView` selesai: panel selalu solid `glass` (`#161616` gelap), tanpa blur; hanya lapisan `floating` yang memakai `glassStrong`.
3. `AmbientGlow` → dihapus total untuk semua aksen. Selesai: komponen, ekspornya, dan pemakaiannya di `Screen`, `BootScreen`, `design.tsx` sudah dihapus.
4. `CashflowChart`, `HealthGauge`, `ProgressBar` → `chartRamp` / `text` sebagai isi.
5. Visual check tiap layar lawan referensi (aturan PRD), dua tema.

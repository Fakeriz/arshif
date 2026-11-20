# Arshif: Design System "Monokrom"

Revisi arah desain dari "Kaca & Aksen" ke **Monokrom**: tenang, padat informasi, dan terasa seperti alat keuangan yang serius. Referensi visual: kit kartu bergaya shadcn (versi gelap & terang), dan sejak 2026-11-20 palet batu & kertas serta bahasa gerak dari Talmo Studio. Desain semua layar ada di file `.pen` (pen.dev).

Sumber kebenaran nilai: `src/theme/tokens.ts`. Dokumen ini menjelaskan *kenapa* dan *bagaimana memakainya*.

---

## 1. Prinsip

1. **Angka adalah pahlawan.** Saldo, target, dan nominal tampil besar dan tebal; semua elemen lain mundur ke abu-abu.
2. **Warna = makna, bukan dekorasi.** Antarmuka hitam-putih-abu. Warna hanya muncul untuk naik/turun, peringatan, status, dan ikon kategori.
3. **Kedalaman lewat nada, bukan efek.** Tidak ada blur atau glow di panel. Lapisan dibedakan oleh selisih nada: kanvas → kartu → panel inset.
4. **Bentuk mengikuti peran.** Yang ditekan (tombol, chip, toggle) berbentuk pill; isian (input, select) kotak lembut radius 14; badge radius 8. Perbedaan bentuk membuat isian dan tombol langsung terbedakan.
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
| `positive` | `#7FC79B` | `#2E6B46` | Pemasukan, kenaikan, target tercapai |
| `negative` | `#F08A80` | `#A8322B` | Pengeluaran berlebih, over budget, error |
| `warning` | `#E0B05C` | `#8A5A00` | Status "Pending Setup", jatuh tempo dekat |
| `info` | `#9DB8DE` | `#3D5A80` | Tautan informatif, tips |

Hijau dan merah tanah yang kalem, bukan warna lampu lalu lintas. Setiap token punya pasangan `*Soft` (tinta 10–14%) untuk latar badge status. Badge status selalu memakai **titik berwarna + teks netral** (contoh: ● Pending Setup), bukan teks berwarna penuh.

**Teks berwarna semantik hanya di atas `bg` atau `surface`**, jangan di atas `surfaceSunken`: hijau terang di atas `#D8D6D4` hanya 4.38:1.

### 2.3 Aksen

`netral` adalah **default**: `accent` = warna teks, `onAccent` = warna kertas, tanpa glow.
Aksen berwarna lama (Merah, Kuningan, Zamrud, Biru, Ungu) tetap tersedia di Pengaturan (FR-SET-4) dan lolos AA di palet batu. Tidak ada aksen yang memakai glow: `AmbientGlow` sudah dihapus.

| | Gelap | Terang |
|---|---|---|
| `accent` (isi tombol primary) | `#E0E0E0` | `#0A0A0A` |
| `onAccent` | `#0A0A0A` | `#F4F4F4` |
| `accentText` (link, tombol ghost) | `#E0E0E0` | `#0A0A0A` |
| `accentSoft` (chip/nav terpilih) | `rgba(255,255,255,.08)` | `rgba(8,8,8,.06)` |
| `focus` (ring fokus) | `#C9C9C9` | `#575655` |

### 2.4 Kartu tinta & brass

- **Kartu tinta (`inkCard`)**: tepat **satu per layar**, memegang angka terpenting layar itu (kekayaan bersih, saldo akun, total tagihan). Ini titik fokus dan motif identitas Arshif.
  - Terang: isi `#0A0A0A`, teks `#E0E0E0`, redup `#A4A4A4`.
  - Gelap: **terbalik**, isi `#E0E0E0`, teks `#0A0A0A`, redup `#575655`, naik `#22573A`, turun `#8C2621` (lebih gelap agar badge tren tetap 4.5:1). Kartu gelap di atas kanvas `#0D0D0D` tidak lagi menonjol, jadi dibalik agar tetap titik paling kontras.
  - Pakai komponen `InkCard` (`src/theme/ThemeProvider.tsx`): ia menimpa warna teks, naik/turun, dan track untuk semua anak, jadi `AppText`, `BalanceText`, dan `TrendBadge` otomatis benar. Contoh: `BalanceBlock` di Beranda.
- **Brass (`brass`)**: satu-satunya aksen berwarna, **khusus tag mata uang** (IDR/MYR/TRY/USD), karena multi-mata uang adalah pembeda produk. Terang `#735214`, gelap `#D9B26A`. Tidak dipakai untuk tombol, bar budget, atau dekorasi.

### 2.5 Grafik

- **`chartRamp`**: 5 tingkat abu, dari data lama/kecil (paling pudar) ke sorotan (paling kontras). Bulan berjalan atau batang terpilih = indeks terakhir.
  - Gelap: `#3A3A3A → #525252 → #737373 → #A3A3A3 → #E5E5E5`
  - Terang: `#D4D4D4 → #A3A3A3 → #737373 → #404040 → #171717`
- **`chartArea`**: grafik garis, isian tipis di bawah garis abu (`#A3A3A3` gelap, `#737373` terang agar garis tetap 3:1 di kartu kertas), tanpa titik data kecuali disentuh.
- Batang memakai radius atas `radius.bar` (6), jarak antar batang ≈ 25% lebar batang.
- **`categoryHues`** tetap dipakai untuk donut kategori dan ikon kategori, satu-satunya tempat warna bebas muncul.

---

## 3. Tipografi

Satu keluarga: **Plus Jakarta Sans** (keputusan PRD tetap). Angka memakai `fontVariant: ['tabular-nums']`.

| Varian | Ukuran / tinggi baris | Bobot | Contoh di referensi |
|---|---|---|---|
| `balanceHero` | 40 / 46, -1.4 | Bold | Saldo utama Home |
| `amountHero` | 32 / 38, -1 | Bold | "$1,211.29", "$420,000" |
| `display` | 30 / 36 | Bold | Layar kosong, onboarding |
| `h1` | 24 / 30 | Bold | Judul layar |
| `h2` | 19 / 26 | SemiBold | Judul seksi |
| `h3` | 16 / 22 | SemiBold | **Judul kartu** ("Contribution History") |
| `body` / `bodyStrong` | 15 / 22 | Regular / SemiBold | Isi, nama item |
| `amount` | 15 / 22 | SemiBold | Nominal di baris ("$1,248.75") |
| `caption` | 13 / 18 | Regular | **Subjudul kartu**, deskripsi baris, label sumbu |
| `overline` | 11 / 14, +0.8 | SemiBold | "UPCOMING", "RETIREMENT" (tulis kapital) |
| `button` | 14 / 18 | SemiBold | Label tombol |

Hierarki di dalam kartu selalu: `h3` (text) → `caption` (textSecondary) → konten.

---

## 4. Bentuk, ruang, elevasi

### Radius (`radius`)

| Alias | Nilai | Untuk |
|---|---|---|
| `card` | 20 | Kartu utama |
| `inset` | 14 | Panel di dalam kartu, textarea, baris daftar berlatar |
| `control` | 999 | Tombol, chip, toggle |
| `field` | 14 | Input satu baris, select |
| `badge` | 8 | Badge status dan delta (`TrendBadge`) |
| `bar` | 6 | Batang grafik |
| `sheet` | 28 | Bottom sheet, dialog |

Aturan bersarang: radius dalam = radius luar − padding (20 − 16 ≈ 4 → dibulatkan ke 14 untuk panel inset yang tetap terasa lembut).

### Ruang (`space`, `layout`)

- Grid 4 pt. Tepi layar `layout.screenGutter` = 16.
- Padding kartu `layout.cardPadding` = 16; padding panel inset `layout.insetPadding` = 12.
- Jarak antar kartu `layout.cardGap` = 12.
- Di dalam kartu: judul → subjudul 2, subjudul → konten 16, antar baris 12.

### Elevasi (`elevation`)

- **Gelap:** tanpa bayangan; kartu `#161616` di kanvas `#0D0D0D` sudah cukup.
- **Terang:** kartu kertas `#F2F2F2` dengan bayangan tipis (`#080808`, `opacity .12, radius 20, y 12`) + garis `border`.
- `floating` (tab bar, sheet, toast) memakai bayangan lebih tegas di kedua tema.
- Blur hanya untuk tab bar mengambang (`layout.blur.floating`); panel tidak blur.

### Ukuran kontrol

Tombol `lg 48 / md 40 / sm 32`, input 44, ikon Lucide stroke 1.75 ukuran 16/20/24.

---

## 5. Komponen

| Komponen | Spesifikasi |
|---|---|
| **Card** | `surface`, radius `card`, padding 16, border `border`; terang + `elevation.light.card`. Header: judul `h3` + subjudul `caption`; aksi kanan berupa tombol ikon bulat 28 (`surfaceSunken`) atau tombol pill `sm` outline. |
| **Panel inset** | `surfaceSunken`, radius `inset`, padding 12. Untuk ringkasan 2 kolom ("UPCOMING / SAVINGS PLAN"), rincian biaya, kartu target bertumpuk. |
| **Button primary** | Pill, isi `accent`, teks `onAccent`. Satu per kartu; biasanya lebar penuh di dasar kartu. |
| **Button secondary** | Pill, isi `surfaceSunken`, teks `text`. |
| **Button outline** | Pill, transparan, border `borderStrong`. Untuk "Cancel", "View Analytics". |
| **Button ghost** | Teks `accentText` saja, untuk "FORGOT?" (gaya `overline`). |
| **Input / Select** | Radius `field` (14) tinggi 44, isi `surfaceSunken`, tanpa border; placeholder `textMuted`; ikon kanan 16 `textMuted`. Fokus: ring 2 px `focus`. |
| **Textarea** | Radius `inset`, min 88 tinggi, isi `surfaceSunken`. |
| **Badge** | Radius `badge` (8) tinggi 22, `caption` 12 SemiBold. Varian: solid (`accent`/`onAccent`), soft (`surfaceSunken`), outline, status (titik 6 px semantik + teks). Delta kecil ("+10%") memakai badge solid. |
| **Checkbox** | 16×16, radius 4. Tercentang: isi `accent`, centang `onAccent`. Kosong: `surfaceSunken`. Label `bodyStrong` + deskripsi `caption`. |
| **Toggle** | Pill 36×20; aktif `accent`, mati `track`. |
| **Progress bar** | Tinggi 6, pill, jalur `track`, isi `text`. Di bawahnya: kiri "65% achieved" (`caption` secondary), kanan nominal (`amount`). |
| **List / Nav item** | Tinggi 36, ikon 16 + label `caption` 14 Medium. Terpilih: latar `accentSoft`, radius `inset`. Grup diberi label `caption` muted. |
| **Row navigasi** | Panel inset berisi ikon + judul `bodyStrong` + deskripsi `caption` + chevron `textMuted` di kanan. |
| **Breadcrumb** | `caption`, separator chevron 12, item terakhir `text`. |
| **Empty state** | Ikon dalam lingkaran 40 `surfaceSunken`, judul `h3`, deskripsi `caption` di tengah, satu tombol pill `sm`. |
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

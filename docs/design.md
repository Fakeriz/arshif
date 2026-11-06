# Arshif: Design System "Monokrom"

Revisi arah desain dari "Kaca & Aksen" ke **Monokrom**: tenang, padat informasi, dan terasa seperti alat keuangan yang serius. Referensi visual: kit kartu bergaya shadcn (versi gelap & terang) yang berisi riwayat kontribusi, saldo klaim, target tabungan, ambang payout, dividen, notifikasi, dan pengaturan akun.

Sumber kebenaran nilai: `src/theme/tokens.ts`. Dokumen ini menjelaskan *kenapa* dan *bagaimana memakainya*.

---

## 1. Prinsip

1. **Angka adalah pahlawan.** Saldo, target, dan nominal tampil besar dan tebal; semua elemen lain mundur ke abu-abu.
2. **Warna = makna, bukan dekorasi.** Antarmuka hitam-putih-abu. Warna hanya muncul untuk naik/turun, peringatan, status, dan ikon kategori.
3. **Kedalaman lewat nada, bukan efek.** Tidak ada blur atau glow di panel. Lapisan dibedakan oleh selisih nada: kanvas → kartu → panel inset.
4. **Satu bentuk kontrol.** Semua tombol, input satu baris, select, chip, dan badge berbentuk pill.
5. **Primary terbalik.** Tombol utama memakai warna teks sebagai latar: terang di tema gelap, hitam di tema terang.
6. **Aksesibel sejak token.** Setiap pasangan teks/latar ≥ 4.5:1, grafis ≥ 3:1, diuji otomatis di `__tests__/contrast.test.ts`.

---

## 2. Warna

### 2.1 Netral (per tema)

| Token | Gelap | Terang | Pakai untuk |
|---|---|---|---|
| `bg` | `#09090B` | `#F3F3F3` | Kanvas layar |
| `surface` / `glass` | `#121214` | `#FFFFFF` | Kartu utama |
| `surfaceRaised` / `glassStrong` | `#1F1F1F` | `#FFFFFF` | Sheet, dialog, tab bar, popover |
| `surfaceSunken` | `#262626` | `#F4F4F4` | Panel inset di dalam kartu, isian input, tombol secondary |
| `border` / `glassBorder` | `rgba(255,255,255,.06)` | `rgba(0,0,0,.06)` | Garis kartu, pemisah baris |
| `borderStrong` | `rgba(255,255,255,.12)` | `rgba(0,0,0,.12)` | Tombol outline, checkbox kosong, kartu `outline` |
| `text` | `#FAFAFA` | `#0A0A0A` | Judul, angka, label utama |
| `textSecondary` | `#ABABAB` | `#525252` | Subjudul kartu, deskripsi |
| `textMuted` | `#8F8F8F` | `#636363` | Label sumbu, placeholder, meta |
| `track` | `rgba(255,255,255,.10)` | `rgba(0,0,0,.08)` | Jalur progress bar, toggle mati |
| `overlay` | `rgba(0,0,0,.64)` | `rgba(0,0,0,.32)` | Latar di balik sheet/dialog |

> Nama `glass*` dipertahankan agar komponen lama tetap jalan, tapi nilainya kini **solid**. Komponen baru sebaiknya memakai `surface` / `surfaceRaised`.

### 2.2 Semantik

| Token | Gelap | Terang | Aturan |
|---|---|---|---|
| `positive` | `#5BD69A` | `#15803D` | Pemasukan, kenaikan, target tercapai |
| `negative` | `#F87171` | `#B91C1C` | Pengeluaran berlebih, over budget, error |
| `warning` | `#E5B54A` | `#8A5A00` | Status "Pending Setup", jatuh tempo dekat |
| `info` | `#8AB4F8` | `#1D4ED8` | Tautan informatif, tips |

Setiap token punya pasangan `*Soft` (tinta 8–12%) untuk latar badge status. Badge status selalu memakai **titik berwarna + teks netral** (contoh: ● Pending Setup), bukan teks berwarna penuh.

### 2.3 Aksen

`netral` adalah **default baru**: `accent` = warna teks, `onAccent` = warna kanvas, tanpa glow.
Aksen berwarna lama (Merah, Kuningan, Zamrud, Biru, Ungu) tetap tersedia di Pengaturan (FR-SET-4). Tidak ada aksen yang memakai glow: `AmbientGlow` sudah dihapus.

| | Gelap | Terang |
|---|---|---|
| `accent` (isi tombol primary) | `#EDEDED` | `#0A0A0A` |
| `onAccent` | `#0A0A0A` | `#FFFFFF` |
| `accentText` (link, tombol ghost) | `#FAFAFA` | `#0A0A0A` |
| `accentSoft` (chip/nav terpilih) | `rgba(255,255,255,.08)` | `rgba(0,0,0,.05)` |
| `focus` (ring fokus) | `#D4D4D4` | `#525252` |

### 2.4 Grafik

- **`chartRamp`**: 5 tingkat abu, dari data lama/kecil (paling pudar) ke sorotan (paling kontras). Bulan berjalan atau batang terpilih = indeks terakhir.
  - Gelap: `#3A3A3A → #525252 → #737373 → #A3A3A3 → #E5E5E5`
  - Terang: `#D4D4D4 → #A3A3A3 → #737373 → #404040 → #171717`
- **`chartArea`**: grafik garis, isian tipis di bawah garis abu (`#A3A3A3` gelap, `#737373` terang agar garis tetap 3:1 di kartu putih), tanpa titik data kecuali disentuh.
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
| `control` | 999 | Tombol, input, select, chip, badge, toggle |
| `bar` | 6 | Batang grafik |
| `sheet` | 28 | Bottom sheet, dialog |

Aturan bersarang: radius dalam = radius luar − padding (20 − 16 ≈ 4 → dibulatkan ke 14 untuk panel inset yang tetap terasa lembut).

### Ruang (`space`, `layout`)

- Grid 4 pt. Tepi layar `layout.screenGutter` = 16.
- Padding kartu `layout.cardPadding` = 16; padding panel inset `layout.insetPadding` = 12.
- Jarak antar kartu `layout.cardGap` = 12.
- Di dalam kartu: judul → subjudul 2, subjudul → konten 16, antar baris 12.

### Elevasi (`elevation`)

- **Gelap:** tanpa bayangan; kartu `#121214` di kanvas `#09090B` sudah cukup.
- **Terang:** kartu putih dengan bayangan sangat tipis (`opacity .04, radius 12`) + garis `border`.
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
| **Input / Select** | Pill tinggi 44, isi `surfaceSunken`, tanpa border; placeholder `textMuted`; ikon kanan 16 `textMuted`. Fokus: ring 2 px `focus`. |
| **Textarea** | Radius `inset`, min 88 tinggi, isi `surfaceSunken`. |
| **Badge** | Pill tinggi 22, `caption` 12 SemiBold. Varian: solid (`accent`/`onAccent`), soft (`surfaceSunken`), outline, status (titik 6 px semantik + teks). Delta kecil ("+10%") memakai badge solid. |
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
- **Form (target, ambang):** label `bodyStrong` → input pill; dua field sebaris jika pendek (nominal + tanggal). Nominal besar yang sedang diatur ditampilkan sebagai `amountHero` di kanan label.
- **Zona bahaya:** dipisah garis, ikon `negative`, teks tetap netral; aksi destruktif lewat dialog konfirmasi.

---

## 7. Gerak

Tidak berubah dari `motion.ts`: 150 / 220 / 300 ms, hanya transform + opacity, tekan skala 0.97, haptic hanya pada primary. Hormati reduce motion.

---

## 8. Migrasi dari "Kaca & Aksen"

Sudah dilakukan di token:
- Nilai `palettes` → netral monokrom; `glass*` jadi solid.
- Aksen `netral` + jadi `DEFAULT_ACCENT`; label i18n 4 bahasa; migrasi `20261113000015_accent_netral.sql` (check constraint + default kolom).
- Skala radius dan tipe dipadatkan; token baru `chartRamp`, `chartArea`, `elevation`, `opacity`, `layout.screenGutter/cardPadding/insetPadding/cardGap`.

Langkah lanjutan di komponen:
1. `Button`, `Input`, `Chip`, `Badge`, `Toggle` → `radius.control`.
2. `Card` → `radius.card`, tambah `elevation[scheme].card`; `GlassView` boleh render `View` biasa bila `layout.blur.panel === 0`. Bagian `GlassView` selesai: panel selalu solid `glass` (`#121214` gelap), tanpa blur; hanya lapisan `floating` yang memakai `glassStrong`.
3. `AmbientGlow` → dihapus total untuk semua aksen. Selesai: komponen, ekspornya, dan pemakaiannya di `Screen`, `BootScreen`, `design.tsx` sudah dihapus.
4. `CashflowChart`, `HealthGauge`, `ProgressBar` → `chartRamp` / `text` sebagai isi.
5. Visual check tiap layar lawan referensi (aturan PRD), dua tema.

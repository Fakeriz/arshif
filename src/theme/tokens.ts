/**
 * Arshif design tokens: "Monokrom", palet stone/paper (docs/design.md, revisi 2026-11-20).
 * Kartu kertas di atas kanvas batu, primary terbalik (terang di gelap, gelap di terang),
 * kontrol berbentuk pill. Warna hanya untuk makna (naik/turun/peringatan) dan kategori.
 * Kunci token "glass*" dipertahankan demi kompatibilitas komponen; nilainya kini solid.
 * Semua pasangan teks/latar diverifikasi WCAG AA di __tests__/contrast.test.ts.
 */

export type ColorScheme = 'dark' | 'light';

export type BasePalette = {
  bg: string;
  surface: string;
  surfaceRaised: string;
  surfaceSunken: string;
  /** Track segmented control, latar input di tema gelap (Talmo card-2). */
  surfaceAlt: string;
  /** Isian tipis: badge, switch mati, tombol ikon datar (Talmo card-3). */
  fill: string;
  border: string;
  borderStrong: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  positive: string;
  positiveSoft: string;
  negative: string;
  negativeSoft: string;
  warning: string;
  warningSoft: string;
  info: string;
  infoSoft: string;
  track: string;
  skeleton: string;
  overlay: string;
  /** Kaca: lapisan konten (panel, kartu). */
  glass: string;
  /** Kaca: lapisan mengambang (nav pill, sheet, dialog, toast). Lebih pekat agar tetap di depan. */
  glassStrong: string;
  glassBorder: string;
  /** Pengganti kaca saat blur tidak tersedia / reduced motion / reduce transparency. */
  glassFallback: string;
  glassStrongFallback: string;
};

export type AccentTokens = {
  /** Isi tombol primary, aksi utama, ikon nav aktif berlatar. */
  accent: string;
  /** Teks/ikon di atas `accent`. */
  onAccent: string;
  /** Teks/ikon aksen di atas latar/kaca. */
  accentText: string;
  /** Tinta aksen tipis: chip terpilih, kartu promo. */
  accentSoft: string;
  /** Pusat ambient glow (gradasi radial di atas layar). */
  accentGlow: string;
  focus: string;
};

export type Palette = BasePalette & AccentTokens;

export const palettes: Record<ColorScheme, BasePalette> = {
  dark: {
    bg: '#0D0D0D',
    surface: '#161616',
    surfaceRaised: '#262626',
    surfaceSunken: '#2B2B2B',
    surfaceAlt: '#1C1C1C',
    fill: 'rgba(255, 255, 255, 0.07)',
    border: 'rgba(255, 255, 255, 0.08)',
    borderStrong: 'rgba(255, 255, 255, 0.15)',
    text: '#E0E0E0',
    textSecondary: '#C9C9C9',
    textMuted: '#A4A4A4',
    positive: '#7FC79B',
    positiveSoft: 'rgba(127, 199, 155, 0.13)',
    negative: '#F08A80',
    negativeSoft: 'rgba(240, 138, 128, 0.13)',
    warning: '#E0B05C',
    warningSoft: 'rgba(224, 176, 92, 0.13)',
    info: '#9DB8DE',
    infoSoft: 'rgba(157, 184, 222, 0.13)',
    track: 'rgba(255, 255, 255, 0.10)',
    skeleton: 'rgba(255, 255, 255, 0.06)',
    overlay: 'rgba(0, 0, 0, 0.6)',
    glass: '#161616',
    glassStrong: '#262626',
    glassBorder: 'rgba(255, 255, 255, 0.08)',
    glassFallback: '#161616',
    glassStrongFallback: '#262626',
  },
  light: {
    bg: '#E5E5E2',
    surface: '#F2F2F2',
    surfaceRaised: '#FAFAFA',
    surfaceSunken: '#D8D6D4',
    surfaceAlt: '#EDEDED',
    fill: 'rgba(8, 8, 8, 0.06)',
    border: 'rgba(8, 8, 8, 0.075)',
    borderStrong: 'rgba(8, 8, 8, 0.15)',
    text: '#0A0A0A',
    textSecondary: '#575655',
    textMuted: '#575655',
    positive: '#265C3B',
    positiveSoft: 'rgba(46, 107, 70, 0.12)',
    negative: '#A8322B',
    negativeSoft: 'rgba(168, 50, 43, 0.10)',
    warning: '#7A4E00',
    warningSoft: 'rgba(176, 120, 20, 0.14)',
    info: '#3D5A80',
    infoSoft: 'rgba(61, 90, 128, 0.11)',
    track: 'rgba(8, 8, 8, 0.10)',
    skeleton: 'rgba(8, 8, 8, 0.06)',
    overlay: 'rgba(0, 0, 0, 0.32)',
    glass: '#F2F2F2',
    glassStrong: '#FAFAFA',
    glassBorder: 'rgba(8, 8, 8, 0.075)',
    glassFallback: '#F2F2F2',
    glassStrongFallback: '#FAFAFA',
  },
};

/**
 * Kartu tinta: satu per layar, memegang angka terpenting (titik fokus).
 * Gelap di tema terang; di tema gelap TERBALIK (terang) agar tetap titik paling kontras.
 */
export type InkCardTokens = {
  bg: string;
  text: string;
  textMuted: string;
  positive: string;
  positiveSoft: string;
  negative: string;
  negativeSoft: string;
  track: string;
};

export const inkCard: Record<ColorScheme, InkCardTokens> = {
  light: {
    bg: '#0A0A0A',
    text: '#E0E0E0',
    textMuted: '#A4A4A4',
    positive: '#7FC79B',
    positiveSoft: 'rgba(127, 199, 155, 0.16)',
    negative: '#F08A80',
    negativeSoft: 'rgba(240, 138, 128, 0.16)',
    track: 'rgba(255, 255, 255, 0.12)',
  },
  dark: {
    bg: '#E0E0E0',
    text: '#0A0A0A',
    textMuted: '#575655',
    // Lebih gelap dari palet terang: badge tren di atas tinta soft pada #E0E0E0 butuh 4.5:1.
    positive: '#22573A',
    positiveSoft: 'rgba(46, 107, 70, 0.12)',
    negative: '#8C2621',
    negativeSoft: 'rgba(168, 50, 43, 0.10)',
    track: 'rgba(8, 8, 8, 0.10)',
  },
};


/** Aksen tunggal monokrom: tombol primary = warna tinta, tanpa glow (pilihan warna aksen dihapus 2026-11-20). */
export const accentTokens: Record<ColorScheme, AccentTokens> = {
  dark: { accent: '#E0E0E0', onAccent: '#0A0A0A', accentText: '#E0E0E0', accentSoft: 'rgba(255, 255, 255, 0.08)', accentGlow: 'rgba(0, 0, 0, 0)', focus: '#C9C9C9' },
  light: { accent: '#0A0A0A', onAccent: '#F4F4F4', accentText: '#0A0A0A', accentSoft: 'rgba(8, 8, 8, 0.06)', accentGlow: 'rgba(0, 0, 0, 0)', focus: '#575655' },
};

/** Opasitas tinta aksen di tepi kiri strip akun Home (nama akun + chevron di atasnya). */
export const stripTint: Record<ColorScheme, number> = { dark: 0.14, light: 0.14 };

export function buildPalette(scheme: ColorScheme): Palette {
  return { ...palettes[scheme], ...accentTokens[scheme] };
}

/** Warna kategori: ikon memakai warna penuh, latar lingkaran memakai opacity 15%. */
export const categoryHues: Record<ColorScheme, Record<CategoryHue, string>> = {
  // Monokrom (Talmo): kategori dibedakan ikon + label, bukan warna. Urutan abu berselang terang/gelap
  // agar irisan donut yang bersebelahan tetap terpisah. Semua >= 3:1 di kartu.
  dark: {
    saffron: '#E0E0E0',
    coral: '#8A8A8A',
    rose: '#C9C9C9',
    plum: '#7A7A7A',
    sky: '#B0B0B0',
    teal: '#9A9A9A',
    jade: '#D4D4D4',
    olive: '#808080',
    clay: '#BDBDBD',
    slate: '#A4A4A4',
  },
  light: {
    saffron: '#0A0A0A',
    coral: '#6F6F6F',
    rose: '#242424',
    plum: '#7A7978',
    sky: '#3B3B3B',
    teal: '#646464',
    jade: '#171717',
    olive: '#575655',
    clay: '#4A4A4A',
    slate: '#2E2E2E',
  },
};

export type CategoryHue =
  | 'saffron'
  | 'coral'
  | 'rose'
  | 'plum'
  | 'sky'
  | 'teal'
  | 'jade'
  | 'olive'
  | 'clay'
  | 'slate';

/** Skala radius. Pakai alias semantik di bawah, bukan angka langsung. */
export const radius = {
  xs: 6,
  sm: 8,
  md: 14,
  /** Kartu (pen.dev: 24). */
  lg: 24,
  xl: 28,
  full: 999,
  /** Kartu utama di kanvas (pen.dev: 24). */
  card: 24,
  /** Panel di dalam kartu (ringkasan, baris daftar berlatar, textarea). */
  inset: 14,
  /** Chip, toggle bulat (pill). */
  control: 999,
  /** Tombol: pill di semua ukuran (pen.dev). */
  button: 999,
  /** Chip filter: sama dengan input supaya kontrol isian satu keluarga. */
  chip: 14,
  /** Segmented control: track dan thumb pill (Arshif Motion Kit .am-seg). */
  seg: 999,
  segItem: 999,
  /** Input satu baris dan select (pen.dev: 14, tinggi 42). */
  field: 14,
  /** Badge hitungan & status (Talmo .badge/.stat: pill). */
  badge: 999,
  /** Batang grafik. */
  bar: 6,
  /** Bottom sheet & dialog. */
  sheet: 28,
} as const;

/**
 * Kotak ikon (pen.dev): ukuran container kelipatan 8, ikon = 45% dibulatkan genap, radius = ±30%.
 * Tentukan container-nya, ikon dan radius dibaca dari sini (lingkaran kategori tetap bulat, hanya ikonnya).
 */
export const iconBox = {
  32: { icon: 14, radius: 10 },
  40: { icon: 18, radius: 12 },
  48: { icon: 22, radius: 14 },
  56: { icon: 24, radius: 16 },
} as const;
export type IconBoxSize = keyof typeof iconBox;

export const space = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  x3: 32,
  x4: 40,
  x5: 48,
} as const;

/** Satu keluarga: Plus Jakarta Sans (foundry Jakarta), termasuk angka tabular. */
export const fonts = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
} as const;

export const type = {
  /** Judul halaman besar (Talmo .phead h1, mobile 28px, 600, -0.025em). */
  display: { fontFamily: fonts.semibold, fontSize: 34, lineHeight: 42, letterSpacing: -0.85 },
  h1: { fontFamily: fonts.semibold, fontSize: 28, lineHeight: 35, letterSpacing: -0.7 },
  h2: { fontFamily: fonts.semibold, fontSize: 20, lineHeight: 25, letterSpacing: -0.2 },
  /** Judul kartu (Talmo .chead h3: fs-lg 15, 600). */
  h3: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 19, letterSpacing: -0.08 },
  body: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20 },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 20 },
  /** Teks yang diketik di kolom isian. Minimal 16px: Safari iOS memperbesar halaman bila kolom yang difokus < 16px. */
  input: { fontFamily: fonts.medium, fontSize: 16, lineHeight: 22 },
  /** Subjudul kartu, deskripsi baris, label (Talmo fs-sm 12.5). */
  caption: { fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 17 },
  /** Label kecil (Talmo .eyebrow / fs-2xs 11, 600). Tanpa huruf kapital berjarak. */
  overline: { fontFamily: fonts.semibold, fontSize: 11, lineHeight: 14 },
  amountHero: { fontFamily: fonts.semibold, fontSize: 30, lineHeight: 34, letterSpacing: -0.6 },
  balanceHero: { fontFamily: fonts.semibold, fontSize: 38, lineHeight: 42, letterSpacing: -0.95 },
  amount: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 20 },
  /** Label tombol (Talmo .btn fs-md 13.5, 600). */
  button: { fontFamily: fonts.semibold, fontSize: 13.5, lineHeight: 18 },
} as const;

export type TypeVariant = keyof typeof type;

/** Bahasa gerak: 150–300ms, hanya transform + opacity. */
export const motion = {
  fast: 150,
  base: 220,
  slow: 300,
  pressScale: 0.97,
  spring: { damping: 20, stiffness: 240, mass: 1 },
} as const;

export const layout = {
  hairline: 1,
  /** Tombol selebar teks 42 (sm dan md, target ketuk ≥ 42); tombol lebar penuh 48. */
  buttonHeight: { lg: 48, md: 42, sm: 42 },
  inputHeight: 42,
  /** Segmented control: tinggi item + padding track (Arshif Motion Kit .am-seg). */
  segItemHeight: 40,
  segPad: 4,
  /** Jarak tepi layar dan padding dalam kartu. */
  screenGutter: 16,
  cardPadding: 16,
  insetPadding: 12,
  /** Jarak vertikal antar kartu. */
  cardGap: 12,
  iconStroke: 1.75,
  iconSize: { sm: 16, md: 20, lg: 24 },
  maxContentWidth: 560,
  /** Blur hanya untuk tab bar mengambang; panel/kartu tidak lagi blur. */
  blur: { panel: 0, floating: 50 },
} as const;

/**
 * Ramp abu untuk grafik batang/area: urut dari data terlama → terbaru / terkecil → sorotan.
 * Titik sorotan (bulan berjalan, nilai terpilih) memakai indeks terakhir.
 */
export const chartRamp: Record<ColorScheme, readonly string[]> = {
  dark: ['#3A3A3A', '#525252', '#737373', '#A3A3A3', '#E5E5E5'],
  light: ['#D4D4D4', '#A3A3A3', '#737373', '#404040', '#171717'],
};

/** Area grafik garis: isian di bawah garis dan garisnya. */
export const chartArea: Record<ColorScheme, { fill: string; line: string }> = {
  dark: { fill: 'rgba(255, 255, 255, 0.14)', line: '#A3A3A3' },
  // Terang: #A3A3A3 hanya 2,5:1 di kartu putih; garis data butuh 3:1 (WCAG 1.4.11).
  light: { fill: 'rgba(0, 0, 0, 0.06)', line: '#737373' },
};

/**
 * Elevasi. Gelap: tanpa bayangan, kedalaman dari selisih nada permukaan.
 * Terang: bayangan tipis agar kartu kertas #F2F2F2 terangkat dari kanvas batu #E5E5E2.
 */
export const elevation = {
  dark: {
    card: {},
    primary: {},
    floating: { shadowColor: '#000000', shadowOpacity: 0.5, shadowRadius: 24, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  },
  light: {
    card: { shadowColor: '#080808', shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 1 },
    /** Tombol primary (Talmo .btn--primary: 0 10px 20px -12px). */
    primary: { shadowColor: '#080808', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
    floating: { shadowColor: '#000000', shadowOpacity: 0.12, shadowRadius: 24, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  },
} as const;

/** Opasitas status. */
export const opacity = {
  disabled: 0.4,
  /** Item daftar yang memudar di tepi bawah kartu (fade-out). */
  faded: 0.5,
  pressed: 0.85,
} as const;

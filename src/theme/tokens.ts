/**
 * Arshif design tokens: "Monokrom" (docs/design.md, revisi dari "Kaca & Aksen").
 * Kartu solid di atas kanvas netral, primary terbalik (terang di gelap, gelap di terang),
 * kontrol berbentuk pill. Warna hanya untuk makna (naik/turun/peringatan) dan kategori.
 * Kunci token "glass*" dipertahankan demi kompatibilitas komponen; nilainya kini solid.
 * Semua pasangan teks/latar diverifikasi WCAG AA di __tests__/contrast.test.ts.
 */

export type ColorScheme = 'dark' | 'light';
export type AccentKey = 'netral' | 'merah' | 'kuningan' | 'zamrud' | 'biru' | 'ungu';

export type BasePalette = {
  bg: string;
  surface: string;
  surfaceRaised: string;
  surfaceSunken: string;
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
    bg: '#09090B',
    surface: '#121214',
    surfaceRaised: '#1F1F1F',
    surfaceSunken: '#262626',
    border: 'rgba(255, 255, 255, 0.06)',
    borderStrong: 'rgba(255, 255, 255, 0.12)',
    text: '#FAFAFA',
    textSecondary: '#ABABAB',
    textMuted: '#8F8F8F',
    positive: '#5BD69A',
    positiveSoft: 'rgba(91, 214, 154, 0.12)',
    negative: '#F87171',
    negativeSoft: 'rgba(248, 113, 113, 0.12)',
    warning: '#E5B54A',
    warningSoft: 'rgba(229, 181, 74, 0.12)',
    info: '#8AB4F8',
    infoSoft: 'rgba(138, 180, 248, 0.12)',
    track: 'rgba(255, 255, 255, 0.10)',
    skeleton: 'rgba(255, 255, 255, 0.06)',
    overlay: 'rgba(0, 0, 0, 0.64)',
    glass: '#121214',
    glassStrong: '#1F1F1F',
    glassBorder: 'rgba(255, 255, 255, 0.06)',
    glassFallback: '#121214',
    glassStrongFallback: '#1F1F1F',
  },
  light: {
    bg: '#F3F3F3',
    surface: '#FFFFFF',
    surfaceRaised: '#FFFFFF',
    surfaceSunken: '#F4F4F4',
    border: 'rgba(0, 0, 0, 0.06)',
    borderStrong: 'rgba(0, 0, 0, 0.12)',
    text: '#0A0A0A',
    textSecondary: '#525252',
    textMuted: '#636363',
    positive: '#15803D',
    positiveSoft: 'rgba(21, 128, 61, 0.08)',
    negative: '#B91C1C',
    negativeSoft: 'rgba(185, 28, 28, 0.08)',
    warning: '#8A5A00',
    warningSoft: 'rgba(138, 90, 0, 0.08)',
    info: '#1D4ED8',
    infoSoft: 'rgba(29, 78, 216, 0.08)',
    track: 'rgba(0, 0, 0, 0.08)',
    skeleton: 'rgba(0, 0, 0, 0.06)',
    overlay: 'rgba(0, 0, 0, 0.32)',
    glass: '#FFFFFF',
    glassStrong: '#FFFFFF',
    glassBorder: 'rgba(0, 0, 0, 0.06)',
    glassFallback: '#FFFFFF',
    glassStrongFallback: '#FFFFFF',
  },
};

/** Aksen pilihan pengguna (FR-SET-4). Netral = default (primary terbalik, tanpa glow). */
export const accents: Record<AccentKey, Record<ColorScheme, AccentTokens>> = {
  netral: {
    dark: { accent: '#EDEDED', onAccent: '#0A0A0A', accentText: '#FAFAFA', accentSoft: 'rgba(255, 255, 255, 0.08)', accentGlow: 'rgba(0, 0, 0, 0)', focus: '#D4D4D4' },
    light: { accent: '#0A0A0A', onAccent: '#FFFFFF', accentText: '#0A0A0A', accentSoft: 'rgba(0, 0, 0, 0.05)', accentGlow: 'rgba(0, 0, 0, 0)', focus: '#525252' },
  },
  merah: {
    dark: { accent: '#D42A45', onAccent: '#FFFFFF', accentText: '#FF8595', accentSoft: 'rgba(212, 42, 69, 0.14)', accentGlow: 'rgba(212, 42, 69, 0.30)', focus: '#FF8595' },
    light: { accent: '#C0233C', onAccent: '#FFFFFF', accentText: '#B01F37', accentSoft: 'rgba(192, 35, 60, 0.10)', accentGlow: 'rgba(212, 42, 69, 0.06)', focus: '#B01F37' },
  },
  kuningan: {
    dark: { accent: '#D6B072', onAccent: '#1B1508', accentText: '#E0BE86', accentSoft: 'rgba(214, 176, 114, 0.12)', accentGlow: 'rgba(214, 176, 114, 0.18)', focus: '#E0BE86' },
    light: { accent: '#8A6424', onAccent: '#FFFDF8', accentText: '#7D5A1E', accentSoft: 'rgba(138, 100, 36, 0.12)', accentGlow: 'rgba(214, 176, 114, 0.06)', focus: '#7D5A1E' },
  },
  zamrud: {
    dark: { accent: '#0B7F5E', onAccent: '#FFFFFF', accentText: '#4DD6C1', accentSoft: 'rgba(11, 127, 94, 0.22)', accentGlow: 'rgba(16, 150, 112, 0.24)', focus: '#4DD6C1' },
    light: { accent: '#0B7F5E', onAccent: '#FFFFFF', accentText: '#0A6E52', accentSoft: 'rgba(11, 127, 94, 0.10)', accentGlow: 'rgba(16, 150, 112, 0.06)', focus: '#0A6E52' },
  },
  biru: {
    dark: { accent: '#2F6FE0', onAccent: '#FFFFFF', accentText: '#8AB2F7', accentSoft: 'rgba(47, 111, 224, 0.20)', accentGlow: 'rgba(47, 111, 224, 0.30)', focus: '#8AB2F7' },
    light: { accent: '#2457B8', onAccent: '#FFFFFF', accentText: '#2457B8', accentSoft: 'rgba(36, 87, 184, 0.10)', accentGlow: 'rgba(47, 111, 224, 0.06)', focus: '#2457B8' },
  },
  ungu: {
    dark: { accent: '#7B4FE0', onAccent: '#FFFFFF', accentText: '#B9A0FF', accentSoft: 'rgba(123, 79, 224, 0.20)', accentGlow: 'rgba(123, 79, 224, 0.30)', focus: '#B9A0FF' },
    light: { accent: '#6B3FD1', onAccent: '#FFFFFF', accentText: '#5F36BF', accentSoft: 'rgba(107, 63, 209, 0.10)', accentGlow: 'rgba(123, 79, 224, 0.06)', focus: '#5F36BF' },
  },
};

/** Urutan pilihan aksen. Label: `domain.accent.<key>`. */
export const ACCENT_OPTIONS: { key: AccentKey }[] = [{ key: 'netral' }, { key: 'merah' }, { key: 'kuningan' }, { key: 'zamrud' }, { key: 'biru' }, { key: 'ungu' }];

export const DEFAULT_ACCENT: AccentKey = 'netral';

/**
 * Over budget saat aksen = Merah: rona dibedakan (oranye-vermilion) agar tidak tertukar
 * dengan aksen. Ikon peringatan selalu menyertai over budget (lihat CurrencyText).
 */
export const overBudgetForRedAccent: Record<ColorScheme, { negative: string; negativeSoft: string }> = {
  dark: { negative: '#FF8A4C', negativeSoft: 'rgba(255, 138, 76, 0.14)' },
  light: { negative: '#A8410A', negativeSoft: 'rgba(168, 65, 10, 0.10)' },
};

/** Opasitas tinta aksen di tepi kiri strip akun Home (nama akun + chevron di atasnya). */
export const stripTint: Record<ColorScheme, number> = { dark: 0.14, light: 0.14 };

export function buildPalette(scheme: ColorScheme, accent: AccentKey): Palette {
  const base = palettes[scheme];
  const over = accent === 'merah' ? overBudgetForRedAccent[scheme] : {};
  return { ...base, ...over, ...accents[accent][scheme] };
}

/** Warna kategori: ikon memakai warna penuh, latar lingkaran memakai opacity 15%. */
export const categoryHues: Record<ColorScheme, Record<CategoryHue, string>> = {
  dark: {
    saffron: '#E3B25C',
    coral: '#EE8A72',
    rose: '#E58BA6',
    plum: '#B99AE0',
    sky: '#7FB0E6',
    teal: '#5EC2B7',
    jade: '#6CC690',
    olive: '#B5BE6A',
    clay: '#C99A7A',
    slate: '#A3A9B5',
  },
  light: {
    saffron: '#9A6A10',
    coral: '#B5492F',
    rose: '#B03A62',
    plum: '#6E4BA6',
    sky: '#2C67A8',
    teal: '#167469',
    jade: '#1E7A47',
    olive: '#66701C',
    clay: '#8C5A3A',
    slate: '#525967',
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
  lg: 20,
  xl: 28,
  full: 999,
  /** Kartu utama di kanvas. */
  card: 20,
  /** Panel di dalam kartu (ringkasan, baris daftar berlatar, textarea). */
  inset: 14,
  /** Tombol, input satu baris, select, chip, badge, toggle. */
  control: 999,
  /** Batang grafik. */
  bar: 6,
  /** Bottom sheet & dialog. */
  sheet: 28,
} as const;

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
  display: { fontFamily: fonts.bold, fontSize: 30, lineHeight: 36, letterSpacing: -0.9 },
  h1: { fontFamily: fonts.bold, fontSize: 24, lineHeight: 30, letterSpacing: -0.6 },
  h2: { fontFamily: fonts.semibold, fontSize: 19, lineHeight: 26, letterSpacing: -0.3 },
  /** Judul kartu. */
  h3: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22, letterSpacing: -0.2 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 22 },
  /** Subjudul kartu, deskripsi baris, label sumbu. */
  caption: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  /** Label seksi huruf kapital ("UPCOMING", "RETIREMENT"). Teks ditulis kapital di sumber. */
  overline: { fontFamily: fonts.semibold, fontSize: 11, lineHeight: 14, letterSpacing: 0.8 },
  amountHero: { fontFamily: fonts.bold, fontSize: 32, lineHeight: 38, letterSpacing: -1 },
  balanceHero: { fontFamily: fonts.bold, fontSize: 40, lineHeight: 46, letterSpacing: -1.4 },
  amount: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 22 },
  button: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 18 },
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
  buttonHeight: { lg: 48, md: 40, sm: 32 },
  inputHeight: 44,
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
 * Terang: bayangan sangat tipis agar kartu putih terangkat dari kanvas #F3F3F3.
 */
export const elevation = {
  dark: {
    card: {},
    floating: { shadowColor: '#000000', shadowOpacity: 0.5, shadowRadius: 24, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  },
  light: {
    card: { shadowColor: '#000000', shadowOpacity: 0.04, shadowRadius: 12, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
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

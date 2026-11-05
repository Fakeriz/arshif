/**
 * Arshif design tokens: "Kaca & Aksen" (PRD Bab 11, FR-SET-4).
 * Netral + semantik per tema ada di `palettes`; warna aksen pilihan pengguna ada di `accents`.
 * Semua pasangan teks/latar (termasuk teks di atas kaca + glow) diverifikasi WCAG AA
 * di __tests__/contrast.test.ts.
 */

export type ColorScheme = 'dark' | 'light';
export type AccentKey = 'merah' | 'kuningan' | 'zamrud' | 'biru' | 'ungu';

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
    bg: '#0D0C0A',
    surface: '#171512',
    surfaceRaised: '#211E1A',
    surfaceSunken: '#100F0D',
    border: 'rgba(255, 255, 255, 0.08)',
    borderStrong: 'rgba(255, 255, 255, 0.16)',
    text: '#F4EFE6',
    textSecondary: '#BDB5A8',
    textMuted: '#A59E91',
    positive: '#66D4A6',
    positiveSoft: 'rgba(91, 199, 154, 0.14)',
    negative: '#FF8A7E',
    negativeSoft: 'rgba(240, 116, 104, 0.14)',
    warning: '#E8B43C',
    warningSoft: 'rgba(232, 180, 60, 0.14)',
    info: '#86AEE0',
    infoSoft: 'rgba(134, 174, 224, 0.14)',
    track: 'rgba(255, 255, 255, 0.10)',
    skeleton: 'rgba(255, 255, 255, 0.08)',
    overlay: 'rgba(5, 4, 3, 0.62)',
    glass: 'rgba(255, 255, 255, 0.05)',
    glassStrong: 'rgba(28, 26, 23, 0.72)',
    glassBorder: 'rgba(255, 255, 255, 0.08)',
    glassFallback: 'rgba(30, 28, 25, 0.88)',
    glassStrongFallback: 'rgba(30, 28, 25, 0.96)',
  },
  light: {
    bg: '#F4F1EA',
    surface: '#FFFDF8',
    surfaceRaised: '#FFFFFF',
    surfaceSunken: '#ECE8DF',
    border: 'rgba(26, 23, 18, 0.10)',
    borderStrong: 'rgba(26, 23, 18, 0.20)',
    text: '#1A1712',
    textSecondary: '#554E43',
    textMuted: '#655E52',
    positive: '#17794E',
    positiveSoft: 'rgba(23, 121, 78, 0.10)',
    negative: '#B8352A',
    negativeSoft: 'rgba(184, 53, 42, 0.10)',
    warning: '#8A5A00',
    warningSoft: 'rgba(138, 90, 0, 0.10)',
    info: '#2B63A8',
    infoSoft: 'rgba(43, 99, 168, 0.10)',
    track: 'rgba(26, 23, 18, 0.10)',
    skeleton: 'rgba(26, 23, 18, 0.08)',
    overlay: 'rgba(26, 23, 18, 0.40)',
    glass: 'rgba(255, 255, 255, 0.62)',
    glassStrong: 'rgba(255, 255, 255, 0.80)',
    glassBorder: 'rgba(255, 255, 255, 0.70)',
    glassFallback: 'rgba(255, 253, 248, 0.94)',
    glassStrongFallback: 'rgba(255, 253, 248, 0.98)',
  },
};

/** Aksen pilihan pengguna (FR-SET-4). Merah = default, mengikuti referensi. */
export const accents: Record<AccentKey, Record<ColorScheme, AccentTokens>> = {
  merah: {
    dark: { accent: '#D42A45', onAccent: '#FFFFFF', accentText: '#FF8595', accentSoft: 'rgba(212, 42, 69, 0.14)', accentGlow: 'rgba(212, 42, 69, 0.30)', focus: '#FF8595' },
    light: { accent: '#C0233C', onAccent: '#FFFFFF', accentText: '#B01F37', accentSoft: 'rgba(192, 35, 60, 0.10)', accentGlow: 'rgba(212, 42, 69, 0.12)', focus: '#B01F37' },
  },
  kuningan: {
    dark: { accent: '#D6B072', onAccent: '#1B1508', accentText: '#E0BE86', accentSoft: 'rgba(214, 176, 114, 0.12)', accentGlow: 'rgba(214, 176, 114, 0.18)', focus: '#E0BE86' },
    light: { accent: '#8A6424', onAccent: '#FFFDF8', accentText: '#7D5A1E', accentSoft: 'rgba(138, 100, 36, 0.12)', accentGlow: 'rgba(214, 176, 114, 0.12)', focus: '#7D5A1E' },
  },
  zamrud: {
    dark: { accent: '#0B7F5E', onAccent: '#FFFFFF', accentText: '#4DD6C1', accentSoft: 'rgba(11, 127, 94, 0.22)', accentGlow: 'rgba(16, 150, 112, 0.24)', focus: '#4DD6C1' },
    light: { accent: '#0B7F5E', onAccent: '#FFFFFF', accentText: '#0A6E52', accentSoft: 'rgba(11, 127, 94, 0.10)', accentGlow: 'rgba(16, 150, 112, 0.12)', focus: '#0A6E52' },
  },
  biru: {
    dark: { accent: '#2F6FE0', onAccent: '#FFFFFF', accentText: '#8AB2F7', accentSoft: 'rgba(47, 111, 224, 0.20)', accentGlow: 'rgba(47, 111, 224, 0.30)', focus: '#8AB2F7' },
    light: { accent: '#2457B8', onAccent: '#FFFFFF', accentText: '#2457B8', accentSoft: 'rgba(36, 87, 184, 0.10)', accentGlow: 'rgba(47, 111, 224, 0.12)', focus: '#2457B8' },
  },
  ungu: {
    dark: { accent: '#7B4FE0', onAccent: '#FFFFFF', accentText: '#B9A0FF', accentSoft: 'rgba(123, 79, 224, 0.20)', accentGlow: 'rgba(123, 79, 224, 0.30)', focus: '#B9A0FF' },
    light: { accent: '#6B3FD1', onAccent: '#FFFFFF', accentText: '#5F36BF', accentSoft: 'rgba(107, 63, 209, 0.10)', accentGlow: 'rgba(123, 79, 224, 0.12)', focus: '#5F36BF' },
  },
};

/** Urutan pilihan aksen. Label: `domain.accent.<key>`. */
export const ACCENT_OPTIONS: { key: AccentKey }[] = [{ key: 'merah' }, { key: 'kuningan' }, { key: 'zamrud' }, { key: 'biru' }, { key: 'ungu' }];

export const DEFAULT_ACCENT: AccentKey = 'merah';

/**
 * Over budget saat aksen = Merah: rona dibedakan (oranye-vermilion) agar tidak tertukar
 * dengan aksen. Ikon peringatan selalu menyertai over budget (lihat CurrencyText).
 */
export const overBudgetForRedAccent: Record<ColorScheme, { negative: string; negativeSoft: string }> = {
  dark: { negative: '#FF8A4C', negativeSoft: 'rgba(255, 138, 76, 0.14)' },
  light: { negative: '#A8410A', negativeSoft: 'rgba(168, 65, 10, 0.10)' },
};

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

/** PRD Bab 11: card 16, button/input 12, chip/badge full, sheet 24. */
export const radius = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
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
  display: { fontFamily: fonts.extrabold, fontSize: 32, lineHeight: 38, letterSpacing: -0.8 },
  h1: { fontFamily: fonts.bold, fontSize: 28, lineHeight: 34, letterSpacing: -0.6 },
  h2: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 28, letterSpacing: -0.3 },
  h3: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 24, letterSpacing: -0.1 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 22 },
  caption: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18 },
  overline: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 16, letterSpacing: 0.2 },
  amountHero: { fontFamily: fonts.bold, fontSize: 36, lineHeight: 44, letterSpacing: -1 },
  balanceHero: { fontFamily: fonts.bold, fontSize: 44, lineHeight: 52, letterSpacing: -1.4 },
  amount: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 24 },
  button: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 20 },
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
  buttonHeight: { lg: 52, md: 44, sm: 36 },
  inputHeight: 52,
  iconStroke: 1.75,
  iconSize: { sm: 16, md: 20, lg: 24 },
  maxContentWidth: 560,
  /** Intensitas blur kaca (expo-blur 1–100). */
  blur: { panel: 40, floating: 60 },
} as const;

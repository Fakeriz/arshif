/**
 * Arshif design tokens — identitas "Tinta & Kuningan" (ink & brass).
 * Satu skala radius, satu skala spacing, satu bahasa gerak.
 * Semua pasangan teks/latar diverifikasi WCAG AA di __tests__/contrast.test.ts.
 */

export type ColorScheme = 'dark' | 'light';

export type Palette = {
  bg: string;
  surface: string;
  surfaceRaised: string;
  surfaceSunken: string;
  border: string;
  borderStrong: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  onAccent: string;
  accentText: string;
  accentSoft: string;
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
  focus: string;
};

export const palettes: Record<ColorScheme, Palette> = {
  dark: {
    bg: '#0D0C0A',
    surface: '#171512',
    surfaceRaised: '#211E1A',
    surfaceSunken: '#100F0D',
    border: 'rgba(240, 228, 206, 0.09)',
    borderStrong: 'rgba(240, 228, 206, 0.18)',
    text: '#F4EFE6',
    textSecondary: '#B5AD9F',
    textMuted: '#8F887B',
    accent: '#D6B072',
    onAccent: '#1B1508',
    accentText: '#E0BE86',
    accentSoft: 'rgba(214, 176, 114, 0.14)',
    positive: '#5BC79A',
    positiveSoft: 'rgba(91, 199, 154, 0.14)',
    negative: '#F07468',
    negativeSoft: 'rgba(240, 116, 104, 0.14)',
    warning: '#F09A45',
    warningSoft: 'rgba(240, 154, 69, 0.14)',
    info: '#86AEE0',
    infoSoft: 'rgba(134, 174, 224, 0.14)',
    track: '#2A2621',
    skeleton: '#24211C',
    overlay: 'rgba(5, 4, 3, 0.66)',
    focus: '#E0BE86',
  },
  light: {
    bg: '#F4F1EA',
    surface: '#FFFDF8',
    surfaceRaised: '#FFFFFF',
    surfaceSunken: '#ECE8DF',
    border: 'rgba(36, 28, 16, 0.10)',
    borderStrong: 'rgba(36, 28, 16, 0.20)',
    text: '#1A1712',
    textSecondary: '#554E43',
    textMuted: '#6B6458',
    accent: '#8A6424',
    onAccent: '#FFFDF8',
    accentText: '#7D5A1E',
    accentSoft: 'rgba(138, 100, 36, 0.12)',
    positive: '#17794E',
    positiveSoft: 'rgba(23, 121, 78, 0.10)',
    negative: '#B8352A',
    negativeSoft: 'rgba(184, 53, 42, 0.10)',
    warning: '#A6560C',
    warningSoft: 'rgba(166, 86, 12, 0.10)',
    info: '#2B63A8',
    infoSoft: 'rgba(43, 99, 168, 0.10)',
    track: '#E4DFD4',
    skeleton: '#E7E2D8',
    overlay: 'rgba(26, 23, 18, 0.45)',
    focus: '#7D5A1E',
  },
};

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

export const radius = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
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

export const fonts = {
  display: 'Fraunces_600SemiBold',
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
} as const;

export const type = {
  display: { fontFamily: fonts.display, fontSize: 34, lineHeight: 40, letterSpacing: -0.6 },
  h1: { fontFamily: fonts.display, fontSize: 28, lineHeight: 34, letterSpacing: -0.4 },
  h2: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 28, letterSpacing: -0.3 },
  h3: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 24, letterSpacing: -0.1 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 22 },
  caption: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18 },
  overline: { fontFamily: fonts.semibold, fontSize: 11, lineHeight: 14, letterSpacing: 0.8 },
  amountHero: { fontFamily: fonts.bold, fontSize: 36, lineHeight: 44, letterSpacing: -0.8 },
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
} as const;

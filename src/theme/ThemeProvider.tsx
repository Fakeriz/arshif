import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Platform, useColorScheme, View, type StyleProp, type ViewStyle } from 'react-native';

import {
  buildPalette,
  categoryHues,
  inkCard,
  type CategoryHue,
  type ColorScheme,
  type Palette,
} from './tokens';

export type ThemeMode = 'system' | 'dark' | 'light';

type ThemeValue = {
  mode: ThemeMode;
  scheme: ColorScheme;
  colors: Palette;
  hues: Record<CategoryHue, string>;
  setMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeValue | null>(null);

/**
 * Tema terakhir disimpan di perangkat: layar muat (sebelum profil dari server tiba) langsung memakai tema
 * pilihan pengguna, bukan tema sistem (dulu pengguna tema Terang melihat layar muat hitam).
 */
const MODE_KEY = 'arshif.themeMode';
const isMode = (v: unknown): v is ThemeMode => v === 'system' || v === 'dark' || v === 'light';

/** Web: AsyncStorage = localStorage, bisa dibaca sinkron sebelum render pertama (tanpa kedipan). */
function storedModeSync(): ThemeMode | null {
  if (Platform.OS !== 'web') return null;
  try {
    const v = globalThis.localStorage?.getItem(MODE_KEY);
    return isMode(v) ? v : null;
  } catch {
    return null;
  }
}

type ThemeProviderProps = {
  children: ReactNode;
  initialMode?: ThemeMode;
};

export function ThemeProvider({
  children,
  initialMode = 'system',
}: ThemeProviderProps) {
  const system = useColorScheme();
  const [mode, setMode] = useState<ThemeMode>(() => storedModeSync() ?? initialMode);
  const touched = useRef(false);

  // Native: baca tema tersimpan sekali, kecuali tema sudah diubah (profil server menang).
  useEffect(() => {
    if (Platform.OS === 'web') return;
    AsyncStorage.getItem(MODE_KEY)
      .then((v) => {
        if (!touched.current && isMode(v)) setMode(v);
      })
      .catch(() => undefined);
  }, []);

  const changeMode = useMemo(
    () => (next: ThemeMode) => {
      touched.current = true;
      setMode(next);
      AsyncStorage.setItem(MODE_KEY, next).catch(() => undefined);
    },
    [],
  );
  const scheme: ColorScheme = mode === 'system' ? (system === 'light' ? 'light' : 'dark') : mode;

  const value = useMemo<ThemeValue>(
    () => ({
      mode,
      scheme,
      colors: buildPalette(scheme),
      hues: categoryHues[scheme],
      setMode: changeMode,
    }),
    [mode, scheme, changeMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme harus dipakai di dalam <ThemeProvider>');
  return ctx;
}

/**
 * Kartu tinta (docs/design.md 2.4): satu per layar untuk angka terpenting.
 * Komponen di dalamnya membaca warna teks, naik/turun, dan track dari `inkCard`,
 * jadi AppText/BalanceText/TrendBadge tidak perlu tahu mereka ada di kartu tinta.
 */
export function InkCard({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  const ink = inkCard[theme.scheme];
  const value = useMemo<ThemeValue>(
    () => ({
      ...theme,
      colors: {
        ...theme.colors,
        text: ink.text,
        textSecondary: ink.textMuted,
        textMuted: ink.textMuted,
        accentText: ink.text,
        positive: ink.positive,
        positiveSoft: ink.positiveSoft,
        negative: ink.negative,
        negativeSoft: ink.negativeSoft,
        track: ink.track,
        focus: ink.text,
      },
    }),
    [theme, ink],
  );
  return (
    <ThemeContext.Provider value={value}>
      <View style={[{ backgroundColor: ink.bg }, style]}>{children}</View>
    </ThemeContext.Provider>
  );
}

/**
 * Dasar tinta Beranda (di bawah lembar kertas): isinya selalu memakai palet gelap, di tema apa pun,
 * jadi kartu akun dan daftar transaksi otomatis terbaca di atas tinta tanpa tahu mereka ada di sana.
 */
export function InkScope({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  const value = useMemo<ThemeValue>(() => ({ ...theme, scheme: 'dark', colors: buildPalette('dark'), hues: categoryHues.dark }), [theme]);
  return (
    <ThemeContext.Provider value={value}>
      <View style={[{ backgroundColor: INK_BASE[theme.scheme] }, style]}>{children}</View>
    </ThemeContext.Provider>
  );
}

/** Warna dasar tinta: hitam kartu tinta di tema terang; di tema gelap sedikit lebih gelap dari latar agar lembar tetap terpisah. */
export const INK_BASE: Record<ColorScheme, string> = { light: '#0A0A0A', dark: '#050505' };

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme, View, type StyleProp, type ViewStyle } from 'react-native';

import {
  buildPalette,
  categoryHues,
  DEFAULT_ACCENT,
  inkCard,
  type AccentKey,
  type CategoryHue,
  type ColorScheme,
  type Palette,
} from './tokens';

export type ThemeMode = 'system' | 'dark' | 'light';

type ThemeValue = {
  mode: ThemeMode;
  scheme: ColorScheme;
  accent: AccentKey;
  colors: Palette;
  hues: Record<CategoryHue, string>;
  setMode: (mode: ThemeMode) => void;
  setAccent: (accent: AccentKey) => void;
};

const ThemeContext = createContext<ThemeValue | null>(null);

type ThemeProviderProps = {
  children: ReactNode;
  initialMode?: ThemeMode;
  /** Aksen tersimpan milik pengguna (FR-SET-4). Fase 2: dibaca dari profil Supabase. */
  initialAccent?: AccentKey;
  /** Dipanggil saat pengguna mengganti aksen, untuk disimpan per pengguna. */
  onAccentChange?: (accent: AccentKey) => void;
};

export function ThemeProvider({
  children,
  initialMode = 'system',
  initialAccent = DEFAULT_ACCENT,
  onAccentChange,
}: ThemeProviderProps) {
  const system = useColorScheme();
  const [mode, setMode] = useState<ThemeMode>(initialMode);
  const [accent, setAccentState] = useState<AccentKey>(initialAccent);
  const scheme: ColorScheme = mode === 'system' ? (system === 'light' ? 'light' : 'dark') : mode;

  const value = useMemo<ThemeValue>(
    () => ({
      mode,
      scheme,
      accent,
      colors: buildPalette(scheme, accent),
      hues: categoryHues[scheme],
      setMode,
      setAccent: (next) => {
        setAccentState(next);
        onAccentChange?.(next);
      },
    }),
    [mode, scheme, accent, onAccentChange],
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

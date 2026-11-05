import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import {
  buildPalette,
  categoryHues,
  DEFAULT_ACCENT,
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

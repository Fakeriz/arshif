import type { ReactNode } from 'react';

import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';
import { DEFAULT_ACCENT } from '@/theme/tokens';

/**
 * Layar masuk selalu memakai aksen bawaan (primary terbalik). Aksen pilihan milik akun, jadi setelah
 * keluar aksen pengguna sebelumnya tidak ikut tampil di sini. Mode tema tetap mengikuti perangkat.
 */
export function AuthTheme({ children }: { children: ReactNode }) {
  const { mode } = useTheme();
  return (
    <ThemeProvider initialMode={mode} initialAccent={DEFAULT_ACCENT}>
      {children}
    </ThemeProvider>
  );
}

import type { ReactNode } from 'react';

import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';

/** Untuk layar yang memang selalu gelap (kamera). Aksen pilihan pengguna tetap dipakai. */
export function ForceDark({ children }: { children: ReactNode }) {
  const { accent } = useTheme();
  return (
    <ThemeProvider initialMode="dark" initialAccent={accent}>
      {children}
    </ThemeProvider>
  );
}

import type { ReactNode } from 'react';

import { ThemeProvider } from '@/theme/ThemeProvider';

/** Untuk layar yang memang selalu gelap (kamera). */
export function ForceDark({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider initialMode="dark">
      {children}
    </ThemeProvider>
  );
}

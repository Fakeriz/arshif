import type { ReactNode } from 'react';

import { SchemeScope } from '@/theme/ThemeProvider';

/** Untuk layar yang memang selalu gelap (kamera). */
export function ForceDark({ children }: { children: ReactNode }) {
  return <SchemeScope scheme="dark">{children}</SchemeScope>;
}

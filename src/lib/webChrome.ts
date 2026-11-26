import { Platform } from 'react-native';

import type { ColorScheme } from '@/theme/tokens';

function inferScheme(color: string): ColorScheme {
  const m = /^#([0-9a-f]{6})$/i.exec(color.trim());
  if (!m) return 'dark';
  const n = parseInt(m[1], 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum >= 0.5 ? 'light' : 'dark';
}

function upsertMeta(name: string, content: string): void {
  let meta = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = name;
    document.head.appendChild(meta);
  }
  meta.content = content;
}

/**
 * Web (Safari / web app iOS): area status bar di luar halaman diwarnai iOS dari latar body dan meta theme-color,
 * dan color-scheme browser disinkronkan agar scrollbar/form/overscroll sesuai tema aktif.
 */
export function setWebChrome(color: string, scheme?: ColorScheme): void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  const resolved = scheme ?? inferScheme(color);
  document.documentElement.style.colorScheme = resolved;
  document.documentElement.style.backgroundColor = color;
  document.body.style.backgroundColor = color;
  upsertMeta('theme-color', color);
  upsertMeta('color-scheme', resolved);
}

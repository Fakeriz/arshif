import { Platform } from 'react-native';

/**
 * Web (Safari / web app iOS): area status bar di luar halaman diwarnai iOS dari latar body dan meta theme-color,
 * dan warna teks jam menyesuaikan kontrasnya. Disamakan dengan warna puncak layar supaya tidak ada pita berbeda warna.
 */
export function setWebChrome(color: string): void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  document.body.style.backgroundColor = color;
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.appendChild(meta);
  }
  meta.content = color;
}

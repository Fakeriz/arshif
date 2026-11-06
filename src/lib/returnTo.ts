import { Platform } from 'react-native';

/**
 * Tujuan setelah login di web (mis. /admin dibuka sebelum masuk). Disimpan di sessionStorage supaya
 * bertahan selama alur OTP; dibaca gerbang rute, dihapus oleh layar tujuan setelah sampai.
 */
const KEY = 'arshif.returnTo';
const ALLOWED = ['/admin'] as const;
type ReturnTo = (typeof ALLOWED)[number];

function storage(): Storage | null {
  if (Platform.OS !== 'web') return null;
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
}

export function setReturnTo(path: ReturnTo): void {
  try {
    storage()?.setItem(KEY, path);
  } catch {
    // Penyimpanan diblokir: setelah login pengguna mendarat di Home, bukan error.
  }
}

export function readReturnTo(): ReturnTo | null {
  try {
    const v = storage()?.getItem(KEY);
    return (ALLOWED as readonly string[]).includes(v ?? '') ? (v as ReturnTo) : null;
  } catch {
    return null;
  }
}

export function clearReturnTo(): void {
  try {
    storage()?.removeItem(KEY);
  } catch {
    // abaikan
  }
}

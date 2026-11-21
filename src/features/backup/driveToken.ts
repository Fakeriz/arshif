import { Platform } from 'react-native';

/**
 * Token Google Drive di web: login kembali ke halaman ini dengan #access_token di URL (OAuth implicit, tanpa popup).
 * Ditangkap SEKALI saat aplikasi dimuat (sebelum router berpindah) lalu dihapus dari URL dan disimpan di sessionStorage
 * sampai kedaluwarsa, supaya status "terhubung" bertahan walau halaman dimuat ulang.
 */
export type DriveToken = { token: string; exp: number };

export const DRIVE_REDIRECT_PATH = '/pengaturan/cadangan';
export const DRIVE_STATE_KEY = 'arshif.drive.state';
const TOKEN_KEY = 'arshif.drive.token';

export function loadWebToken(): DriveToken | null {
  try {
    const t = JSON.parse(sessionStorage.getItem(TOKEN_KEY) ?? 'null') as DriveToken | null;
    return t && typeof t.token === 'string' && t.exp > Date.now() ? t : null;
  } catch {
    return null;
  }
}

export function saveWebToken(t: DriveToken | null): void {
  try {
    if (t) sessionStorage.setItem(TOKEN_KEY, JSON.stringify(t));
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* sessionStorage diblokir: token hanya hidup di memori halaman ini */
  }
}

/** Dipanggil sekali dari _layout. State harus sama dengan yang dibuat saat connect (cegah token titipan pihak lain). */
export function captureDriveRedirect(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.location.hash.includes('access_token=')) return;
  const p = new URLSearchParams(window.location.hash.slice(1));
  const token = p.get('access_token');
  const state = p.get('state');
  let expected: string | null = null;
  try {
    expected = sessionStorage.getItem(DRIVE_STATE_KEY);
    sessionStorage.removeItem(DRIVE_STATE_KEY);
  } catch {
    /* lewati */
  }
  if (token && state && state === expected) saveWebToken({ token, exp: Date.now() + Number(p.get('expires_in') ?? 3600) * 1000 });
  // Token jangan tertinggal di URL (riwayat browser, tangkapan layar).
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
}

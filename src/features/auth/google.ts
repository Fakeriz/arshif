import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

/**
 * Masuk dengan Google lewat Supabase OAuth (FR-AUTH-1). Alur implicit: token kembali di #fragment URL.
 * Native: sesi browser sistem (openAuthSessionAsync) kembali ke arshif://masuk.
 * Web: halaman berpindah ke Google lalu kembali ke origin; token ditangkap `captureAuthRedirect` saat aplikasi dimuat.
 * Butuh provider Google aktif di Supabase + URL kembali (arshif://masuk dan origin web) di Redirect URLs.
 */
export type GoogleResult = 'ok' | 'redirect' | 'cancel' | 'error';

const PENDING_KEY = 'arshif.auth.google';

/** Pengurai fragment kecil: URLSearchParams di React Native tidak selalu lengkap. */
export function parseFragment(url: string): Record<string, string> {
  const hash = url.includes('#') ? url.slice(url.indexOf('#') + 1) : '';
  const out: Record<string, string> = {};
  for (const part of hash.split('&')) {
    const i = part.indexOf('=');
    if (i > 0) out[decodeURIComponent(part.slice(0, i))] = decodeURIComponent(part.slice(i + 1).replace(/\+/g, ' '));
  }
  return out;
}

async function sessionFrom(params: Record<string, string>): Promise<boolean> {
  const { access_token, refresh_token } = params;
  if (!access_token || !refresh_token) return false;
  const { error } = await supabase.auth.setSession({ access_token, refresh_token });
  return !error;
}

export async function signInWithGoogle(): Promise<GoogleResult> {
  if (Platform.OS === 'web') {
    try {
      sessionStorage.setItem(PENDING_KEY, '1');
    } catch {
      /* sessionStorage diblokir: token kembali tetap ditolak (lebih aman daripada diterima) */
    }
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
    return error ? 'error' : 'redirect';
  }
  const redirectTo = Linking.createURL('masuk');
  const { data, error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo, skipBrowserRedirect: true } });
  if (error || !data.url) return 'error';
  const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (res.type !== 'success') return 'cancel';
  return (await sessionFrom(parseFragment(res.url))) ? 'ok' : 'error';
}

/**
 * Web, dipanggil sekali dari _layout SEBELUM captureDriveRedirect (keduanya membaca #access_token).
 * Token Supabase dikenali dari refresh_token (token Drive tidak punya) dan hanya diterima bila login Google
 * dimulai dari tab ini, supaya tautan berisi sesi orang lain tidak bisa memasukkan pengguna ke akun itu.
 */
export function captureAuthRedirect(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  const hash = window.location.hash;
  if (!hash.includes('refresh_token=') && !hash.includes('error_description=')) return;
  let pending = false;
  try {
    pending = sessionStorage.getItem(PENDING_KEY) === '1';
    sessionStorage.removeItem(PENDING_KEY);
  } catch {
    /* lewati */
  }
  const params = parseFragment(hash);
  // Token jangan tertinggal di URL (riwayat browser, tangkapan layar).
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
  if (pending) void sessionFrom(params);
}

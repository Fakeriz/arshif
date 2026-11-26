import { getRandomBytes } from 'expo-crypto';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

/**
 * Masuk dengan Google lewat Supabase OAuth (FR-AUTH-1): alur PKCE (?code=) dengan fallback fragment.
 * Native: sesi browser sistem (openAuthSessionAsync) kembali ke arshif://masuk.
 * Web: halaman berpindah ke Google lalu kembali ke origin; token/kode ditangkap `captureAuthRedirect` saat aplikasi dimuat.
 * Butuh provider Google aktif di Supabase + URL kembali (arshif://masuk dan origin web) di Redirect URLs.
 */
export type GoogleResult = 'ok' | 'redirect' | 'cancel' | 'error';

const PENDING_KEY = 'arshif.auth.google';

function randomNonce(): string {
  return Array.from(getRandomBytes(16), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Pengurai fragment kecil: URLSearchParams di React Native tidak selalu lengkap. */
export function parseFragment(url: string): Record<string, string> {
  const hash = url.includes('#') ? url.slice(url.indexOf('#') + 1) : '';
  const out: Record<string, string> = {};
  for (const part of hash.split('&')) {
    const i = part.indexOf('=');
    if (i > 0) {
      try {
        out[decodeURIComponent(part.slice(0, i))] = decodeURIComponent(part.slice(i + 1));
      } catch {
        /* abaikan bagian fragment yang rusak */
      }
    }
  }
  return out;
}

function queryParam(url: string, key: string): string | null {
  try {
    return new URL(url).searchParams.get(key);
  } catch {
    return null;
  }
}

async function sessionFrom(url: string): Promise<boolean> {
  const code = queryParam(url, 'code');
  if (code && typeof supabase.auth.exchangeCodeForSession === 'function') {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    return !error;
  }
  const params = parseFragment(url);
  const { access_token, refresh_token } = params;
  if (!access_token || !refresh_token) return false;
  const { error } = await supabase.auth.setSession({ access_token, refresh_token });
  return !error;
}

export async function signInWithGoogle(): Promise<GoogleResult> {
  if (Platform.OS === 'web') {
    try {
      sessionStorage.setItem(PENDING_KEY, randomNonce());
    } catch {
      /* sessionStorage diblokir: token kembali tetap ditolak (lebih aman daripada diterima) */
    }
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
    if (error) {
      try {
        sessionStorage.removeItem(PENDING_KEY);
      } catch {
        /* lewati */
      }
      return 'error';
    }
    return 'redirect';
  }
  const redirectTo = Linking.createURL('masuk');
  const { data, error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo, skipBrowserRedirect: true } });
  if (error || !data.url) return 'error';
  const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (res.type !== 'success') return 'cancel';
  return (await sessionFrom(res.url)) ? 'ok' : 'error';
}

/**
 * Web, dipanggil sekali dari _layout SEBELUM captureDriveRedirect (keduanya membaca #access_token / ?code=).
 * Hanya diterima bila login Google dimulai dari tab ini, supaya tautan asing tidak bisa menukar atau menyisipkan sesi.
 */
export function captureAuthRedirect(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  const { search, hash, pathname } = window.location;
  const hasCode = search.includes('code=') || search.includes('error_description=');
  const hasToken = hash.includes('refresh_token=') || hash.includes('error_description=');
  if (!hasCode && !hasToken) return;
  let pending = false;
  try {
    pending = !!sessionStorage.getItem(PENDING_KEY);
    sessionStorage.removeItem(PENDING_KEY);
  } catch {
    /* lewati */
  }
  const fullUrl = window.location.href;
  const cleanedSearch = (() => {
    if (!hasCode) return search;
    const sp = new URLSearchParams(search);
    sp.delete('code');
    sp.delete('state');
    sp.delete('error');
    sp.delete('error_description');
    const s = sp.toString();
    return s ? `?${s}` : '';
  })();
  // Kode/token jangan tertinggal di URL (riwayat browser, tangkapan layar).
  window.history.replaceState(null, '', `${pathname}${cleanedSearch}`);
  if (pending) void sessionFrom(fullUrl);
}

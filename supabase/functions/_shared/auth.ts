import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { adminKey, SUPABASE_URL } from './env.ts';
import { HttpError } from './http.ts';

let admin: SupabaseClient | null = null;

/** Klien admin (melewati RLS). Hanya di server; setiap query wajib dibatasi ke user_id pemanggil. */
export function adminClient(): SupabaseClient {
  admin ??= createClient(SUPABASE_URL(), adminKey(), { auth: { persistSession: false, autoRefreshToken: false } });
  return admin;
}

/**
 * Verifikasi token pengguna di kode (verify_jwt platform dimatikan karena kunci format baru).
 * getUser memeriksa token ke Auth server, jadi token palsu/kedaluwarsa ditolak.
 */
export async function requireUser(req: Request): Promise<{ id: string }> {
  const header = req.headers.get('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) throw new HttpError('unauthorized', 401);
  const { data, error } = await adminClient().auth.getUser(token);
  if (error || !data.user) throw new HttpError('unauthorized', 401);
  return { id: data.user.id };
}

/** Path storage harus berada di folder milik pengguna. */
export function assertOwnPath(path: string, userId: string): void {
  if (path.split('/')[0] !== userId) throw new HttpError('unauthorized', 403, { message: 'path_not_owned' });
}

/** Ubah bytes ke base64 tanpa melebihi batas argumen fungsi untuk berkas besar. */
export function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(binary);
}

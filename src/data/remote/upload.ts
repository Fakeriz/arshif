import { File } from 'expo-file-system';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';
import { newId } from '@/lib/uuid';

export { toBase64 } from '@/lib/base64';

/** Isi berkas lokal (file:// di native, blob:/data: di web) sebagai ArrayBuffer. */
export async function readBytes(uri: string): Promise<ArrayBuffer> {
  if (Platform.OS === 'web') return (await fetch(uri)).arrayBuffer();
  return new File(uri).arrayBuffer();
}

export class UploadError extends Error {
  constructor(readonly code: 'too_large' | 'network') {
    super(code);
  }
}

/**
 * Unggah ke bucket privat di folder milik pengguna: "<user_id>/<uuid>.<ext>" (policy storage menolak folder lain).
 * Mengembalikan path untuk dikirim ke Edge Function.
 */
export async function uploadPrivate(opts: { bucket: 'receipts' | 'statements'; userId: string; uri: string; ext: string; contentType: string; maxBytes: number }): Promise<string> {
  const bytes = await readBytes(opts.uri);
  if (bytes.byteLength > opts.maxBytes) throw new UploadError('too_large');
  const path = `${opts.userId}/${newId()}.${opts.ext}`;
  const { error } = await supabase.storage.from(opts.bucket).upload(path, bytes, { contentType: opts.contentType, upsert: false });
  if (error) throw new UploadError('network');
  return path;
}

/** Hapus berkas yang sudah diunggah tapi tidak dipakai (scan gagal / review dibatalkan). Gagal = diabaikan. */
export async function discardPrivate(bucket: 'receipts' | 'statements', path: string): Promise<void> {
  await supabase.storage.from(bucket).remove([path]).catch(() => undefined);
}

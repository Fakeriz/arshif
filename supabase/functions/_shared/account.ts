import type { SupabaseClient } from '@supabase/supabase-js';

import { revokeGrants } from './entitlement.ts';
import { HttpError } from './http.ts';
import { logEvent } from './logger.ts';

type StorageItem = { id?: string | null; name: string };

async function removeFolder(db: SupabaseClient, bucket: string, prefix: string, depth = 0): Promise<{ removed: number; incomplete: boolean }> {
  let removed = 0;
  let incomplete = false;
  if (depth > 8) return { removed, incomplete: true };
  // Hapus per halaman sampai folder kosong (maks 100 halaman * 1000 item per direktori).
  let guard = 0;
  for (; guard < 100; guard++) {
    const { data, error } = await db.storage.from(bucket).list(prefix, { limit: 1000 });
    if (error) throw new Error(`storage_list_${bucket}`);
    if (!data || data.length === 0) break;
    const files: string[] = [];
    for (const item of data as StorageItem[]) {
      const childPath = `${prefix}/${item.name}`;
      // Di Supabase Storage, folder virtual memiliki id === null (bukan undefined seperti di mock test).
      if (item.id === null) {
        const sub = await removeFolder(db, bucket, childPath, depth + 1);
        removed += sub.removed;
        if (sub.incomplete) incomplete = true;
      } else {
        files.push(childPath);
      }
    }
    if (files.length === 0) break;
    const { error: rmError } = await db.storage.from(bucket).remove(files);
    if (rmError) throw new Error(`storage_remove_${bucket}`);
    removed += files.length;
  }
  if (guard >= 100) incomplete = true;
  return { removed, incomplete };
}

/**
 * Hapus akun: pengguna Auth DULU (tabel ikut terhapus lewat cascade; pesanan disimpan tanpa pemilik), baru berkas.
 * Urutan sebaliknya membuat akun yang gagal dihapus kehilangan semua foto struknya.
 * Berkas atau grant yang gagal dibersihkan setelah akun hilang dilaporkan (`filesPending`), bukan error: akun sudah terhapus.
 */
export async function deleteAccount(db: SupabaseClient, userId: string): Promise<{ deleted: true; files: number; filesPending?: boolean }> {
  const { error } = await db.auth.admin.deleteUser(userId);
  if (error) throw new HttpError('server', 500);

  let files = 0;
  let filesPending = false;
  try {
    await revokeGrants(userId);
  } catch (e) {
    logEvent('error', 'delete_account_revoke_grants', { userId, error: e instanceof Error ? e.message : String(e) });
    filesPending = true;
  }

  for (const bucket of ['receipts', 'statements', 'avatars']) {
    try {
      const res = await removeFolder(db, bucket, userId);
      files += res.removed;
      if (res.incomplete) filesPending = true;
    } catch (e) {
      // Lanjutkan bucket berikutnya agar kegagalan satu bucket tidak menghentikan pembersihan lainnya.
      logEvent('error', 'delete_account_files_pending', { bucket, userId, error: e instanceof Error ? e.message : String(e) });
      filesPending = true;
    }
  }
  return filesPending ? { deleted: true, files, filesPending: true } : { deleted: true, files };
}

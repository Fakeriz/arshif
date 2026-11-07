import type { SupabaseClient } from '@supabase/supabase-js';

import { HttpError } from './http.ts';

async function removeFolder(db: SupabaseClient, bucket: string, userId: string): Promise<number> {
  let removed = 0;
  // Hapus per halaman sampai folder kosong.
  for (let guard = 0; guard < 100; guard++) {
    const { data, error } = await db.storage.from(bucket).list(userId, { limit: 1000 });
    if (error) throw new Error(`storage_list_${bucket}`);
    if (!data || data.length === 0) break;
    const paths = data.map((f: { name: string }) => `${userId}/${f.name}`);
    const { error: rmError } = await db.storage.from(bucket).remove(paths);
    if (rmError) throw new Error(`storage_remove_${bucket}`);
    removed += paths.length;
  }
  return removed;
}

/**
 * Hapus akun: pengguna Auth DULU (tabel ikut terhapus lewat cascade; pesanan disimpan tanpa pemilik), baru berkas.
 * Urutan sebaliknya membuat akun yang gagal dihapus kehilangan semua foto struknya.
 * Berkas yang gagal dihapus setelah akun hilang dilaporkan (`filesPending`), bukan error: akun sudah terhapus.
 */
export async function deleteAccount(db: SupabaseClient, userId: string): Promise<{ deleted: true; files: number; filesPending?: boolean }> {
  const { error } = await db.auth.admin.deleteUser(userId);
  if (error) throw new HttpError('server', 500);
  let files = 0;
  try {
    for (const bucket of ['receipts', 'statements']) files += await removeFolder(db, bucket, userId);
  } catch (e) {
    // Folder per pengguna (<uid>/...): sisa berkas tetap bisa dibersihkan admin berdasarkan ID ini.
    console.error('delete_account_files_pending', userId, e instanceof Error ? e.message : String(e));
    return { deleted: true, files, filesPending: true };
  }
  return { deleted: true, files };
}

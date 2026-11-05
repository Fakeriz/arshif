/**
 * Hapus akun (FR-SET-3; GDPR, UU PDP, PDPA, KVKK): hapus berkas storage pengguna, lalu pengguna Auth.
 * Semua tabel ikut terhapus lewat ON DELETE CASCADE (diuji di scripts/db-test.mjs).
 */
import { adminClient, requireUser } from '../_shared/auth.ts';
import { DeleteAccountRequest } from '../_shared/contracts.ts';
import { HttpError, json, readJson, serve } from '../_shared/http.ts';

async function removeFolder(bucket: string, userId: string): Promise<number> {
  const db = adminClient();
  let removed = 0;
  // Hapus per halaman sampai folder kosong.
  for (let guard = 0; guard < 100; guard++) {
    const { data, error } = await db.storage.from(bucket).list(userId, { limit: 1000 });
    if (error) throw new HttpError('server', 500);
    if (!data || data.length === 0) break;
    const paths = data.map((f: { name: string }) => `${userId}/${f.name}`);
    const { error: rmError } = await db.storage.from(bucket).remove(paths);
    if (rmError) throw new HttpError('server', 500);
    removed += paths.length;
  }
  return removed;
}

serve(async (req) => {
  const user = await requireUser(req);
  if (!DeleteAccountRequest.safeParse(await readJson(req)).success) throw new HttpError('bad_request', 400);

  const files = (await removeFolder('receipts', user.id)) + (await removeFolder('statements', user.id));
  const { error } = await adminClient().auth.admin.deleteUser(user.id);
  if (error) throw new HttpError('server', 500);
  return json({ deleted: true, files });
});

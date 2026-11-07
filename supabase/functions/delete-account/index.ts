/**
 * Hapus akun (FR-SET-3; GDPR, UU PDP, PDPA, KVKK): hapus pengguna Auth, lalu berkas storage pengguna.
 * Tabel ikut terhapus lewat ON DELETE CASCADE; riwayat pesanan disimpan tanpa pemilik (diuji di scripts/db-test.mjs).
 */
import { deleteAccount } from '../_shared/account.ts';
import { adminClient, requireUser } from '../_shared/auth.ts';
import { DeleteAccountRequest } from '../_shared/contracts.ts';
import { HttpError, json, readJson, serve } from '../_shared/http.ts';

serve(async (req) => {
  const user = await requireUser(req);
  if (!DeleteAccountRequest.safeParse(await readJson(req)).success) throw new HttpError('bad_request', 400);
  return json(await deleteAccount(adminClient(), user.id));
});

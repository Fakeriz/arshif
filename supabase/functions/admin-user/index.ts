/**
 * Aksi admin pada satu pengguna (FR-ADM-2): grant Premium manual, cabut grant manual, suspend, buka suspend.
 * Grant dicatat sebagai pesanan provider 'manual' (jejak audit: siapa memberi, berapa hari) dan lewat jalur
 * grant yang sama dengan pembayaran web. Suspend = ban di Supabase Auth (sesi baru dan refresh ditolak)
 * + penanda profiles.suspended_at (aplikasi menampilkan layar akun ditangguhkan).
 */
import { adminClient, requireUser } from '../_shared/auth.ts';
import { AdminUserRequest } from '../_shared/contracts.ts';
import { grantOrder, refundOrder, revenueCatReady, syncPlan, type OrderRow } from '../_shared/entitlement.ts';
import { HttpError, json, readJson, serve } from '../_shared/http.ts';

const BAN_FOREVER = '876000h';

serve(async (req) => {
  const admin = await requireUser(req);
  const db = adminClient();
  const { data: isAdmin } = await db.from('admin_users').select('user_id').eq('user_id', admin.id).maybeSingle();
  if (!isAdmin) throw new HttpError('forbidden', 403);

  const input = AdminUserRequest.safeParse(await readJson(req));
  if (!input.success) throw new HttpError('bad_request', 400);
  const { action, userId } = input.data;
  const { data: target } = await db.from('profiles').select('id').eq('id', userId).maybeSingle();
  if (!target) throw new HttpError('not_found', 404);

  if (action === 'grant') {
    const { data: order, error } = await db
      .from('orders')
      .insert({ user_id: userId, provider: 'manual', period: 'custom', currency: 'USD', amount: 0, status: 'paid', paid_at: new Date().toISOString(), days: input.data.days, granted_by: admin.id })
      .select('id, user_id, provider, period, status, days, granted_until, grant_error')
      .single();
    if (error || !order) throw new HttpError('server', 500);
    if (!(await grantOrder(db, order as OrderRow))) throw new HttpError('provider_error', 502);
  }

  if (action === 'revoke') {
    const { data: active, error } = await db
      .from('orders')
      .select('id')
      .eq('user_id', userId)
      .eq('provider', 'manual')
      .eq('status', 'paid')
      .gt('granted_until', new Date().toISOString());
    if (error) throw new HttpError('server', 500);
    for (const o of active ?? []) await refundOrder(db, o.id);
    await syncPlan(db, userId);
  }

  if (action === 'suspend' || action === 'unsuspend') {
    if (action === 'suspend') {
      const { data: targetAdmin } = await db.from('admin_users').select('user_id').eq('user_id', userId).maybeSingle();
      if (targetAdmin) throw new HttpError('forbidden', 403, { message: 'target_is_admin' });
    }
    const { error: authError } = await db.auth.admin.updateUserById(userId, { ban_duration: action === 'suspend' ? BAN_FOREVER : 'none' });
    if (authError) throw new HttpError('server', 500, { message: 'auth_ban_failed' });
    const { error } = await db.from('profiles').update({ suspended_at: action === 'suspend' ? new Date().toISOString() : null }).eq('id', userId);
    if (error) throw new HttpError('server', 500);
  }

  const { data: p } = await db.from('profiles').select('plan, premium_until, suspended_at').eq('id', userId).single();
  return json({ plan: p?.plan ?? 'free', premiumUntil: p?.premium_until ?? null, suspendedAt: p?.suspended_at ?? null, revenueCat: revenueCatReady() });
});

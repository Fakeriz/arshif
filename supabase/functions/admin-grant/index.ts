/**
 * Grant Premium manual oleh admin (FR-ADM): dicatat sebagai pesanan provider 'manual' (jejak audit:
 * siapa memberi, berapa hari), lalu lewat jalur grant yang sama dengan pembayaran web.
 */
import { adminClient, requireUser } from '../_shared/auth.ts';
import { AdminGrantRequest } from '../_shared/contracts.ts';
import { grantOrder, type OrderRow } from '../_shared/entitlement.ts';
import { HttpError, json, readJson, serve } from '../_shared/http.ts';

serve(async (req) => {
  const admin = await requireUser(req);
  const db = adminClient();
  const { data: isAdmin } = await db.from('admin_users').select('user_id').eq('user_id', admin.id).maybeSingle();
  if (!isAdmin) throw new HttpError('forbidden', 403);

  const input = AdminGrantRequest.safeParse(await readJson(req));
  if (!input.success) throw new HttpError('bad_request', 400);
  const { data: target } = await db.rpc('admin_find_user_internal', { p_email: input.data.email });
  const userId = (target as { id: string }[] | null)?.[0]?.id;
  if (!userId) throw new HttpError('not_found', 404);

  const { data: order, error } = await db
    .from('orders')
    .insert({ user_id: userId, provider: 'manual', period: 'custom', currency: 'USD', amount: 0, status: 'paid', paid_at: new Date().toISOString(), days: input.data.days, granted_by: admin.id })
    .select('id, user_id, provider, period, status, days, granted_until, grant_error')
    .single();
  if (error || !order) throw new HttpError('server', 500);
  const until = await grantOrder(db, order as OrderRow);
  if (!until) throw new HttpError('provider_error', 502);
  return json({ orderId: order.id, premiumUntil: until });
});

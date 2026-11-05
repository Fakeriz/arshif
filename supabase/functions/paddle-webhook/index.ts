/**
 * Webhook Paddle Billing (web checkout global, sandbox dulu).
 * Verifikasi: Paddle-Signature = HMAC-SHA256(secret, "ts:rawBody"), toleransi 5 menit.
 * Event: transaction.completed / transaction.paid -> lunas; transaction.payment_failed -> gagal;
 * adjustment (refund/chargeback penuh yang disetujui) -> refunded + cabut grant.
 */
import { adminClient } from '../_shared/auth.ts';
import { verifyPaddleSignature } from '../_shared/billing.ts';
import { PADDLE_PRICE_ID, PADDLE_WEBHOOK_SECRET } from '../_shared/env.ts';
import { claimEvent, grantOrder, refundOrder, releaseEvent, transitionOrder } from '../_shared/entitlement.ts';
import { HttpError, json, serve } from '../_shared/http.ts';

type PaddleEvent = {
  event_id: string;
  event_type: string;
  data: {
    id: string;
    status?: string;
    action?: string;
    type?: 'full' | 'partial';
    transaction_id?: string;
    custom_data?: { order_id?: string } | null;
    items?: { price?: { id?: string }; price_id?: string }[];
    details?: { totals?: { grand_total?: string; discount?: string } };
  };
};

serve(async (req) => {
  const raw = await req.text();
  const ok = await verifyPaddleSignature(raw, req.headers.get('paddle-signature'), PADDLE_WEBHOOK_SECRET(), Math.floor(Date.now() / 1000));
  if (!ok) throw new HttpError('unauthorized', 401);
  let event: PaddleEvent;
  try {
    event = JSON.parse(raw) as PaddleEvent;
  } catch {
    throw new HttpError('bad_request', 400);
  }
  if (!event.event_id || !event.data?.id) throw new HttpError('bad_request', 400);
  const db = adminClient();
  if (!(await claimEvent(db, 'paddle', event.event_id))) return json({ ok: true, duplicate: true });

  try {
    if (event.event_type.startsWith('adjustment.')) {
      const d = event.data;
      if ((d.action === 'refund' || d.action === 'chargeback') && d.status === 'approved' && d.transaction_id) {
        const { data: order, error } = await db.from('orders').select('id').eq('provider', 'paddle').eq('provider_ref', d.transaction_id).maybeSingle();
        if (error) throw new Error(`order_read_${error.code}`);
        if (order && d.type === 'partial') {
          // Refund sebagian: Premium tidak dicabut otomatis, ditandai untuk diputuskan admin.
          await db.from('orders').update({ grant_error: 'partial_refund', updated_at: new Date().toISOString() }).eq('id', order.id);
        } else if (order) {
          await refundOrder(db, order.id);
        }
      }
      return json({ ok: true });
    }

    const orderId = event.data.custom_data?.order_id;
    if (!orderId) return json({ ok: true, ignored: event.event_type });
    const { data: order, error } = await db.from('orders').select('id, period, provider_ref').eq('id', orderId).eq('provider', 'paddle').maybeSingle();
    if (error) throw new Error(`order_read_${error.code}`);
    if (!order || (order.provider_ref && order.provider_ref !== event.data.id)) return json({ ok: true, unknown: true });
    const ref = order.provider_ref ? {} : { provider_ref: event.data.id };

    if (event.event_type === 'transaction.completed' || event.event_type === 'transaction.paid') {
      // Harga harus harga paket pesanan ini, tanpa diskon, dan benar-benar dibayar (Arshif tidak memakai kode diskon).
      const priceIds = (event.data.items ?? []).map((i) => i.price?.id ?? i.price_id);
      const totals = event.data.details?.totals;
      const paidInFull = Number(totals?.grand_total ?? 0) > 0 && Number(totals?.discount ?? 0) === 0;
      if (!priceIds.includes(PADDLE_PRICE_ID(order.period as 'monthly' | 'yearly')) || !paidInFull) {
        await db.from('orders').update({ grant_error: 'price_mismatch', updated_at: new Date().toISOString() }).eq('id', order.id);
        return json({ ok: true, rejected: 'price_mismatch' });
      }
      const updated = await transitionOrder(db, order.id, 'paid', ref);
      if (updated?.status === 'paid') await grantOrder(db, updated);
    } else if (event.event_type === 'transaction.payment_failed') {
      await transitionOrder(db, order.id, 'failed', ref);
    }
    return json({ ok: true });
  } catch (e) {
    await releaseEvent(db, 'paddle', event.event_id);
    throw e;
  }
});

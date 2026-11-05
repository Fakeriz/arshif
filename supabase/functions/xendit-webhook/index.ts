/**
 * Webhook Xendit: invoice (PAID/SETTLED/EXPIRED) dan refund (refund.succeeded).
 * Verifikasi: header x-callback-token = token webhook akun (perbandingan waktu-konstan).
 * Idempoten: webhook_events (provider, id+status) + transisi status bersyarat di orders.
 */
import { adminClient } from '../_shared/auth.ts';
import { minorToMajor, verifyStaticToken, xenditInvoiceStatus } from '../_shared/billing.ts';
import { XENDIT_CALLBACK_TOKEN } from '../_shared/env.ts';
import { claimEvent, grantOrder, refundOrder, releaseEvent, transitionOrder } from '../_shared/entitlement.ts';
import { HttpError, json, readJson, serve } from '../_shared/http.ts';
import { exponentOf } from '../_shared/money.ts';

type InvoiceCallback = { id: string; external_id: string; status: string; amount: number; currency: string };
type RefundCallback = { event: string; data: { id: string; invoice_id?: string | null } };

serve(async (req) => {
  if (!verifyStaticToken(req.headers.get('x-callback-token'), XENDIT_CALLBACK_TOKEN())) throw new HttpError('unauthorized', 401);
  const body = (await readJson(req)) as Partial<InvoiceCallback> & Partial<RefundCallback>;
  const db = adminClient();

  if (body.event === 'refund.succeeded' && body.data?.id && body.data.invoice_id) {
    const eventId = `refund:${body.data.id}`;
    if (!(await claimEvent(db, 'xendit', eventId))) return json({ ok: true, duplicate: true });
    try {
      const { data: order, error } = await db.from('orders').select('id').eq('provider', 'xendit').eq('provider_ref', body.data.invoice_id).maybeSingle();
      if (error) throw new Error(`order_read_${error.code}`);
      if (order) await refundOrder(db, order.id);
      return json({ ok: true });
    } catch (e) {
      await releaseEvent(db, 'xendit', eventId);
      throw e;
    }
  }

  if (!body.id || !body.external_id || !body.status) throw new HttpError('bad_request', 400);
  const incoming = xenditInvoiceStatus(body.status);
  if (!incoming) return json({ ok: true, ignored: body.status });
  const eventId = `${body.id}:${body.status}`;
  if (!(await claimEvent(db, 'xendit', eventId))) return json({ ok: true, duplicate: true });

  try {
    const { data: order, error } = await db
      .from('orders')
      .select('id, amount, currency, provider_ref')
      .eq('id', body.external_id)
      .eq('provider', 'xendit')
      .maybeSingle();
    if (error) throw new Error(`order_read_${error.code}`);
    // provider_ref kosong = penyimpanan ID invoice saat checkout gagal; external_id tetap mengikat ke pesanan ini.
    if (!order || (order.provider_ref && order.provider_ref !== body.id)) return json({ ok: true, unknown: true });
    if (incoming === 'paid' && (body.currency !== order.currency || Number(body.amount) !== minorToMajor(order.amount, exponentOf(order.currency)))) {
      // Tidak diberi Premium, tapi jejaknya terlihat di panel admin (Xendit tidak perlu mengirim ulang).
      await db.from('orders').update({ grant_error: 'amount_mismatch', updated_at: new Date().toISOString() }).eq('id', order.id);
      return json({ ok: true, rejected: 'amount_mismatch' });
    }
    const updated = await transitionOrder(db, order.id, incoming, order.provider_ref ? {} : { provider_ref: body.id });
    if (updated?.status === 'paid') await grantOrder(db, updated);
    return json({ ok: true });
  } catch (e) {
    await releaseEvent(db, 'xendit', eventId);
    throw e;
  }
});

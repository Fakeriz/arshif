/**
 * Webhook Xendit: invoice (PAID/SETTLED/EXPIRED) dan refund (refund.succeeded).
 * Verifikasi: header x-callback-token = token webhook akun (perbandingan waktu-konstan).
 * Idempoten: webhook_events (provider, id+status) + transisi status bersyarat di orders.
 */
import { adminClient } from '../_shared/auth.ts';
import { isUuid, minorToMajor, verifyStaticToken, xenditInvoiceStatus } from '../_shared/billing.ts';
import { configured, XENDIT_CALLBACK_TOKEN } from '../_shared/env.ts';
import { grantOrder, handleEventOnce, refundOrder, transitionOrder } from '../_shared/entitlement.ts';
import { HttpError, json, readJson, serve } from '../_shared/http.ts';
import { exponentOf } from '../_shared/money.ts';

type InvoiceCallback = { id: string; external_id: string; status: string; amount: number; currency: string };
type RefundCallback = { event: string; data: { id: string; invoice_id?: string | null; amount?: number | null } };

serve(async (req) => {
  // Secret belum diisi: 503 not_configured (bukan 500), penyedia mengirim ulang setelah dikonfigurasi.
  if (!configured('XENDIT_CALLBACK_TOKEN')) throw new HttpError('not_configured', 503);
  if (!verifyStaticToken(req.headers.get('x-callback-token'), XENDIT_CALLBACK_TOKEN())) throw new HttpError('unauthorized', 401);
  const body = (await readJson(req)) as Partial<InvoiceCallback> & Partial<RefundCallback>;
  const db = adminClient();

  if (body.event === 'refund.succeeded' && body.data?.id && body.data.invoice_id) {
    const eventId = `refund:${body.data.id}`;
    const invoiceId = body.data.invoice_id;
    return handleEventOnce(db, 'xendit', eventId, async () => {
      const { data: order, error } = await db.from('orders').select('id, amount, currency, status').eq('provider', 'xendit').eq('provider_ref', invoiceId).maybeSingle();
      if (error) throw new Error(`order_read_${error.code}`);
      if (!order) return json({ ok: true, unknown: true });
      if (order.status !== 'paid' && order.status !== 'refunded') throw new Error('order_not_paid_yet');
      // Refund sebagian (mis. kompensasi) tidak mencabut seluruh masa Premium: admin yang memutuskan (sama seperti Paddle).
      const rawAmount = body.data?.amount;
      const refunded = typeof rawAmount === 'number' ? rawAmount : Number.NaN;
      if (Number.isFinite(refunded) && refunded > 0 && refunded < minorToMajor(order.amount, exponentOf(order.currency))) {
        await db.from('orders').update({ grant_error: 'partial_refund', updated_at: new Date().toISOString() }).eq('id', order.id);
        return json({ ok: true, partial: true });
      }
      await refundOrder(db, order.id);
      return json({ ok: true });
    });
  }

  if (!body.id || !body.external_id || !body.status) throw new HttpError('bad_request', 400);
  // Invoice yang tidak dibuat aplikasi ini (dasbor/integrasi lain): bukan uuid pesanan, jangan memicu kirim ulang.
  if (!isUuid(body.external_id)) return json({ ok: true, unknown: true });
  const incoming = xenditInvoiceStatus(body.status);
  if (!incoming) return json({ ok: true, ignored: body.status });
  const eventId = `${body.id}:${body.status}`;
  return handleEventOnce(db, 'xendit', eventId, async () => {
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
  });
});

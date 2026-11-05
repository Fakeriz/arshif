/**
 * Web checkout (FR-PAY-2): buat pesanan + sesi bayar. Harga dan penyedia ditentukan server dari tabel
 * prices (klien hanya memilih paket, mata uang, metode). IDR/MYR -> Xendit, USD -> Paddle (sandbox dulu).
 */
import { adminClient, requireUser } from '../_shared/auth.ts';
import { METHODS_BY_CURRENCY } from '../_shared/billing.ts';
import { CheckoutRequest } from '../_shared/contracts.ts';
import { APP_URL, configured } from '../_shared/env.ts';
import { HttpError, json, readJson, serve } from '../_shared/http.ts';
import { createTransaction } from '../_shared/paddle.ts';
import { createInvoice } from '../_shared/xendit.ts';

const MAX_ORDERS_PER_10_MIN = 5;

serve(async (req) => {
  const user = await requireUser(req);
  const input = CheckoutRequest.safeParse(await readJson(req));
  if (!input.success) throw new HttpError('bad_request', 400);
  const { period, currency, method } = input.data;
  if (!METHODS_BY_CURRENCY[currency]?.includes(method)) throw new HttpError('bad_request', 400, { message: 'method_currency' });
  const db = adminClient();

  const { data: price } = await db.from('prices').select('amount, provider').eq('period', period).eq('currency', currency).maybeSingle();
  if (!price) throw new HttpError('bad_request', 400, { message: 'no_price' });
  const provider = price.provider as 'xendit' | 'paddle';
  const needed = provider === 'xendit'
    ? ['XENDIT_SECRET_KEY', 'XENDIT_CALLBACK_TOKEN', 'APP_URL', 'RC_SECRET_KEY']
    : ['PADDLE_API_KEY', 'PADDLE_WEBHOOK_SECRET', `PADDLE_PRICE_${period.toUpperCase()}`, 'RC_SECRET_KEY'];
  if (!configured(...needed)) throw new HttpError('not_configured', 503, { message: provider });

  const since = new Date(Date.now() - 10 * 60_000).toISOString();
  const { count } = await db.from('orders').select('id', { count: 'exact', head: true }).eq('user_id', user.id).gte('created_at', since);
  if ((count ?? 0) >= MAX_ORDERS_PER_10_MIN) throw new HttpError('rate_limited', 429);

  const { data: order, error } = await db
    .from('orders')
    .insert({ user_id: user.id, provider, period, currency, amount: price.amount, method })
    .select('id')
    .single();
  if (error || !order) throw new HttpError('server', 500);

  try {
    if (provider === 'xendit') {
      const { data: u } = await db.auth.admin.getUserById(user.id);
      const invoice = await createInvoice({
        orderId: order.id,
        amount: price.amount,
        currency,
        method,
        email: u.user?.email ?? null,
        description: period === 'monthly' ? 'Arshif Premium 1 bulan' : 'Arshif Premium 1 tahun',
        returnUrl: `${APP_URL()}/premium/order/${order.id}`,
      });
      const saved = await db.from('orders').update({ provider_ref: invoice.id, checkout_url: invoice.invoice_url, expires_at: invoice.expiry_date }).eq('id', order.id);
      if (saved.error) throw new HttpError('server', 500);
      return json({ orderId: order.id, provider, checkoutUrl: invoice.invoice_url, transactionId: null });
    }
    const txn = await createTransaction({ orderId: order.id, userId: user.id, period });
    const saved = await db.from('orders').update({ provider_ref: txn.id }).eq('id', order.id);
    if (saved.error) throw new HttpError('server', 500);
    return json({ orderId: order.id, provider, checkoutUrl: null, transactionId: txn.id });
  } catch (e) {
    await db.from('orders').update({ status: 'failed', grant_error: 'checkout_create_failed', updated_at: new Date().toISOString() }).eq('id', order.id);
    throw e;
  }
});

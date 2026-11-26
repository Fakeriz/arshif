import { PADDLE_API_BASE, PADDLE_API_KEY, PADDLE_PRICE_ID } from './env.ts';
import { HttpError } from './http.ts';

const TIMEOUT_MS = 12_000;

/**
 * Transaksi Paddle (one-time, tanpa langganan otomatis): Premium web = masa aktif yang dibeli, diperpanjang
 * manual. Checkout dibuka di klien lewat Paddle.js dengan ID transaksi ini.
 */
export async function createTransaction(input: { orderId: string; userId: string; period: 'monthly' | 'yearly' }): Promise<{ id: string }> {
  let res: Response;
  try {
    res = await fetch(`${PADDLE_API_BASE()}/transactions`, {
      method: 'POST',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { Authorization: `Bearer ${PADDLE_API_KEY()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ price_id: PADDLE_PRICE_ID(input.period), quantity: 1 }],
        custom_data: { order_id: input.orderId, user_id: input.userId },
        collection_mode: 'automatic',
      }),
    });
  } catch (e) {
    const timedOut = e instanceof Error && (e.name === 'AbortError' || e.name === 'TimeoutError');
    throw new HttpError('provider_error', 502, { message: timedOut ? 'paddle_timeout' : 'paddle_network' });
  }
  if (!res.ok) throw new HttpError('provider_error', 502, { message: `paddle_${res.status}` });
  const body = (await res.json()) as { data?: { id?: string } };
  if (!body.data?.id) throw new HttpError('provider_error', 502, { message: 'paddle_no_id' });
  return { id: body.data.id };
}

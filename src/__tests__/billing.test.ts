import {
  METHODS_BY_CURRENCY,
  minorToMajor,
  nextStatus,
  parsePaddleSignature,
  revenueCatUserIds,
  safeEqual,
  verifyPaddleSignature,
  verifyStaticToken,
  xenditInvoiceStatus,
  xenditPaymentMethods,
} from '../../supabase/functions/_shared/billing.ts';
import { CheckoutRequest, CheckoutResponse } from '../../supabase/functions/_shared/contracts.ts';

async function hmacHex(key: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const k = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(message))), (b) => b.toString(16).padStart(2, '0')).join('');
}

const UID = '3f1c2b8e-7d4a-4c1e-9b2f-0a1b2c3d4e5f';

describe('status pesanan: webhook terlambat/berulang tidak memundurkan status final', () => {
  it.each([
    ['pending', 'paid', 'paid'],
    ['pending', 'expired', 'expired'],
    ['pending', 'failed', 'failed'],
    ['failed', 'paid', 'paid'],
    ['expired', 'paid', 'paid'],
    ['paid', 'refunded', 'refunded'],
    ['paid', 'paid', null],
    ['paid', 'expired', null],
    ['paid', 'failed', null],
    ['refunded', 'paid', null],
    ['expired', 'failed', null],
    ['pending', 'refunded', null],
  ] as const)('%s + %s -> %s', (from, incoming, expected) => {
    expect(nextStatus(from, incoming)).toBe(expected);
  });
});

describe('nominal ke API penyedia', () => {
  it.each([
    [25000, 0, 25000],
    [690, 2, 6.9],
    [6900, 2, 69],
    [150, 2, 1.5],
  ])('%d (exp %d) -> %d', (minor, exp, major) => expect(minorToMajor(minor, exp)).toBe(major));
});

describe('metode bayar', () => {
  it('IDR: kanal Xendit per pilihan, MYR tidak difilter', () => {
    expect(xenditPaymentMethods('IDR', 'qris')).toEqual(['QRIS']);
    expect(xenditPaymentMethods('IDR', 'va')).toContain('BCA');
    expect(xenditPaymentMethods('MYR', 'fpx')).toBeUndefined();
  });
  it('metode per mata uang', () => {
    expect(METHODS_BY_CURRENCY.IDR).toEqual(['qris', 'va', 'ewallet']);
    expect(METHODS_BY_CURRENCY.MYR).toEqual(['fpx', 'ewallet']);
    expect(METHODS_BY_CURRENCY.USD).toEqual(['card']);
  });
  it.each([
    ['PAID', 'paid'],
    ['SETTLED', 'paid'],
    ['EXPIRED', 'expired'],
    ['PENDING', null],
  ])('status invoice Xendit %s -> %s', (s, expected) => expect(xenditInvoiceStatus(s)).toBe(expected));
});

describe('verifikasi webhook', () => {
  const secret = 'pdl_ntfset_test_secret';
  const raw = '{"event_id":"evt_01","event_type":"transaction.completed","data":{"id":"txn_01"}}';
  const sign = (ts: number, body = raw, key = secret) => hmacHex(key, `${ts}:${body}`);

  it('Paddle: tanda tangan benar diterima', async () => {
    const ts = 1_800_000_000;
    await expect(verifyPaddleSignature(raw, `ts=${ts};h1=${await sign(ts)}`, secret, ts + 10)).resolves.toBe(true);
  });
  it('Paddle: body diubah, secret salah, atau terlalu lama ditolak', async () => {
    const ts = 1_800_000_000;
    await expect(verifyPaddleSignature(raw.replace('txn_01', 'txn_02'), `ts=${ts};h1=${await sign(ts)}`, secret, ts)).resolves.toBe(false);
    await expect(verifyPaddleSignature(raw, `ts=${ts};h1=${await sign(ts, raw, 'lain')}`, secret, ts)).resolves.toBe(false);
    await expect(verifyPaddleSignature(raw, `ts=${ts};h1=${await sign(ts)}`, secret, ts + 301)).resolves.toBe(false);
    await expect(verifyPaddleSignature(raw, null, secret, ts)).resolves.toBe(false);
  });
  it('Paddle: header dengan dua h1 (rotasi secret)', () => {
    expect(parsePaddleSignature('ts=1;h1=aa;h1=bb')).toEqual({ ts: 1, h1: ['aa', 'bb'] });
    expect(parsePaddleSignature('h1=aa')).toBeNull();
  });
  it('token statis (Xendit x-callback-token, RevenueCat Authorization)', () => {
    expect(verifyStaticToken('tok_123', 'tok_123')).toBe(true);
    expect(verifyStaticToken('Bearer tok_123', 'tok_123')).toBe(true);
    expect(verifyStaticToken('tok_124', 'tok_123')).toBe(false);
    expect(verifyStaticToken(null, 'tok_123')).toBe(false);
    expect(verifyStaticToken('', '')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
  });
});

describe('RevenueCat', () => {
  it('ID pengguna Arshif dari event, abaikan ID anonim, sertakan transfer', () => {
    const other = '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c9d';
    expect(
      revenueCatUserIds({ app_user_id: UID, original_app_user_id: '$RCAnonymousID:abc', aliases: [UID, '$RCAnonymousID:abc'], transferred_to: [other] }).sort(),
    ).toEqual([UID, other].sort());
  });
});

describe('kontrak checkout', () => {
  it('menerima paket + mata uang + metode, menolak mata uang di luar daftar', () => {
    expect(CheckoutRequest.safeParse({ period: 'yearly', currency: 'IDR', method: 'qris' }).success).toBe(true);
    expect(CheckoutRequest.safeParse({ period: 'yearly', currency: 'EUR', method: 'card' }).success).toBe(false);
    expect(CheckoutRequest.safeParse({ period: 'weekly', currency: 'IDR', method: 'qris' }).success).toBe(false);
  });
  it('respons Paddle tanpa URL, dengan ID transaksi', () => {
    expect(CheckoutResponse.safeParse({ orderId: UID, provider: 'paddle', checkoutUrl: null, transactionId: 'txn_01' }).success).toBe(true);
  });
});

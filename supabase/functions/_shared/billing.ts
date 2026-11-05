/**
 * Logika billing murni (tanpa API Deno/Node selain WebCrypto) supaya bisa diuji jest:
 * verifikasi webhook, transisi status pesanan, pemetaan metode bayar. Masa Premium dihitung di SQL (reserve_grant).
 */

export type OrderStatus = 'pending' | 'paid' | 'expired' | 'failed' | 'refunded';
export type BillingPeriod = 'monthly' | 'yearly' | 'custom';

/** Bandingkan dua string tanpa bocor waktu (token webhook, tanda tangan). */
export function safeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

/**
 * Transisi status yang sah. Webhook bisa datang terlambat, berulang, atau tidak berurutan:
 * status final tidak boleh mundur. Pembayaran yang masuk setelah gagal/kedaluwarsa tetap dihormati.
 */
export function nextStatus(current: OrderStatus, incoming: OrderStatus): OrderStatus | null {
  if (current === incoming) return null;
  switch (incoming) {
    case 'paid':
      return current === 'pending' || current === 'failed' || current === 'expired' ? 'paid' : null;
    case 'expired':
    case 'failed':
      return current === 'pending' ? incoming : null;
    case 'refunded':
      return current === 'paid' ? 'refunded' : null;
    default:
      return null;
  }
}

/** Nominal unit terkecil -> angka unit besar untuk API penyedia (Xendit menerima 6.9 untuk RM 6,90). */
export function minorToMajor(minor: number, exponent: number): number {
  return exponent === 0 ? minor : Number((minor / 10 ** exponent).toFixed(exponent));
}

/**
 * Filter metode Xendit Invoice per pilihan pengguna. IDR memakai kode kanal Xendit Invoice;
 * MYR tidak difilter (FPX dan e-wallet yang aktif di akun Xendit Malaysia semuanya ditampilkan).
 */
export function xenditPaymentMethods(currency: string, method: string): string[] | undefined {
  if (currency !== 'IDR') return undefined;
  switch (method) {
    case 'va':
      return ['BCA', 'BNI', 'BRI', 'MANDIRI', 'PERMATA', 'BSI', 'CIMB'];
    case 'qris':
      return ['QRIS'];
    case 'ewallet':
      return ['OVO', 'DANA', 'SHOPEEPAY', 'LINKAJA', 'ASTRAPAY', 'JENIUSPAY'];
    default:
      return undefined;
  }
}

/** Metode yang ditawarkan per mata uang (UI dan validasi server memakai daftar yang sama). */
export const METHODS_BY_CURRENCY: Record<string, string[]> = {
  IDR: ['qris', 'va', 'ewallet'],
  MYR: ['fpx', 'ewallet'],
  USD: ['card'],
};

/** Status invoice Xendit -> status pesanan. SETTLED = dana sudah dicairkan, tetap lunas. */
export function xenditInvoiceStatus(status: string): OrderStatus | null {
  switch (status.toUpperCase()) {
    case 'PAID':
    case 'SETTLED':
      return 'paid';
    case 'EXPIRED':
      return 'expired';
    default:
      return null;
  }
}

export type PaddleSignature = { ts: number; h1: string[] };

/** Header "ts=1671552777;h1=abc..." (bisa lebih dari satu h1 saat rotasi secret). */
export function parsePaddleSignature(header: string | null): PaddleSignature | null {
  if (!header) return null;
  let ts = NaN;
  const h1: string[] = [];
  for (const part of header.split(';')) {
    const [k, v] = part.split('=');
    if (k === 'ts') ts = Number(v);
    else if (k === 'h1' && v) h1.push(v);
  }
  return Number.isFinite(ts) && h1.length ? { ts, h1 } : null;
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(message)));
  return Array.from(sig, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Tanda tangan Paddle = HMAC-SHA256(secret, `${ts}:${rawBody}`). Toleransi 5 menit untuk selisih jam;
 * pengulangan event di dalam jendela itu ditangani idempotensi (webhook_events).
 */
export async function verifyPaddleSignature(rawBody: string, header: string | null, secret: string, nowSec: number, toleranceSec = 300): Promise<boolean> {
  const sig = parsePaddleSignature(header);
  if (!sig || Math.abs(nowSec - sig.ts) > toleranceSec) return false;
  const expected = await hmacHex(secret, `${sig.ts}:${rawBody}`);
  return sig.h1.some((h) => safeEqual(h, expected));
}

/** Token statis di header (Xendit x-callback-token, RevenueCat Authorization). Terima juga awalan "Bearer ". */
export function verifyStaticToken(header: string | null, expected: string): boolean {
  if (!header || !expected) return false;
  const value = header.startsWith('Bearer ') ? header.slice(7) : header;
  return safeEqual(value.trim(), expected);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** ID pengguna Arshif dari event RevenueCat (abaikan ID anonim $RCAnonymousID). */
export function revenueCatUserIds(event: Record<string, unknown>): string[] {
  const ids = new Set<string>();
  const add = (v: unknown) => {
    if (typeof v === 'string' && UUID_RE.test(v)) ids.add(v.toLowerCase());
  };
  add(event.app_user_id);
  add(event.original_app_user_id);
  for (const key of ['aliases', 'transferred_from', 'transferred_to']) {
    const list = event[key];
    if (Array.isArray(list)) list.forEach(add);
  }
  return [...ids];
}

export function isUuid(v: unknown): v is string {
  return typeof v === 'string' && UUID_RE.test(v);
}

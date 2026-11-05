/** Variabel lingkungan Edge Functions. Secret tidak pernah dikirim ke klien atau ditulis ke log. */
function required(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`env ${name} belum diset`);
  return v;
}

export const SUPABASE_URL = (): string => required('SUPABASE_URL');

/** Kunci admin: format baru (SUPABASE_SECRET_KEYS JSON, kunci "default"), fallback kunci lama. */
export function adminKey(): string {
  const raw = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (raw) {
    try {
      const k = (JSON.parse(raw) as Record<string, string>).default;
      if (k) return k;
    } catch {
      // jatuh ke kunci lama
    }
  }
  return required('SUPABASE_SERVICE_ROLE_KEY');
}

export const GEMINI_API_KEY = (): string => required('GEMINI_API_KEY');
/**
 * Model utama + cadangan. PRD menulis gemini-2.5-flash, tapi model itu sudah ditutup Google untuk
 * pengguna baru (2026-11). Bisa diganti tanpa deploy ulang lewat secret GEMINI_MODEL / GEMINI_FALLBACK_MODEL.
 */
export const GEMINI_MODELS = (): string[] =>
  [Deno.env.get('GEMINI_MODEL') || 'gemini-3.1-flash-lite', Deno.env.get('GEMINI_FALLBACK_MODEL') || 'gemini-3.5-flash'].filter((m, i, a) => a.indexOf(m) === i);
export const CRON_SECRET = (): string => required('CRON_SECRET');

// ------------------------------------------------------------------ pembayaran (Fase 3). Semua lewat `supabase secrets set`.
/** RevenueCat REST v2: secret key proyek (sk_...), ID proyek, dan ID internal entitlement "premium" (entl...). */
export const RC_SECRET_KEY = (): string => required('RC_SECRET_KEY');
export const RC_PROJECT_ID = (): string => required('RC_PROJECT_ID');
export const RC_ENTITLEMENT_ID = (): string => required('RC_ENTITLEMENT_ID');
/** Nilai header Authorization yang diisi di dashboard webhook RevenueCat. */
export const RC_WEBHOOK_AUTH = (): string => required('RC_WEBHOOK_AUTH');

/** Xendit test mode dulu: kunci xnd_development_... */
export const XENDIT_SECRET_KEY = (): string => required('XENDIT_SECRET_KEY');
export const XENDIT_CALLBACK_TOKEN = (): string => required('XENDIT_CALLBACK_TOKEN');

/** Paddle sandbox dulu. PADDLE_ENV=production hanya setelah izin pemilik. */
export const PADDLE_API_KEY = (): string => required('PADDLE_API_KEY');
export const PADDLE_WEBHOOK_SECRET = (): string => required('PADDLE_WEBHOOK_SECRET');
export const PADDLE_PRICE_ID = (period: 'monthly' | 'yearly'): string => required(period === 'monthly' ? 'PADDLE_PRICE_MONTHLY' : 'PADDLE_PRICE_YEARLY');
export const PADDLE_API_BASE = (): string =>
  Deno.env.get('PADDLE_ENV') === 'production' ? 'https://api.paddle.com' : 'https://sandbox-api.paddle.com';

/** URL web aplikasi untuk kembali dari halaman bayar Xendit, mis. https://app.arshif.id */
export const APP_URL = (): string => required('APP_URL').replace(/\/+$/, '');

/** true bila semua secret yang dibutuhkan sudah diset (untuk pesan "belum dikonfigurasi", bukan 500). */
export function configured(...names: string[]): boolean {
  return names.every((n) => !!Deno.env.get(n));
}

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

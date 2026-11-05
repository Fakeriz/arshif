/**
 * Konfigurasi publik klien. Hanya nilai yang memang boleh ada di bundle (URL + publishable key).
 * Secret (service/secret key, Gemini, pembayaran) TIDAK PERNAH di sini: hanya di Edge Functions.
 * Bisa ditimpa saat build lewat EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_KEY.
 */
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://gyxtdpmruuhhkprlhlrk.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_SUPABASE_KEY ?? 'sb_publishable_wpUshOGMqfKvxr1eepL0gQ_yhWK4JGQ';

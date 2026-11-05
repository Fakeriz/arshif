/**
 * Konfigurasi publik klien. Hanya nilai yang memang boleh ada di bundle (URL + publishable key).
 * Secret (service/secret key, Gemini, pembayaran) TIDAK PERNAH di sini: hanya di Edge Functions.
 * Bisa ditimpa saat build lewat EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_KEY.
 */
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://gyxtdpmruuhhkprlhlrk.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_SUPABASE_KEY ?? 'sb_publishable_wpUshOGMqfKvxr1eepL0gQ_yhWK4JGQ';

/**
 * RevenueCat: kunci SDK publik per platform (appl_... / goog_...). Aman di bundle; secret key tetap di server.
 * Kosong = pembelian di aplikasi dimatikan (paywall menampilkan pesan, bukan error).
 */
export const RC_IOS_KEY = process.env.EXPO_PUBLIC_RC_IOS_KEY ?? '';
export const RC_ANDROID_KEY = process.env.EXPO_PUBLIC_RC_ANDROID_KEY ?? '';

/** Paddle.js (web checkout global): client-side token publik. Sandbox sampai pemilik mengizinkan production. */
export const PADDLE_CLIENT_TOKEN = process.env.EXPO_PUBLIC_PADDLE_CLIENT_TOKEN ?? '';
export const PADDLE_ENV: 'sandbox' | 'production' = process.env.EXPO_PUBLIC_PADDLE_ENV === 'production' ? 'production' : 'sandbox';

/**
 * Feature flag: wilayah (kode negara ISO, dipisah koma) tempat aplikasi native boleh menampilkan link
 * checkout web. Bawaan kosong = iOS tidak pernah menampilkan link checkout eksternal (aturan App Store).
 * Android juga kosong secara bawaan karena aturan Google Play untuk barang digital serupa.
 */
const regions = (v: string | undefined) => (v ?? '').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
export const WEB_CHECKOUT_REGIONS = {
  ios: regions(process.env.EXPO_PUBLIC_WEB_CHECKOUT_IOS_REGIONS),
  android: regions(process.env.EXPO_PUBLIC_WEB_CHECKOUT_ANDROID_REGIONS),
};

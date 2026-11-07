/**
 * Kurs terbaru dari klien (Live Market v2 Fase 4). Rantai berurutan, 8 detik per sumber:
 *   1. open.er-api.com  2. jsDelivr @fawazahmed0/currency-api  3. currency-api.pages.dev
 *   4. server Arshif (tabel fx_rates dari Frankfurter/ECB) sebagai sumber terakhir
 *   5. cache lokal maksimal 7 hari, ditandai `stale` ("kurs terakhir")
 * Riwayat kurs harian untuk transaksi lama (FR-FX-4) tetap dari server; modul ini hanya kurs hari ini.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export type LatestRates = { table: Record<string, string>; date: string | null; source: string; stale: boolean };

/**
 * Kode yang diambil = kode yang sama dengan feed Frankfurter sekarang. Sengaja tidak lebih luas: kode yang tiba-tiba
 * punya kurs harian akan mengalahkan "Kurs saya" milik pengguna (fx.ts perUsd), jadi perluasan butuh keputusan sendiri.
 */
export const FX_CODES = [
  'AUD', 'BRL', 'CAD', 'CHF', 'CNY', 'CZK', 'DKK', 'EUR', 'GBP', 'HKD', 'HUF', 'IDR', 'ILS', 'INR', 'ISK', 'JPY', 'KRW', 'MXN',
  'MYR', 'NOK', 'NZD', 'PHP', 'PLN', 'RON', 'SEK', 'SGD', 'THB', 'TRY', 'USD', 'ZAR',
] as const;

export const SOURCE_TIMEOUT_MS = 8_000;
/** Cache yang lebih muda dari ini dipakai langsung tanpa jaringan (aplikasi sering dibuka ulang; sumber terbit harian). */
export const FRESH_MS = 60 * 60_000;
/** Cache lebih tua dari ini tidak dipakai sama sekali. */
export const CACHE_MAX_MS = 7 * 24 * 60 * 60_000;
export const CACHE_KEY = 'arshif.fx.latest.v1';
/** Tabel dengan kode lebih sedikit dari ini dianggap rusak/terpotong, sumber berikutnya dicoba. */
const MIN_CODES = 20;

type Parsed = { table: Record<string, string>; date: string | null };
type Source = { name: string; url: string; parse: (body: unknown) => Parsed | null };
type Cached = Parsed & { source: string; savedAt: number };

/** Angka JSON -> string desimal biasa (rateToScaled menolak notasi 1e-5). */
function rateString(n: unknown): string | null {
  if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) return null;
  const plain = String(n);
  return /^\d+(\.\d+)?$/.test(plain) ? plain : n.toFixed(12).replace(/\.?0+$/, '');
}

/** Ambil kode yang diizinkan saja (fawazahmed0 juga memuat kripto 3 huruf seperti btc). */
function pick(rates: Record<string, unknown>, lower: boolean): Record<string, string> {
  const out: Record<string, string> = {};
  for (const code of FX_CODES) {
    const v = rateString(rates[lower ? code.toLowerCase() : code]);
    if (v) out[code] = v;
  }
  out.USD = '1';
  return out;
}

const fawaz = (name: string, url: string): Source => ({
  name,
  url,
  parse: (body) => {
    const b = body as { date?: unknown; usd?: Record<string, unknown> };
    if (!b?.usd || typeof b.usd !== 'object') return null;
    return { table: pick(b.usd, true), date: typeof b.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.date) ? b.date : null };
  },
});

export const SOURCES: Source[] = [
  {
    name: 'er-api',
    url: 'https://open.er-api.com/v6/latest/USD',
    parse: (body) => {
      const b = body as { result?: unknown; rates?: Record<string, unknown>; time_last_update_unix?: unknown };
      if (b?.result !== 'success' || !b.rates) return null;
      const unix = typeof b.time_last_update_unix === 'number' ? b.time_last_update_unix : null;
      return { table: pick(b.rates, false), date: unix ? new Date(unix * 1000).toISOString().slice(0, 10) : null };
    },
  },
  fawaz('jsdelivr', 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json'),
  fawaz('pages-dev', 'https://latest.currency-api.pages.dev/v1/currencies/usd.json'),
];

const usable = (p: Parsed | null): p is Parsed => !!p && Object.keys(p.table).length >= MIN_CODES;

/** fetch dengan batas waktu lewat AbortController (AbortSignal.timeout belum pasti ada di Hermes). */
async function getJson(url: string, fetchFn: typeof fetch): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), SOURCE_TIMEOUT_MS);
  try {
    const res = await fetchFn(url, { signal: ctrl.signal, headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`http_${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function readCache(): Promise<Cached | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    const c = raw ? (JSON.parse(raw) as Cached) : null;
    return c && typeof c.savedAt === 'number' && c.table && typeof c.table === 'object' ? c : null;
  } catch {
    return null;
  }
}

async function writeCache(c: Cached): Promise<void> {
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(c)).catch(() => undefined);
}

export type FxDeps = {
  /** Sumber terakhir sebelum cache: kurs Frankfurter di server. */
  server: () => Promise<Parsed>;
  fetchFn?: typeof fetch;
  now?: () => number;
  sources?: Source[];
};

/**
 * Kurs hari ini. Tidak pernah melempar: semua gagal dan cache tidak ada/terlalu tua = tabel kosong (USD saja),
 * sehingga layar menampilkan "kurs hilang" seperti sebelumnya, bukan angka karangan.
 */
export async function loadLatestRates({ server, fetchFn = fetch, now = Date.now, sources = SOURCES }: FxDeps): Promise<LatestRates> {
  const cached = await readCache();
  const age = cached ? now() - cached.savedAt : Infinity;
  if (cached && age < FRESH_MS) return { table: cached.table, date: cached.date, source: cached.source, stale: false };

  for (const s of sources) {
    try {
      const parsed = s.parse(await getJson(s.url, fetchFn));
      if (usable(parsed)) {
        await writeCache({ ...parsed, source: s.name, savedAt: now() });
        return { ...parsed, source: s.name, stale: false };
      }
    } catch {
      // Sumber ini mati/timeout/format berubah: lanjut ke sumber berikutnya.
    }
  }
  try {
    const parsed = await server();
    if (Object.keys(parsed.table).length > 0) {
      const table = { ...parsed.table, USD: '1' };
      await writeCache({ table, date: parsed.date, source: 'frankfurter', savedAt: now() });
      return { table, date: parsed.date, source: 'frankfurter', stale: false };
    }
  } catch {
    // Server juga tidak bisa: tinggal cache.
  }
  if (cached && age <= CACHE_MAX_MS) return { table: cached.table, date: cached.date, source: cached.source, stale: true };
  return { table: { USD: '1' }, date: null, source: 'none', stale: false };
}

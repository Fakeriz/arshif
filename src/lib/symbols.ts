import { IDX_STOCKS } from '@/data/idxStocks';

export type SymbolMarket = 'IDX' | 'US' | 'CRYPTO';
/** Satu pilihan di pemilih kode: kode netral (assets.symbol), nama, dan pasarnya. */
export type SymbolOption = { code: string; name: string; market: SymbolMarket };

/**
 * Kripto yang dipetakan ke CoinGecko (cermin COINGECKO_IDS di supabase/functions/_shared/price-coingecko.ts; tes menjaga
 * keduanya tetap sama). Nama dari CoinGecko /coins/markets 2026-11-07. TON kini bernama Gram di CoinGecko, koin yang sama.
 */
export const CRYPTO_COINS: readonly (readonly [string, string])[] = [
  ['BTC', 'Bitcoin'], ['ETH', 'Ethereum'], ['USDT', 'Tether'], ['USDC', 'USDC'], ['BNB', 'BNB'], ['SOL', 'Solana'],
  ['XRP', 'XRP'], ['DOGE', 'Dogecoin'], ['ADA', 'Cardano'], ['TRX', 'TRON'], ['TON', 'Gram (prev. Toncoin)'],
  ['AVAX', 'Avalanche'], ['DOT', 'Polkadot'], ['LINK', 'Chainlink'], ['POL', 'POL (ex-MATIC)'], ['LTC', 'Litecoin'],
  ['SHIB', 'Shiba Inu'], ['BCH', 'Bitcoin Cash'],
];

/** Kode IDX berbentuk 4 huruf/angka: hanya bentuk ini yang dicek ke server bila tidak ada di snapshot (IPO baru). */
export const IDX_CODE_RE = /^[A-Z0-9]{4}$/;

const fold = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9. ]/g, ' ');

/**
 * Cari di daftar lokal. Semua kata kueri harus ada di "kode nama". Urutan: kode persis, awalan kode atau nama persis, awalan kata nama,
 * lalu sisanya; seri diurutkan kode. Mis. "bri" -> BBRI (Bank Rakyat Indonesia) lewat awalan kata, bukan kebetulan.
 */
export function searchLocal(list: readonly (readonly [string, string])[], market: SymbolMarket, query: string, limit = 8): SymbolOption[] {
  const q = fold(query).trim();
  if (!q) return [];
  const words = q.split(/\s+/);
  const scored: { o: SymbolOption; score: number }[] = [];
  for (const [code, name] of list) {
    const c = code.toLowerCase();
    const hay = `${c} ${fold(name)}`;
    if (!words.every((w) => hay.includes(w))) continue;
    const folded = fold(name).trim();
    const initials = folded.split(/\s+/).filter(Boolean).map((w) => w[0]).join('');
    const score = c === q ? 0 : c.startsWith(q) || folded === q ? 1 : hay.split(/\s+/).some((w) => w.startsWith(words[0])) || initials.includes(q) ? 2 : 3;
    scored.push({ o: { code, name, market }, score });
  }
  return scored.sort((a, b) => a.score - b.score || a.o.code.localeCompare(b.o.code)).slice(0, limit).map((x) => x.o);
}

export const searchIdx = (q: string) => searchLocal(IDX_STOCKS, 'IDX', q);
export const searchCrypto = (q: string) => searchLocal(CRYPTO_COINS, 'CRYPTO', q);

/** Nama untuk kode yang sudah tersimpan (mode ubah). US tidak punya daftar lokal: null. */
export function knownName(market: SymbolMarket, code: string): string | null {
  const list = market === 'IDX' ? IDX_STOCKS : market === 'CRYPTO' ? CRYPTO_COINS : [];
  return list.find(([c]) => c === code)?.[1] ?? null;
}

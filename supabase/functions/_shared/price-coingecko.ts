/**
 * Kripto dari CoinGecko (gratis, tanpa kunci). Satu permintaan per 100 id; batas laju ketat, jadi cukup sekali per sync jam.
 * Kode yang tidak ada di peta tidak ditangani di sini dan jatuh ke penyedia cadangan (TradingView BINANCE:<KODE>USDT).
 */
import { fromUnix, type Quote, type SourcedProvider } from './asset-sync.ts';
import { errText, getJson } from './price-http.ts';

const API = 'https://api.coingecko.com/api/v3/simple/price';
const TIMEOUT_MS = 10_000;
const BATCH = 100;

/** Kode aset -> id CoinGecko. Id diperiksa 2026-11-07 lewat /simple/price. */
export const COINGECKO_IDS: Record<string, string> = {
  BTC: 'bitcoin', ETH: 'ethereum', USDT: 'tether', USDC: 'usd-coin', BNB: 'binancecoin', SOL: 'solana', XRP: 'ripple',
  DOGE: 'dogecoin', ADA: 'cardano', TRX: 'tron', TON: 'the-open-network', AVAX: 'avalanche-2', DOT: 'polkadot',
  LINK: 'chainlink', POL: 'polygon-ecosystem-token', LTC: 'litecoin', SHIB: 'shiba-inu', BCH: 'bitcoin-cash',
};

const code = (key: string) => key.slice('CRYPTO:'.length);

export const coinGeckoProvider: SourcedProvider = {
  name: 'coingecko',
  handles: (key) => key.startsWith('CRYPTO:') && code(key) in COINGECKO_IDS,
  async fetch(keys) {
    const quotes: Record<string, Quote> = {};
    const errors: string[] = [];
    for (let i = 0; i < keys.length; i += BATCH) {
      const part = keys.slice(i, i + BATCH);
      const ids = [...new Set(part.map((k) => COINGECKO_IDS[code(k)]))].join(',');
      try {
        const body = (await getJson(`${API}?ids=${ids}&vs_currencies=usd&include_last_updated_at=true`, TIMEOUT_MS)) as Record<
          string,
          { usd?: unknown; last_updated_at?: unknown }
        >;
        for (const key of part) {
          const coin = body?.[COINGECKO_IDS[code(key)]];
          if (typeof coin?.usd === 'number') quotes[key] = { price: coin.usd, currency: 'USD', quotedAt: fromUnix(coin.last_updated_at) };
        }
      } catch (e) {
        errors.push(errText(e));
      }
    }
    if (Object.keys(quotes).length === 0 && errors.length > 0) throw new Error(errors[0]);
    return { quotes };
  },
};

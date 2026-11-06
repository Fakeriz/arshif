/**
 * Penyedia harga TradingView lewat library komunitas @mathieuc/tradingview (bukan API resmi TradingView).
 * Satu koneksi dipakai untuk semua kode; tiap kode diambil sendiri supaya satu kode salah tidak menggagalkan batch.
 */
import { getQuote, TradingViewClient } from '@mathieuc/tradingview';

import type { PriceProvider, Quote } from './asset-sync.ts';
import { quoteMatches, tvCandidates } from './tradingview-symbols.ts';

const TIMEOUT_MS = 15_000;
const CONCURRENCY = 4;

async function quoteFor(key: string, client: TradingViewClient): Promise<Quote> {
  let last = 'no_candidate';
  for (const symbol of tvCandidates(key)) {
    try {
      const q = await getQuote({ symbol, client, timeoutMs: TIMEOUT_MS });
      if (typeof q.lp === 'number' && quoteMatches(key, q.pro_name, q.currency_code)) return { price: q.lp, currency: q.currency_code! };
      last = `mismatch_${q.pro_name ?? symbol}`;
    } catch (e) {
      last = e instanceof Error ? e.message : String(e);
    }
  }
  throw new Error(last);
}

export const tradingViewProvider: PriceProvider = {
  name: 'tradingview',
  async fetch(keys) {
    const client = new TradingViewClient();
    const quotes: Record<string, Quote> = {};
    const errors: string[] = [];
    try {
      let next = 0;
      const worker = async () => {
        while (next < keys.length) {
          const key = keys[next++];
          try {
            quotes[key] = await quoteFor(key, client);
          } catch (e) {
            errors.push(`${key}: ${e instanceof Error ? e.message : String(e)}`);
          }
        }
      };
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, keys.length) }, worker));
    } finally {
      await client.close().catch(() => undefined);
    }
    // Semua gagal = penyedia bermasalah (koneksi/protokol), bukan sekadar kode salah: laporkan sebagai error run.
    if (Object.keys(quotes).length === 0 && errors.length > 0) throw new Error(errors[0]);
    return { quotes };
  },
};

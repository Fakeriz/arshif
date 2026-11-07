/**
 * Saham US dan IDX dari endpoint chart publik Yahoo Finance (tidak resmi, bisa diblokir; TradingView jadi cadangan).
 * IDX memakai akhiran .JK dan tertunda 10-15 menit. Satu permintaan per simbol, paralel kecil.
 */
import { fromUnix, type Quote, type SourcedProvider } from './asset-sync.ts';
import { eachLimited, errText, getJson } from './price-http.ts';

const HOSTS = ['https://query1.finance.yahoo.com', 'https://query2.finance.yahoo.com'];
const TIMEOUT_MS = 8_000;
// shortcut: satu permintaan per simbol; ratusan kode saat Yahoo lambat bisa melewati batas waktu fungsi. Pindah ke endpoint batch bila kode aset > ~200.
const CONCURRENCY = 4;
// Tanpa User-Agent peramban Yahoo sering menolak (429/403).
const HEADERS = { 'user-agent': 'Mozilla/5.0' };

type Market = 'US' | 'IDX';
/** Kode bursa Yahoo untuk bursa utama AS (Nasdaq, NYSE, NYSE American, NYSE Arca, Cboe BZX). OTC sengaja tidak, sama dengan TradingView. */
export const US_EXCHANGES = new Set(['NMS', 'NGM', 'NCM', 'NYQ', 'ASE', 'PCX', 'BTS']);
type Meta = { regularMarketPrice?: unknown; currency?: unknown; exchangeName?: unknown; instrumentType?: unknown; regularMarketTime?: unknown };

/** Kunci netral -> simbol Yahoo. BRK.B -> BRK-B (Yahoo memakai tanda hubung untuk kelas saham US). */
export function yahooSymbol(key: string): string | null {
  const [market, code] = key.split(':');
  if (market === 'US') return code.replace(/\./g, '-');
  if (market === 'IDX') return `${code}.JK`;
  return null;
}

/** Tolak hasil dari bursa/mata uang lain supaya ticker yang mirip tidak tertukar. */
export function yahooMatches(market: Market, meta: Meta): boolean {
  if (typeof meta.regularMarketPrice !== 'number') return false;
  if (market === 'IDX') return meta.currency === 'IDR' && meta.exchangeName === 'JKT';
  return meta.currency === 'USD' && US_EXCHANGES.has(meta.exchangeName as string) && (meta.instrumentType === 'EQUITY' || meta.instrumentType === 'ETF');
}

async function quoteFor(market: Market, key: string): Promise<Quote> {
  const symbol = encodeURIComponent(yahooSymbol(key)!);
  let last = 'no_host';
  for (const host of HOSTS) {
    try {
      const body = (await getJson(`${host}/v8/finance/chart/${symbol}?interval=1d&range=1d`, TIMEOUT_MS, HEADERS)) as {
        chart?: { result?: { meta?: Meta }[] | null };
      };
      const meta = body?.chart?.result?.[0]?.meta;
      // regularMarketTime = waktu transaksi terakhir yang dikirim (untuk IDX sudah termasuk delay), bukan waktu sync.
      if (meta && yahooMatches(market, meta)) {
        return { price: meta.regularMarketPrice as number, currency: meta.currency as string, quotedAt: fromUnix(meta.regularMarketTime) };
      }
      throw new Error(`mismatch_${String(meta?.exchangeName ?? 'none')}`);
    } catch (e) {
      last = errText(e);
      // Data tidak cocok bukan masalah host: jangan ulangi ke host kedua.
      if (last.startsWith('mismatch_') || last === 'http_404') break;
    }
  }
  throw new Error(last);
}

function yahooProvider(market: Market): SourcedProvider {
  return {
    name: market === 'US' ? 'yahoo-us' : 'yahoo-idx',
    handles: (key) => key.startsWith(`${market}:`),
    async fetch(keys) {
      const quotes: Record<string, Quote> = {};
      const errors: string[] = [];
      await eachLimited(keys, CONCURRENCY, async (key) => {
        try {
          quotes[key] = await quoteFor(market, key);
        } catch (e) {
          errors.push(`${key}: ${errText(e)}`);
        }
      });
      // Semua gagal = sumbernya bermasalah (blokir/format berubah), laporkan sebagai error run.
      if (Object.keys(quotes).length === 0 && errors.length > 0) throw new Error(errors[0]);
      return { quotes };
    },
  };
}

export const yahooUsProvider = yahooProvider('US');
export const yahooIdxProvider = yahooProvider('IDX');

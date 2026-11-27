/**
 * Ambil deret harga historis nyata dari sisi server (tanpa batas CORS peramban) untuk grafik SVG cadangan.
 * Memakai aturan validasi pasar/mata uang yang sama persis dengan penyedia harga (`price-yahoo.ts` & `price-coingecko.ts`).
 */
import type { AssetChartMarket, AssetChartRange, AssetChartResponse } from './contracts.ts';
import { COINGECKO_IDS } from './price-coingecko.ts';
import { errText, getJson } from './price-http.ts';
import { US_EXCHANGES } from './price-yahoo.ts';

type RangeSpec = {
  days: number;
  binanceInterval: string;
  binanceLimit: number;
  yahooInterval: string;
  yahooRange: string;
};

export const CHART_RANGE_SPECS: Record<AssetChartRange, RangeSpec> = {
  '1M': { days: 30, binanceInterval: '1d', binanceLimit: 31, yahooInterval: '1d', yahooRange: '1mo' },
  '3M': { days: 90, binanceInterval: '1d', binanceLimit: 92, yahooInterval: '1d', yahooRange: '3mo' },
  '12M': { days: 365, binanceInterval: '1d', binanceLimit: 365, yahooInterval: '1d', yahooRange: '1y' },
  '60M': { days: 1825, binanceInterval: '1w', binanceLimit: 260, yahooInterval: '1wk', yahooRange: '5y' },
  ALL: { days: 3650, binanceInterval: '1M', binanceLimit: 180, yahooInterval: '1mo', yahooRange: 'max' },
};

const YAHOO_HOSTS = ['https://query1.finance.yahoo.com', 'https://query2.finance.yahoo.com'] as const;
const YAHOO_HEADERS = { 'user-agent': 'Mozilla/5.0' };
const TIMEOUT_MS = 6_000;
const MAX_POINTS = 400;

export type SeriesPoint = { dayMs: number; value: number };

export function normalizeSeriesPoints(raw: SeriesPoint[], maxPoints = MAX_POINTS): SeriesPoint[] | null {
  const byTime = new Map<number, number>();
  for (const p of raw) {
    if (Number.isFinite(p.dayMs) && p.dayMs > 0 && Number.isFinite(p.value) && p.value > 0 && p.value <= 1e15) {
      byTime.set(Math.round(p.dayMs), p.value);
    }
  }
  if (byTime.size < 2) return null;
  const sorted = [...byTime.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([dayMs, value]) => ({ dayMs, value }));
  if (sorted.length <= maxPoints) return sorted;
  const sampled: SeriesPoint[] = [];
  const lastIdx = sorted.length - 1;
  for (let i = 0; i < maxPoints; i++) {
    sampled.push(sorted[Math.round((i / (maxPoints - 1)) * lastIdx)]!);
  }
  return sampled;
}

type ProviderStatus =
  | { status: 'ok'; points: SeriesPoint[] }
  | { status: 'not_found'; points: null }
  | { status: 'unavailable'; error: string };

const pad2 = (n: number) => String(n).padStart(2, '0');
const formatUtcCompact = (ms: number, endOfDay: boolean): string => {
  const d = new Date(ms);
  const ymd = `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}`;
  return endOfDay ? `${ymd}235959` : `${ymd}000000`;
};

async function fetchYahooCandles(
  market: 'IDX' | 'US' | 'GOLD',
  yahooTicker: string,
  spec: RangeSpec,
): Promise<ProviderStatus> {
  const encoded = encodeURIComponent(yahooTicker);
  let last = 'no_host';
  for (const host of YAHOO_HOSTS) {
    try {
      const body = (await getJson(
        `${host}/v8/finance/chart/${encoded}?interval=${spec.yahooInterval}&range=${spec.yahooRange}`,
        TIMEOUT_MS,
        YAHOO_HEADERS,
      )) as {
        chart?: {
          result?: {
            meta?: { currency?: unknown; exchangeName?: unknown; instrumentType?: unknown };
            timestamp?: unknown[];
            indicators?: { quote?: { close?: unknown[] }[] };
          }[];
        };
      };
      const result = body?.chart?.result?.[0];
      const meta = result?.meta;
      if (!meta) return { status: 'not_found', points: null };
      if (market === 'IDX' && (meta.currency !== 'IDR' || meta.exchangeName !== 'JKT')) {
        return { status: 'not_found', points: null };
      }
      if (
        market === 'US' &&
        (meta.currency !== 'USD' ||
          !US_EXCHANGES.has(meta.exchangeName as string) ||
          (meta.instrumentType !== 'EQUITY' && meta.instrumentType !== 'ETF'))
      ) {
        return { status: 'not_found', points: null };
      }
      if (market === 'GOLD' && meta.currency !== 'USD') {
        return { status: 'not_found', points: null };
      }
      const ts = result?.timestamp;
      const closes = result?.indicators?.quote?.[0]?.close;
      if (!Array.isArray(ts) || !Array.isArray(closes)) return { status: 'not_found', points: null };
      const len = Math.min(ts.length, closes.length);
      const raw: SeriesPoint[] = [];
      for (let i = 0; i < len; i++) {
        const t = Number(ts[i]);
        const c = closes[i] == null ? Number.NaN : Number(closes[i]);
        raw.push({ dayMs: t * 1000, value: c });
      }
      const pts = normalizeSeriesPoints(raw);
      return pts ? { status: 'ok', points: pts } : { status: 'not_found', points: null };
    } catch (e) {
      last = errText(e);
      if (last === 'http_404') return { status: 'not_found', points: null };
    }
  }
  return { status: 'unavailable', error: last };
}

async function fetchCnbcCandles(cnbcSym: string, spec: RangeSpec): Promise<ProviderStatus> {
  const interval = spec.days > 400 ? '1W' : '1D';
  const now = Date.now();
  const startStr = formatUtcCompact(now - spec.days * 86_400_000, false);
  const endStr = formatUtcCompact(now + 86_400_000, true);
  const url = `https://ts-api.cnbc.com/harmony/app/bars/${encodeURIComponent(cnbcSym)}/${interval}/${startStr}/${endStr}/adjusted/UTC.json`;
  try {
    const body = (await getJson(url, TIMEOUT_MS)) as {
      barData?: { priceBars?: { tradeTime?: unknown; tradeTimeinMills?: unknown; close?: unknown }[] };
    };
    const bars = body?.barData?.priceBars;
    if (!Array.isArray(bars) || bars.length < 2) return { status: 'not_found', points: null };
    const raw: SeriesPoint[] = [];
    for (const b of bars) {
      const close = Number(b?.close);
      let dayMs = Number.NaN;
      if (typeof b?.tradeTime === 'string') {
        const m = /^(\d{4})(\d{2})(\d{2})/.exec(b.tradeTime);
        if (m) dayMs = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
      }
      if (!Number.isFinite(dayMs)) dayMs = Number(b?.tradeTimeinMills);
      raw.push({ dayMs, value: close });
    }
    const pts = normalizeSeriesPoints(raw);
    return pts ? { status: 'ok', points: pts } : { status: 'not_found', points: null };
  } catch (e) {
    const msg = errText(e);
    if (msg === 'http_404') return { status: 'not_found', points: null };
    return { status: 'unavailable', error: msg };
  }
}

async function fetchBinanceCandles(pair: string, spec: RangeSpec): Promise<SeriesPoint[] | null> {
  const url = `https://data-api.binance.vision/api/v3/klines?symbol=${encodeURIComponent(pair)}&interval=${spec.binanceInterval}&limit=${spec.binanceLimit}`;
  const body = await getJson(url, TIMEOUT_MS);
  if (!Array.isArray(body)) return null;
  const raw: SeriesPoint[] = [];
  for (const row of body) {
    if (!Array.isArray(row) || row.length < 5) continue;
    raw.push({ dayMs: Number(row[0]), value: Number(row[4]) });
  }
  return normalizeSeriesPoints(raw);
}

async function fetchCoinGeckoCandles(coinId: string, days: number): Promise<SeriesPoint[] | null> {
  const clampedDays = Math.min(days, 365);
  const url = `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(coinId)}/market_chart?vs_currency=usd&days=${clampedDays}&interval=daily`;
  const body = (await getJson(url, TIMEOUT_MS)) as { prices?: unknown };
  if (!Array.isArray(body?.prices)) return null;
  const raw: SeriesPoint[] = [];
  for (const row of body.prices) {
    if (!Array.isArray(row) || row.length < 2) continue;
    raw.push({ dayMs: Number(row[0]), value: Number(row[1]) });
  }
  return normalizeSeriesPoints(raw);
}

export async function fetchServerChartSeries(
  market: AssetChartMarket,
  code: string,
  range: AssetChartRange,
): Promise<AssetChartResponse | null> {
  if (market === 'GOLD' && code !== 'XAU') return null;
  if (market === 'CRYPTO' && (code === 'USDT' || code === 'USDC')) return null;

  const spec = CHART_RANGE_SPECS[range];

  if (market === 'IDX') {
    const yahoo = await fetchYahooCandles('IDX', `${code}.JK`, spec);
    if (yahoo.status === 'ok') return { currency: 'IDR', points: yahoo.points };
    if (yahoo.status === 'not_found') return null;
    const cnbc = await fetchCnbcCandles(`${code}-ID`, spec);
    if (cnbc.status === 'ok') return { currency: 'IDR', points: cnbc.points };
    if (cnbc.status === 'not_found') return null;
    throw new Error(cnbc.error);
  }

  if (market === 'US') {
    const yahoo = await fetchYahooCandles('US', code.replace(/\./g, '-'), spec);
    if (yahoo.status === 'ok') return { currency: 'USD', points: yahoo.points };
    if (yahoo.status === 'not_found') return null;
    throw new Error(yahoo.error);
  }

  if (market === 'GOLD') {
    const yahoo = await fetchYahooCandles('GOLD', 'GC=F', spec);
    if (yahoo.status === 'ok') return { currency: 'USD', points: yahoo.points };
    const paxg = await fetchBinanceCandles('PAXGUSDT', spec).catch(() => null);
    if (paxg) return { currency: 'USD', points: paxg };
    const cgGold = await fetchCoinGeckoCandles('pax-gold', spec.days).catch(() => null);
    if (cgGold) return { currency: 'USD', points: cgGold };
    const cnbcGold = await fetchCnbcCandles('XAU=', spec);
    if (cnbcGold.status === 'ok') return { currency: 'USD', points: cnbcGold.points };
    throw new Error('gold_unavailable');
  }

  let binanceUnavailable = false;
  let lastErr = 'crypto_unavailable';
  try {
    const pts = await fetchBinanceCandles(`${code}USDT`, spec);
    if (pts) return { currency: 'USD', points: pts };
  } catch (e) {
    const msg = errText(e);
    if (msg !== 'http_400' && msg !== 'http_404') {
      binanceUnavailable = true;
      lastErr = msg;
    }
  }

  const cgId = COINGECKO_IDS[code];
  if (cgId) {
    try {
      const pts = await fetchCoinGeckoCandles(cgId, spec.days);
      return pts ? { currency: 'USD', points: pts } : null;
    } catch (e) {
      const msg = errText(e);
      if (msg === 'http_404') return null;
      throw new Error(msg);
    }
  }

  if (binanceUnavailable) throw new Error(lastErr);
  return null;
}

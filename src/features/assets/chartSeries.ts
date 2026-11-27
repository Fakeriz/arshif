import { Platform } from 'react-native';

import type { AssetPrice, PricePoint } from '@/data/assets';
import { loadPriceHistory } from '@/data/remote/assets';
import { FnError, invokeFn } from '@/data/remote/functions';
import { SYMBOL_RE } from '@/lib/assets';
import { addDays, isYmd, todayYmd } from '@/lib/dates';
import { supabase } from '@/lib/supabase';

import { AssetChartResponse, FUNCTIONS } from '../../../supabase/functions/_shared/contracts';
import { resetPreferredChartMode, type ChartRange } from './chartHtml';

export type ChartMarket = 'IDX' | 'US' | 'CRYPTO' | 'GOLD';

export type ParsedChartSymbol = {
  market: ChartMarket;
  code: string;
  priceKey: string;
  currency: 'IDR' | 'USD';
};

export type ChartSeriesPoint = { dayMs: number; value: number };

export type ChartSeries = {
  currency: string;
  points: ChartSeriesPoint[];
};

type RangeSpec = {
  days: number;
  binanceInterval: string;
  binanceLimit: number;
  yahooInterval: string;
  yahooRange: string;
};

const RANGE_SPECS: Record<ChartRange, RangeSpec> = {
  '1M': { days: 30, binanceInterval: '1d', binanceLimit: 31, yahooInterval: '1d', yahooRange: '1mo' },
  '3M': { days: 90, binanceInterval: '1d', binanceLimit: 92, yahooInterval: '1d', yahooRange: '3mo' },
  '12M': { days: 365, binanceInterval: '1d', binanceLimit: 365, yahooInterval: '1d', yahooRange: '1y' },
  '60M': { days: 1825, binanceInterval: '1w', binanceLimit: 260, yahooInterval: '1wk', yahooRange: '5y' },
  ALL: { days: 3650, binanceInterval: '1M', binanceLimit: 180, yahooInterval: '1mo', yahooRange: 'max' },
};

const COINGECKO_IDS: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  USDT: 'tether',
  USDC: 'usd-coin',
  BNB: 'binancecoin',
  SOL: 'solana',
  XRP: 'ripple',
  DOGE: 'dogecoin',
  ADA: 'cardano',
  TRX: 'tron',
  TON: 'the-open-network',
  AVAX: 'avalanche-2',
  DOT: 'polkadot',
  LINK: 'chainlink',
  POL: 'polygon-ecosystem-token',
  LTC: 'litecoin',
  SHIB: 'shiba-inu',
  BCH: 'bitcoin-cash',
};

const US_EXCHANGES = new Set(['NMS', 'NGM', 'NCM', 'NYQ', 'ASE', 'PCX', 'BTS']);
const YAHOO_HOSTS = ['https://query1.finance.yahoo.com', 'https://query2.finance.yahoo.com'] as const;
const YAHOO_HEADERS = { 'user-agent': 'Mozilla/5.0' };
const FETCH_TIMEOUT_MS = 6_000;
const CACHE_TTL_MS = 2 * 60_000;
const EDGE_DOWN_COOLDOWN_MS = 10 * 60_000;
const MAX_POINTS = 400;

const seriesCache = new Map<string, { expiresAt: number; data: ChartSeries }>();
let sameOriginApiUnsupported = false;
let edgeChartDownUntil = 0;

/** Reset status deteksi endpoint untuk pengujian terisolasi. */
export function resetChartSeriesEndpointState(): void {
  sameOriginApiUnsupported = false;
  edgeChartDownUntil = 0;
  seriesCache.clear();
  resetPreferredChartMode();
}

/** Petakan simbol grafik TradingView kembali ke pasar, kode netral, priceKey, dan mata uang kutipan. */
export function parseChartSymbol(symbol: string): ParsedChartSymbol | null {
  const s = symbol.trim();
  if (!s) return null;
  if (s === 'OANDA:XAUUSD' || s === 'TVC:GOLD') {
    return { market: 'GOLD', code: 'XAU', priceKey: 'GOLD:XAU', currency: 'USD' };
  }
  if (s.startsWith('IDX:')) {
    const code = s.slice(4);
    return SYMBOL_RE.test(code) ? { market: 'IDX', code, priceKey: `IDX:${code}`, currency: 'IDR' } : null;
  }
  const cryptoMatch = /^[A-Z0-9]+:([A-Z0-9.]+)USDT$/.exec(s);
  if (cryptoMatch) {
    const code = cryptoMatch[1]!;
    return SYMBOL_RE.test(code) ? { market: 'CRYPTO', code, priceKey: `CRYPTO:${code}`, currency: 'USD' } : null;
  }
  if (SYMBOL_RE.test(s)) {
    return { market: 'US', code: s, priceKey: `US:${s}`, currency: 'USD' };
  }
  return null;
}

function normalizePoints(raw: ChartSeriesPoint[]): ChartSeriesPoint[] | null {
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
  if (sorted.length <= MAX_POINTS) return sorted;
  const sampled: ChartSeriesPoint[] = [];
  const lastIdx = sorted.length - 1;
  for (let i = 0; i < MAX_POINTS; i++) {
    sampled.push(sorted[Math.round((i / (MAX_POINTS - 1)) * lastIdx)]!);
  }
  return sampled;
}

async function fetchJson(url: string, outerSignal?: AbortSignal, headers?: Record<string, string>): Promise<unknown> {
  if (typeof fetch !== 'function') throw new Error('no_fetch');
  if (outerSignal?.aborted) throw new Error('aborted');
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const onAbort = () => controller?.abort();
  outerSignal?.addEventListener('abort', onAbort, { once: true });
  const timer = controller ? setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS) : null;
  try {
    const init: RequestInit = {};
    if (controller) init.signal = controller.signal;
    if (headers) init.headers = headers;
    const res = await fetch(url, Object.keys(init).length > 0 ? init : undefined);
    if (!res || !res.ok) throw new Error(`http_${res?.status ?? 0}`);
    return await res.json();
  } finally {
    if (timer) clearTimeout(timer);
    outerSignal?.removeEventListener('abort', onAbort);
  }
}

async function fetchBinanceKlines(pair: string, spec: RangeSpec, signal?: AbortSignal): Promise<ChartSeriesPoint[] | null> {
  const url = `https://data-api.binance.vision/api/v3/klines?symbol=${encodeURIComponent(pair)}&interval=${spec.binanceInterval}&limit=${spec.binanceLimit}`;
  const body = await fetchJson(url, signal);
  if (!Array.isArray(body)) return null;
  const raw: ChartSeriesPoint[] = [];
  for (const row of body) {
    if (!Array.isArray(row) || row.length < 5) continue;
    raw.push({ dayMs: Number(row[0]), value: Number(row[4]) });
  }
  return normalizePoints(raw);
}

async function fetchCoinGeckoSeries(coinId: string, days: number, signal?: AbortSignal): Promise<ChartSeriesPoint[] | null> {
  const clampedDays = Math.min(days, 365);
  const url = `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(coinId)}/market_chart?vs_currency=usd&days=${clampedDays}&interval=daily`;
  const body = (await fetchJson(url, signal)) as { prices?: unknown };
  if (!Array.isArray(body?.prices)) return null;
  const raw: ChartSeriesPoint[] = [];
  for (const row of body.prices) {
    if (!Array.isArray(row) || row.length < 2) continue;
    raw.push({ dayMs: Number(row[0]), value: Number(row[1]) });
  }
  return normalizePoints(raw);
}

type ProviderResult =
  | { status: 'ok'; points: ChartSeriesPoint[] }
  | { status: 'not_found'; points: null }
  | { status: 'unavailable'; points: null };

async function fetchYahooSeries(
  market: 'IDX' | 'US' | 'GOLD',
  yahooTicker: string,
  expectedCurrency: 'IDR' | 'USD',
  spec: RangeSpec,
  signal?: AbortSignal,
): Promise<ProviderResult> {
  const encoded = encodeURIComponent(yahooTicker);
  for (const host of YAHOO_HOSTS) {
    try {
      const body = (await fetchJson(
        `${host}/v8/finance/chart/${encoded}?interval=${spec.yahooInterval}&range=${spec.yahooRange}`,
        signal,
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
      const currency = meta?.currency;
      if (typeof currency === 'string' && currency.toUpperCase() !== expectedCurrency) {
        return { status: 'not_found', points: null };
      }
      if (market === 'IDX' && typeof meta?.exchangeName === 'string' && meta.exchangeName !== 'JKT') {
        return { status: 'not_found', points: null };
      }
      if (market === 'US') {
        if (typeof meta?.exchangeName === 'string' && !US_EXCHANGES.has(meta.exchangeName)) {
          return { status: 'not_found', points: null };
        }
        if (typeof meta?.instrumentType === 'string' && meta.instrumentType !== 'EQUITY' && meta.instrumentType !== 'ETF') {
          return { status: 'not_found', points: null };
        }
      }
      const ts = result?.timestamp;
      const closes = result?.indicators?.quote?.[0]?.close;
      if (!Array.isArray(ts) || !Array.isArray(closes)) continue;
      const len = Math.min(ts.length, closes.length);
      const raw: ChartSeriesPoint[] = [];
      for (let i = 0; i < len; i++) {
        const t = Number(ts[i]);
        const c = closes[i] == null ? Number.NaN : Number(closes[i]);
        raw.push({ dayMs: t * 1000, value: c });
      }
      const pts = normalizePoints(raw);
      return pts ? { status: 'ok', points: pts } : { status: 'not_found', points: null };
    } catch (e) {
      if (signal?.aborted) return { status: 'unavailable', points: null };
      if (e instanceof Error && e.message === 'http_404') return { status: 'not_found', points: null };
    }
  }
  return { status: 'unavailable', points: null };
}

/**
 * Endpoint same-origin `/api/asset-chart` (Vercel Serverless Function di produksi & middleware Metro di `expo start --web`).
 * Pada server statis murni yang mengembalikan `index.html` (`text/html`), ditandai tidak didukung tanpa error konsol.
 */
async function fetchSameOriginSeries(
  parsed: ParsedChartSymbol,
  range: ChartRange,
  signal: AbortSignal | undefined,
  useCache: boolean,
): Promise<ProviderResult> {
  if (
    Platform.OS !== 'web' ||
    typeof fetch !== 'function' ||
    typeof window === 'undefined' ||
    typeof window.location?.protocol !== 'string' ||
    !/^https?:$/i.test(window.location.protocol) ||
    (useCache && sameOriginApiUnsupported) ||
    signal?.aborted
  ) {
    return { status: 'unavailable', points: null };
  }

  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const onAbort = () => controller?.abort();
  signal?.addEventListener('abort', onAbort, { once: true });
  const timer = controller ? setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS) : null;

  try {
    const sessionRes = await supabase.auth?.getSession?.().catch(() => null);
    const token = sessionRes?.data?.session?.access_token;
    const headers: Record<string, string> | undefined = token ? { Authorization: `Bearer ${token}` } : undefined;
    const qs = `market=${encodeURIComponent(parsed.market)}&code=${encodeURIComponent(parsed.code)}&range=${encodeURIComponent(range)}`;
    const init: RequestInit = {};
    if (controller) init.signal = controller.signal;
    if (headers) init.headers = headers;

    const res = await fetch(`/api/asset-chart?${qs}`, Object.keys(init).length > 0 ? init : undefined);
    if (!res) return { status: 'unavailable', points: null };
    const ct = res.headers?.get?.('content-type') ?? '';
    if (!ct.toLowerCase().includes('application/json')) {
      if (useCache) sameOriginApiUnsupported = true;
      return { status: 'unavailable', points: null };
    }
    if (!res.ok) return { status: 'unavailable', points: null };

    const body = (await res.json().catch(() => null)) as {
      ok?: unknown;
      error?: unknown;
      currency?: unknown;
      points?: ChartSeriesPoint[];
    } | null;
    if (body?.ok === true && body.currency === parsed.currency && Array.isArray(body.points)) {
      const pts = normalizePoints(body.points);
      return pts ? { status: 'ok', points: pts } : { status: 'not_found', points: null };
    }
    if (body?.error === 'not_found') return { status: 'not_found', points: null };
    return { status: 'unavailable', points: null };
  } catch {
    return { status: 'unavailable', points: null };
  } finally {
    if (timer) clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

async function fetchEdgeChartSeries(
  parsed: ParsedChartSymbol,
  range: ChartRange,
  signal: AbortSignal | undefined,
  useCache: boolean,
): Promise<ProviderResult> {
  if (signal?.aborted) return { status: 'unavailable', points: null };
  if (useCache && Date.now() < edgeChartDownUntil) return { status: 'unavailable', points: null };

  try {
    const res = await invokeFn(FUNCTIONS.assetChart, { market: parsed.market, code: parsed.code, range }, AssetChartResponse);
    if (signal?.aborted || res.currency !== parsed.currency) return { status: 'not_found', points: null };
    const pts = normalizePoints(res.points);
    return pts ? { status: 'ok', points: pts } : { status: 'not_found', points: null };
  } catch (err) {
    if (err instanceof FnError && err.code === 'not_found') {
      return { status: 'not_found', points: null };
    }
    if (useCache && (err instanceof FnError ? err.code === 'network' || err.code === 'server' : true)) {
      edgeChartDownUntil = Date.now() + EDGE_DOWN_COOLDOWN_MS;
    }
    return { status: 'unavailable', points: null };
  }
}

const pad2 = (n: number) => String(n).padStart(2, '0');
const formatUtcCompact = (ms: number, endOfDay: boolean): string => {
  const d = new Date(ms);
  const ymd = `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}`;
  return endOfDay ? `${ymd}235959` : `${ymd}000000`;
};

const normalizeCurrency = (c: string) => (c.toUpperCase() === 'USDT' || c.toUpperCase() === 'USDC' ? 'USD' : c.toUpperCase());

/**
 * Cadangan publik ber-CORS (`Access-Control-Allow-Origin: *`, GET sederhana tanpa header khusus / preflight)
 * untuk saham IDX (`<KODE>-ID`), saham AS (`<KODE>`), dan emas (`XAU=`) saat `/api/asset-chart` maupun
 * Edge Function `asset-chart` belum tersedia (misalnya pratinjau build statis sebelum deploy fungsi backend).
 */
async function fetchCnbcSeries(
  parsed: ParsedChartSymbol,
  spec: RangeSpec,
  signal?: AbortSignal,
  livePrice?: AssetPrice,
): Promise<ChartSeriesPoint[] | null> {
  let cnbcSym: string;
  if (parsed.market === 'IDX') cnbcSym = `${parsed.code}-ID`;
  else if (parsed.market === 'US') cnbcSym = parsed.code;
  else if (parsed.market === 'GOLD') cnbcSym = 'XAU=';
  else return null;

  // Pada endpoint CNBC, `1M` adalah 1 menit (bukan 1 bulan); gunakan `1D` atau `1W`.
  const interval = spec.days > 400 ? '1W' : '1D';
  const now = Date.now();
  const startStr = formatUtcCompact(now - spec.days * 86_400_000, false);
  const endStr = formatUtcCompact(now + 86_400_000, true);
  const url = `https://ts-api.cnbc.com/harmony/app/bars/${encodeURIComponent(cnbcSym)}/${interval}/${startStr}/${endStr}/adjusted/UTC.json`;

  const body = (await fetchJson(url, signal)) as {
    barData?: { priceBars?: { tradeTime?: unknown; tradeTimeinMills?: unknown; close?: unknown }[] };
  };
  const bars = body?.barData?.priceBars;
  if (!Array.isArray(bars) || bars.length < 2) return null;

  const raw: ChartSeriesPoint[] = [];
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

  const pts = normalizePoints(raw);
  if (!pts) return null;

  if (
    parsed.market === 'US' &&
    livePrice &&
    normalizeCurrency(livePrice.currency) === 'USD' &&
    Number.isFinite(livePrice.price) &&
    livePrice.price > 0
  ) {
    const ratio = pts[pts.length - 1]!.value / livePrice.price;
    if (ratio < 0.05 || ratio > 20) return null;
  }

  return pts;
}

async function fetchWebOrServerSeries(
  parsed: ParsedChartSymbol,
  range: ChartRange,
  spec: RangeSpec,
  signal: AbortSignal | undefined,
  useCache: boolean,
  livePrice?: AssetPrice,
): Promise<ChartSeriesPoint[] | null> {
  const sameOrigin = await fetchSameOriginSeries(parsed, range, signal, useCache);
  if (sameOrigin.status === 'ok') return sameOrigin.points;
  if (sameOrigin.status === 'not_found' || signal?.aborted) return null;

  const edge = await fetchEdgeChartSeries(parsed, range, signal, useCache);
  if (edge.status === 'ok') return edge.points;
  if (edge.status === 'not_found' || signal?.aborted) return null;

  return fetchCnbcSeries(parsed, spec, signal, livePrice).catch(() => null);
}

/**
 * Riwayat harian `asset_price_history` + harga live, dideduplikasi per hari kalender UTC (`YYYY-MM-DD`)
 * supaya satu hari yang sama tidak pernah membentuk 2 titik palsu ("27 Nov - 27 Nov").
 */
async function fetchHistoryFallback(
  parsed: ParsedChartSymbol,
  days: number,
  cachedHistory?: PricePoint[],
  livePrice?: AssetPrice,
): Promise<ChartSeries | null> {
  const cutoff = addDays(todayYmd(), -Math.min(days, 365));
  const remote = await loadPriceHistory([parsed.priceKey], cutoff).catch(() => ({} as Record<string, PricePoint[]>));
  const byDay = new Map<string, number>();

  for (const p of [...(cachedHistory ?? []), ...(remote[parsed.priceKey] ?? [])]) {
    if (
      isYmd(p.day) &&
      p.day >= cutoff &&
      normalizeCurrency(p.currency) === parsed.currency &&
      Number.isFinite(p.price) &&
      p.price > 0 &&
      p.price <= 1e15
    ) {
      byDay.set(p.day, p.price);
    }
  }

  if (
    livePrice &&
    normalizeCurrency(livePrice.currency) === parsed.currency &&
    Number.isFinite(livePrice.price) &&
    livePrice.price > 0 &&
    livePrice.price <= 1e15
  ) {
    const at = Date.parse(livePrice.quotedAt ?? livePrice.fetchedAt);
    if (Number.isFinite(at)) {
      const liveDay = new Date(at).toISOString().slice(0, 10);
      if (liveDay >= cutoff) byDay.set(liveDay, livePrice.price);
    }
  }

  if (byDay.size < 2) return null;
  const raw: ChartSeriesPoint[] = [...byDay.entries()].map(([day, value]) => ({
    dayMs: Date.parse(`${day}T00:00:00Z`),
    value,
  }));
  const points = normalizePoints(raw);
  return points ? { currency: parsed.currency, points } : null;
}

/**
 * Ambil deret harga historis nyata untuk grafik SVG bawaan/cadangan (saat modul WebView tidak tersedia di Expo Go,
 * pengguna memilih grafik bawaan, atau widget TradingView gagal dimuat/diblokir). Mengembalikan null bila < 2 titik valid.
 */
export async function fetchChartSeries(
  symbol: string,
  range: ChartRange = '3M',
  options?: { signal?: AbortSignal; cachedHistory?: PricePoint[]; livePrice?: AssetPrice },
): Promise<ChartSeries | null> {
  const parsed = parseChartSymbol(symbol);
  if (!parsed) return null;

  const useCache = typeof process === 'undefined' || !process.env?.JEST_WORKER_ID;
  const cacheKey = `${parsed.priceKey}:${range}`;
  if (useCache) {
    const hit = seriesCache.get(cacheKey);
    if (hit && Date.now() < hit.expiresAt) return hit.data;
  }

  const spec = RANGE_SPECS[range];
  const signal = options?.signal;
  // Endpoint publik Yahoo Finance tidak mengirim header CORS: hanya dipanggil langsung di Native.
  // Di Web, saham IDX/US diambil lewat `/api/asset-chart` (Vercel/Metro), Edge Function `asset-chart`, atau sumber CORS publik.
  const canCallYahooDirect = Platform.OS !== 'web';
  let points: ChartSeriesPoint[] | null = null;

  if (parsed.market === 'CRYPTO') {
    points = await fetchBinanceKlines(`${parsed.code}USDT`, spec, signal).catch(() => null);
    if (!points && !signal?.aborted) {
      const cgId = COINGECKO_IDS[parsed.code];
      if (cgId) points = await fetchCoinGeckoSeries(cgId, spec.days, signal).catch(() => null);
    }
    if (!points && !canCallYahooDirect && !signal?.aborted) {
      points = await fetchWebOrServerSeries(parsed, range, spec, signal, useCache, options?.livePrice);
    }
  } else if (parsed.market === 'GOLD') {
    if (canCallYahooDirect) {
      const yahooRes = await fetchYahooSeries('GOLD', 'GC=F', 'USD', spec, signal);
      if (yahooRes.status === 'ok') points = yahooRes.points;
    }
    if (!points && !signal?.aborted) {
      points = await fetchBinanceKlines('PAXGUSDT', spec, signal).catch(() => null);
    }
    if (!points && !signal?.aborted) {
      points = await fetchCoinGeckoSeries('pax-gold', spec.days, signal).catch(() => null);
    }
    if (!points && !canCallYahooDirect && !signal?.aborted) {
      points = await fetchWebOrServerSeries(parsed, range, spec, signal, useCache, options?.livePrice);
    }
  } else {
    if (canCallYahooDirect) {
      const yahooSym = parsed.market === 'IDX' ? `${parsed.code}.JK` : parsed.code.replace(/\./g, '-');
      const yahooRes = await fetchYahooSeries(parsed.market, yahooSym, parsed.currency, spec, signal);
      if (yahooRes.status === 'ok') {
        points = yahooRes.points;
      } else if (yahooRes.status === 'unavailable' && !signal?.aborted) {
        points = await fetchCnbcSeries(parsed, spec, signal, options?.livePrice).catch(() => null);
      }
    } else {
      points = await fetchWebOrServerSeries(parsed, range, spec, signal, useCache, options?.livePrice);
    }
  }

  if (signal?.aborted) return null;

  const series: ChartSeries | null = points
    ? { currency: parsed.currency, points }
    : await fetchHistoryFallback(parsed, spec.days, options?.cachedHistory, options?.livePrice);

  if (series && useCache) {
    if (seriesCache.size >= 100) seriesCache.delete(seriesCache.keys().next().value!);
    seriesCache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, data: series });
  }
  return series;
}

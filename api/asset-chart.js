/**
 * Endpoint deret harga historis cadangan untuk Web (Vercel Serverless Function `/api/asset-chart`
 * sekaligus dipakai middleware pengembangan lokal `metro.config.js` pada `expo start --web`).
 * Menjembatani batas CORS Yahoo Finance di peramban bahkan sebelum Edge Function Supabase `asset-chart` ter-deploy.
 */
const crypto = require('node:crypto');

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://gyxtdpmruuhhkprlhlrk.supabase.co';
const SUPABASE_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  'sb_publishable_wpUshOGMqfKvxr1eepL0gQ_yhWK4JGQ';

const SYMBOL_RE = /^(?=.{1,15}$)[A-Z0-9]+(\.[A-Z0-9]+)*$/;
const MARKETS = new Set(['IDX', 'US', 'CRYPTO', 'GOLD']);
const US_EXCHANGES = new Set(['NMS', 'NGM', 'NCM', 'NYQ', 'ASE', 'PCX', 'BTS']);
const YAHOO_HOSTS = ['https://query1.finance.yahoo.com', 'https://query2.finance.yahoo.com'];
const YAHOO_HEADERS = { 'user-agent': 'Mozilla/5.0' };

const RANGE_SPECS = {
  '1M': { days: 30, binanceInterval: '1d', binanceLimit: 31, yahooInterval: '1d', yahooRange: '1mo' },
  '3M': { days: 90, binanceInterval: '1d', binanceLimit: 92, yahooInterval: '1d', yahooRange: '3mo' },
  '12M': { days: 365, binanceInterval: '1d', binanceLimit: 365, yahooInterval: '1d', yahooRange: '1y' },
  '60M': { days: 1825, binanceInterval: '1w', binanceLimit: 260, yahooInterval: '1wk', yahooRange: '5y' },
  ALL: { days: 3650, binanceInterval: '1M', binanceLimit: 180, yahooInterval: '1mo', yahooRange: 'max' },
};

const COINGECKO_IDS = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
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

const TIMEOUT_MS = 6_000;
const MAX_POINTS = 400;
const CACHE_MS = 5 * 60_000;
const CACHE_JITTER_MS = 30_000;
const CACHE_MAX = 500;
const AUTH_CACHE_MS = 2 * 60_000;

const seriesCache = new Map();
const inFlight = new Map();
const authCache = new Map();
const rateBuckets = new Map();

function sendJson(res, status, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  for (const [k, v] of Object.entries(extraHeaders)) res.setHeader(k, v);
  res.end(body);
}

function normalizePoints(raw) {
  const byTime = new Map();
  for (const p of raw) {
    if (Number.isFinite(p.dayMs) && p.dayMs > 0 && Number.isFinite(p.value) && p.value > 0 && p.value <= 1e15) {
      byTime.set(Math.round(p.dayMs), p.value);
    }
  }
  if (byTime.size < 2) return null;
  const sorted = [...byTime.entries()].sort((a, b) => a[0] - b[0]).map(([dayMs, value]) => ({ dayMs, value }));
  if (sorted.length <= MAX_POINTS) return sorted;
  const sampled = [];
  const lastIdx = sorted.length - 1;
  for (let i = 0; i < MAX_POINTS; i++) {
    sampled.push(sorted[Math.round((i / (MAX_POINTS - 1)) * lastIdx)]);
  }
  return sampled;
}

async function getJson(url, headers) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, headers });
    if (!res.ok) throw new Error(`http_${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

const pad2 = (n) => String(n).padStart(2, '0');
const formatUtcCompact = (ms, endOfDay) => {
  const d = new Date(ms);
  const ymd = `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}`;
  return endOfDay ? `${ymd}235959` : `${ymd}000000`;
};

async function fetchYahooCandles(market, yahooTicker, spec) {
  const encoded = encodeURIComponent(yahooTicker);
  let lastErr = 'yahoo_unavailable';
  for (const host of YAHOO_HOSTS) {
    try {
      const body = await getJson(
        `${host}/v8/finance/chart/${encoded}?interval=${spec.yahooInterval}&range=${spec.yahooRange}`,
        YAHOO_HEADERS,
      );
      const result = body?.chart?.result?.[0];
      const meta = result?.meta;
      if (!meta) return { status: 'not_found', points: null };
      if (market === 'IDX' && (meta.currency !== 'IDR' || meta.exchangeName !== 'JKT')) {
        return { status: 'not_found', points: null };
      }
      if (
        market === 'US' &&
        (meta.currency !== 'USD' ||
          !US_EXCHANGES.has(meta.exchangeName) ||
          (meta.instrumentType !== 'EQUITY' && meta.instrumentType !== 'ETF'))
      ) {
        return { status: 'not_found', points: null };
      }
      if (market === 'GOLD' && meta.currency !== 'USD') return { status: 'not_found', points: null };
      const ts = result?.timestamp;
      const closes = result?.indicators?.quote?.[0]?.close;
      if (!Array.isArray(ts) || !Array.isArray(closes)) return { status: 'not_found', points: null };
      const len = Math.min(ts.length, closes.length);
      const raw = [];
      for (let i = 0; i < len; i++) {
        const t = Number(ts[i]);
        const c = closes[i] == null ? Number.NaN : Number(closes[i]);
        raw.push({ dayMs: t * 1000, value: c });
      }
      const pts = normalizePoints(raw);
      return pts ? { status: 'ok', points: pts } : { status: 'not_found', points: null };
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
      if (lastErr === 'http_404') return { status: 'not_found', points: null };
    }
  }
  return { status: 'unavailable', error: lastErr };
}

async function fetchCnbcCandles(cnbcSym, spec) {
  const interval = spec.days > 400 ? '1W' : '1D';
  const now = Date.now();
  const startStr = formatUtcCompact(now - spec.days * 86_400_000, false);
  const endStr = formatUtcCompact(now + 86_400_000, true);
  const url = `https://ts-api.cnbc.com/harmony/app/bars/${encodeURIComponent(cnbcSym)}/${interval}/${startStr}/${endStr}/adjusted/UTC.json`;
  try {
    const body = await getJson(url);
    const bars = body?.barData?.priceBars;
    if (!Array.isArray(bars) || bars.length < 2) return { status: 'not_found', points: null };
    const raw = [];
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
    return pts ? { status: 'ok', points: pts } : { status: 'not_found', points: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === 'http_404') return { status: 'not_found', points: null };
    return { status: 'unavailable', error: msg };
  }
}

async function fetchBinanceCandles(pair, spec) {
  const url = `https://data-api.binance.vision/api/v3/klines?symbol=${encodeURIComponent(pair)}&interval=${spec.binanceInterval}&limit=${spec.binanceLimit}`;
  const body = await getJson(url);
  if (!Array.isArray(body)) return null;
  const raw = [];
  for (const row of body) {
    if (!Array.isArray(row) || row.length < 5) continue;
    raw.push({ dayMs: Number(row[0]), value: Number(row[4]) });
  }
  return normalizePoints(raw);
}

async function fetchCoinGeckoCandles(coinId, days) {
  const clampedDays = Math.min(days, 365);
  const url = `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(coinId)}/market_chart?vs_currency=usd&days=${clampedDays}&interval=daily`;
  const body = await getJson(url);
  if (!Array.isArray(body?.prices)) return null;
  const raw = [];
  for (const row of body.prices) {
    if (!Array.isArray(row) || row.length < 2) continue;
    raw.push({ dayMs: Number(row[0]), value: Number(row[1]) });
  }
  return normalizePoints(raw);
}

async function resolveSeries(market, code, range) {
  if (market === 'GOLD' && code !== 'XAU') return null;
  if (market === 'CRYPTO' && (code === 'USDT' || code === 'USDC')) return null;

  const spec = RANGE_SPECS[range];

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
    const msg = e instanceof Error ? e.message : String(e);
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
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === 'http_404') return null;
      throw new Error(msg);
    }
  }

  if (binanceUnavailable) throw new Error(lastErr);
  return null;
}

async function verifyBearerToken(authHeader) {
  if (typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  if (!token || token.length > 8192) return null;

  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const now = Date.now();
  const cached = authCache.get(hash);
  if (cached && now < cached.expiresAt) return cached.userId;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4_000);
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      signal: controller.signal,
      headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_KEY },
    });
    if (!res.ok) return null;
    const body = await res.json().catch(() => null);
    const userId = typeof body?.id === 'string' && body.id ? body.id : null;
    if (userId) {
      if (authCache.size >= 500) authCache.delete(authCache.keys().next().value);
      authCache.set(hash, { userId, expiresAt: now + AUTH_CACHE_MS });
    }
    return userId;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function hitRateLimit(bucketKey, perMinute) {
  const now = Date.now();
  if (rateBuckets.size > 5000) rateBuckets.clear();
  const recent = (rateBuckets.get(bucketKey) ?? []).filter((t) => now - t < 60_000);
  if (recent.length >= perMinute) return false;
  recent.push(now);
  rateBuckets.set(bucketKey, recent);
  return true;
}

function readBody(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  if (typeof req.body === 'string') {
    try {
      return Promise.resolve(JSON.parse(req.body));
    } catch {
      return Promise.resolve(null);
    }
  }
  return new Promise((resolve) => {
    let raw = '';
    let tooBig = false;
    req.on?.('data', (chunk) => {
      raw += String(chunk);
      if (raw.length > 4096) tooBig = true;
    });
    req.on?.('end', () => {
      if (tooBig || !raw) return resolve(null);
      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve(null);
      }
    });
    req.on?.('error', () => resolve(null));
  });
}

module.exports = async function assetChartHandler(req, res) {
  if (req.headers?.['sec-fetch-site'] === 'cross-site') {
    return sendJson(res, 403, { ok: false, error: 'forbidden' });
  }
  if (req.method !== 'GET' && req.method !== 'POST') {
    return sendJson(res, 405, { ok: false, error: 'method_not_allowed' }, { Allow: 'GET, POST' });
  }

  let market = '';
  let code = '';
  let range = '3M';

  if (req.method === 'GET') {
    const parsedUrl = new URL(req.url || '/api/asset-chart', 'http://localhost');
    market = (parsedUrl.searchParams.get('market') || '').trim();
    code = (parsedUrl.searchParams.get('code') || '').trim();
    range = (parsedUrl.searchParams.get('range') || '3M').trim();
  } else {
    const body = await readBody(req);
    market = typeof body?.market === 'string' ? body.market.trim() : '';
    code = typeof body?.code === 'string' ? body.code.trim() : '';
    range = typeof body?.range === 'string' ? body.range.trim() : '3M';
  }

  if (!MARKETS.has(market) || !SYMBOL_RE.test(code) || !Object.prototype.hasOwnProperty.call(RANGE_SPECS, range)) {
    return sendJson(res, 400, { ok: false, error: 'bad_request' });
  }

  const isVercel = process.env.VERCEL === '1';
  let callerKey = String(req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || 'local').split(',')[0].trim();

  if (isVercel) {
    const userId = await verifyBearerToken(req.headers?.authorization);
    if (!userId) return sendJson(res, 401, { ok: false, error: 'unauthorized' });
    callerKey = `u:${userId}`;
  }

  if (!hitRateLimit(callerKey, isVercel ? 30 : 60)) {
    return sendJson(res, 429, { ok: false, error: 'rate_limited' }, { 'Retry-After': '60' });
  }

  const key = `${market}:${code}:${range}`;
  const now = Date.now();
  const hit = seriesCache.get(key);
  if (hit && now < hit.expiresAt) {
    return hit.data
      ? sendJson(res, 200, { ok: true, ...hit.data })
      : sendJson(res, 200, { ok: false, error: 'not_found' });
  }

  let promise = inFlight.get(key);
  if (!promise) {
    promise = (async () => {
      const fresh = await resolveSeries(market, code, range);
      if (seriesCache.size >= CACHE_MAX) seriesCache.delete(seriesCache.keys().next().value);
      const ttlMs = (fresh ? CACHE_MS : 60_000) + Math.floor(Math.random() * CACHE_JITTER_MS);
      seriesCache.set(key, { expiresAt: Date.now() + ttlMs, data: fresh });
      return fresh;
    })();
    inFlight.set(key, promise);
  }

  try {
    const data = await promise;
    return data
      ? sendJson(res, 200, { ok: true, ...data })
      : sendJson(res, 200, { ok: false, error: 'not_found' });
  } catch {
    return sendJson(res, 502, { ok: false, error: 'provider_error' });
  } finally {
    if (inFlight.get(key) === promise) inFlight.delete(key);
  }
};

module.exports.resetForTests = function resetAssetChartApiForTests() {
  seriesCache.clear();
  inFlight.clear();
  authCache.clear();
  rateBuckets.clear();
};

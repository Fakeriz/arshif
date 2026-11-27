/**
 * Deret harga historis cadangan untuk grafik aset (saat domain widget TradingView diblokir di jaringan/peramban,
 * khususnya saham IDX/US di web yang tidak bisa memanggil Yahoo langsung karena CORS).
 * Wajib login (bukan proxy terbuka), dibatasi per pengguna, singleflight + cache singkat.
 */
import { fetchServerChartSeries } from '../_shared/asset-chart.ts';
import { adminClient, requireUser } from '../_shared/auth.ts';
import { AssetChartRequest, type AssetChartResponse } from '../_shared/contracts.ts';
import { HttpError, json, readJson, serve } from '../_shared/http.ts';
import { logEvent } from '../_shared/logger.ts';

const CACHE_MS = 5 * 60_000;
const CACHE_JITTER_MS = 30_000;
const CACHE_MAX = 500;
const PER_MINUTE = 30;
const PER_DAY = 500;
const cache = new Map<string, { expiresAt: number; data: AssetChartResponse | null }>();
const inFlight = new Map<string, Promise<AssetChartResponse | null>>();
const calls = new Map<string, number[]>();

serve(
  async (req, ctx) => {
    const user = await requireUser(req);
    const parsed = AssetChartRequest.safeParse(await readJson(req));
    if (!parsed.success) throw new HttpError('bad_request', 400);
    const { market, code, range } = parsed.data;

    const now = Date.now();
    const { data: allowed, error: rateErr } = await adminClient().rpc('rate_limit_hit', {
      p_user: user.id,
      p_bucket: 'asset_chart',
      p_per_min: PER_MINUTE,
      p_per_day: PER_DAY,
    });
    if (rateErr) {
      if (calls.size > 5000) calls.clear();
      const recent = (calls.get(user.id) ?? []).filter((t) => now - t < 60_000);
      if (recent.length >= PER_MINUTE) throw new HttpError('rate_limited', 429, { retryAfterSec: 60 });
      calls.set(user.id, [...recent, now]);
    } else if (!allowed) {
      throw new HttpError('rate_limited', 429, { retryAfterSec: 60 });
    }

    const key = `${market}:${code}:${range}`;
    const hit = cache.get(key);
    if (hit && now < hit.expiresAt) {
      if (!hit.data) throw new HttpError('not_found', 404);
      return json(hit.data);
    }

    let reqPromise = inFlight.get(key);
    if (!reqPromise) {
      reqPromise = (async () => {
        const fresh = await fetchServerChartSeries(market, code, range);
        if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
        const ttlMs = (fresh ? CACHE_MS : 60_000) + Math.floor(Math.random() * CACHE_JITTER_MS);
        cache.set(key, { expiresAt: Date.now() + ttlMs, data: fresh });
        return fresh;
      })();
      inFlight.set(key, reqPromise);
    }

    let result: AssetChartResponse | null;
    try {
      result = await reqPromise;
    } catch (e) {
      logEvent('error', 'asset_chart_failed', {
        market,
        code,
        range,
        requestId: ctx.requestId,
        error: e instanceof Error ? e.message : String(e),
      });
      throw new HttpError('provider_error', 502);
    } finally {
      if (inFlight.get(key) === reqPromise) inFlight.delete(key);
    }

    if (!result) throw new HttpError('not_found', 404);
    return json(result);
  },
  { service: 'asset-chart' },
);

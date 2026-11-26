/**
 * Pemilih kode aset: cari saham IDX/US untuk form tambah aset. Wajib login (bukan proxy terbuka), dibatasi per pengguna
 * supaya satu klien tidak membuat Yahoo memblokir IP server (yang juga dipakai sync harga), dan di-cache singkat
 * dengan TTL jitter serta singleflight per kunci untuk mencegah cache stampede.
 */
import { adminClient, requireUser } from '../_shared/auth.ts';
import { SymbolSearchRequest, type SymbolHit } from '../_shared/contracts.ts';
import { HttpError, json, readJson, serve } from '../_shared/http.ts';
import { logEvent } from '../_shared/logger.ts';
import { searchSymbols } from '../_shared/symbol-search.ts';

const CACHE_MS = 10 * 60_000;
const CACHE_JITTER_MS = 60_000;
const CACHE_MAX = 500;
const PER_MINUTE = 20;
const PER_DAY = 300;
const cache = new Map<string, { expiresAt: number; results: SymbolHit[] }>();
const inFlight = new Map<string, Promise<SymbolHit[]>>();
const calls = new Map<string, number[]>();

serve(
  async (req, ctx) => {
    const user = await requireUser(req);
    const parsed = SymbolSearchRequest.safeParse(await readJson(req));
    if (!parsed.success) throw new HttpError('bad_request', 400);
    const { market, q } = parsed.data;

    const now = Date.now();
    const { data: allowed, error: rateErr } = await adminClient().rpc('rate_limit_hit', {
      p_user: user.id,
      p_bucket: 'symbol_search',
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

    const key = `${market}:${q.toLowerCase()}`;
    const hit = cache.get(key);
    if (hit && now < hit.expiresAt) return json({ results: hit.results });

    let reqPromise = inFlight.get(key);
    if (!reqPromise) {
      reqPromise = (async () => {
        const fresh = await searchSymbols(market, q);
        if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
        const ttlMs = CACHE_MS + Math.floor(Math.random() * CACHE_JITTER_MS);
        cache.set(key, { expiresAt: Date.now() + ttlMs, results: fresh });
        return fresh;
      })();
      inFlight.set(key, reqPromise);
    }

    let results: SymbolHit[];
    try {
      results = await reqPromise;
    } catch (e) {
      logEvent('error', 'symbol_search_failed', {
        market,
        requestId: ctx.requestId,
        error: e instanceof Error ? e.message : String(e),
      });
      throw new HttpError('provider_error', 502);
    } finally {
      if (inFlight.get(key) === reqPromise) inFlight.delete(key);
    }
    return json({ results });
  },
  { service: 'symbol-search' },
);

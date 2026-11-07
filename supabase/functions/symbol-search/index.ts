/**
 * Pemilih kode aset: cari saham IDX/US untuk form tambah aset. Wajib login (bukan proxy terbuka), dibatasi per pengguna
 * supaya satu klien tidak membuat Yahoo memblokir IP server (yang juga dipakai sync harga), dan di-cache singkat.
 */
import { requireUser } from '../_shared/auth.ts';
import { SymbolSearchRequest, type SymbolHit } from '../_shared/contracts.ts';
import { HttpError, json, readJson, serve } from '../_shared/http.ts';
import { searchSymbols } from '../_shared/symbol-search.ts';

const CACHE_MS = 10 * 60_000;
const CACHE_MAX = 500;
const PER_MINUTE = 30;
// shortcut: cache dan batas laju hanya per instance function (memori), bukan global. Pindah ke tabel bila penyalahgunaan terlihat.
const cache = new Map<string, { at: number; results: SymbolHit[] }>();
const calls = new Map<string, number[]>();

serve(async (req) => {
  const user = await requireUser(req);
  const parsed = SymbolSearchRequest.safeParse(await readJson(req));
  if (!parsed.success) throw new HttpError('bad_request', 400);
  const { market, q } = parsed.data;

  const now = Date.now();
  const recent = (calls.get(user.id) ?? []).filter((t) => now - t < 60_000);
  if (recent.length >= PER_MINUTE) throw new HttpError('rate_limited', 429);
  calls.set(user.id, [...recent, now]);

  const key = `${market}:${q.toLowerCase()}`;
  const hit = cache.get(key);
  if (hit && now - hit.at < CACHE_MS) return json({ results: hit.results });

  let results: SymbolHit[];
  try {
    results = await searchSymbols(market, q);
  } catch (e) {
    console.error('symbol-search', e instanceof Error ? e.message : String(e));
    throw new HttpError('provider_error', 502);
  }
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
  cache.set(key, { at: now, results });
  return json({ results });
});

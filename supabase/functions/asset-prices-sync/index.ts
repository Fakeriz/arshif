/**
 * Sinkron harga aset live tiap jam (brief Fase Aset §5, Live Market v2 Fase 1). Dipanggil pg_cron (x-cron-secret) atau admin.
 * Penyedia per sumber: CoinGecko (kripto), Yahoo (saham US, IDX), gold-api (XAUUSD). TradingView (library tidak resmi,
 * risiko diterima pemilik 2026-11-06) hanya cadangan terakhir untuk kunci yang gagal di sumber utamanya.
 * Kode yang gagal tetap memakai harga terakhirnya; aplikasi jatuh ke harga beli / nilai manual bila belum pernah ada harga.
 */
import { chainProvider, historyRows, syncInBatches, type ProviderRun } from '../_shared/asset-sync.ts';
import { coinGeckoProvider } from '../_shared/price-coingecko.ts';
import { goldProvider } from '../_shared/price-gold.ts';
import { yahooIdxProvider, yahooUsProvider } from '../_shared/price-yahoo.ts';
import { tradingViewProvider } from '../_shared/tradingview.ts';
import { adminClient, requireUser } from '../_shared/auth.ts';
import { CRON_SECRET } from '../_shared/env.ts';
import { HttpError, json, serve } from '../_shared/http.ts';

/** Bandingkan tanpa bocor waktu (sama dengan fx-sync). */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Sumber utama per pasar. Ganti di sini untuk berpindah sumber harga (kunci netral tidak berubah). */
const PRIMARIES = [coinGeckoProvider, yahooUsProvider, yahooIdxProvider, goldProvider];

serve(async (req) => {
  const db = adminClient();
  let trigger: 'cron' | 'admin' = 'cron';
  if (!safeEqual(req.headers.get('x-cron-secret') ?? '', CRON_SECRET())) {
    const user = await requireUser(req);
    const { data: isAdmin } = await db.from('admin_users').select('user_id').eq('user_id', user.id).maybeSingle();
    if (!isAdmin) throw new HttpError('forbidden', 403);
    trigger = 'admin';
  }
  const log = (run: { ok: boolean; source: string; symbols?: number; updated?: number; failed?: string[]; error?: string; duration_ms?: number }) =>
    db.from('asset_price_runs').insert({ trigger, ...run }).then(({ error }) => error && console.error('asset log gagal', error.message));
  /** Satu baris per penyedia supaya kegagalan satu sumber terlihat terpisah. */
  const logRuns = (runs: ProviderRun[]) =>
    Promise.all(
      runs.map((r) =>
        log({
          ok: !r.error && r.failed.length === 0,
          source: r.source,
          symbols: r.symbols,
          updated: r.updated,
          failed: r.failed.slice(0, 200),
          error: r.error,
          duration_ms: r.durationMs,
        }),
      ),
    );

  // Satu array dari database: SELECT biasa terpotong di max_rows (1000) dan kunci setelahnya tidak pernah diperbarui.
  const { data: keyList, error: keyError } = await db.rpc('asset_price_keys');
  if (keyError) throw new HttpError('server', 500);
  const keys = (keyList as string[] | null) ?? [];

  const runs: ProviderRun[] = [];
  const provider = chainProvider(PRIMARIES, tradingViewProvider, runs);
  const started = Date.now();
  let result;
  try {
    result = await syncInBatches(keys, provider, new Date(), async (rows) => {
      const { error } = await db.from('asset_prices').upsert(rows);
      if (error) throw new Error(`asset_prices_${error.code}`);
      // Riwayat harian (Fase 5, penggerak Weekly Replay): satu baris per kode per hari UTC, harga terakhir menimpa.
      // Gagal di sini tidak menggagalkan sync harga; Replay hanya kehilangan satu titik.
      const { error: histError } = await db.from('asset_price_history').upsert(historyRows(rows));
      if (histError) console.error('asset_price_history', histError.code);
    });
  } catch (e) {
    await logRuns(runs);
    await log({ ok: false, source: 'save', symbols: keys.length, error: e instanceof Error ? e.message : String(e), duration_ms: Date.now() - started });
    throw new HttpError('server', 500);
  }
  if (runs.length === 0) await log({ ok: true, source: 'none', symbols: 0, duration_ms: Date.now() - started });
  else await logRuns(runs);
  return json({
    symbols: keys.length,
    updated: result.updated,
    failed: result.failed,
    providers: runs.map((r) => ({ source: r.source, symbols: r.symbols, updated: r.updated, error: r.error ?? null, ms: r.durationMs })),
  });
});

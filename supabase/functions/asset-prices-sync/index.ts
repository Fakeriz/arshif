/**
 * Sinkron harga aset live tiap jam (brief Fase Aset §5). Dipanggil pg_cron (x-cron-secret) atau admin.
 * Penyedia: TradingView (disetujui pemilik 2026-11-06, risiko ketentuan diterima). Kode yang gagal tetap memakai
 * harga terakhirnya; aplikasi jatuh ke harga beli / nilai manual bila belum pernah ada harga.
 */
import { syncInBatches, type PriceProvider } from '../_shared/asset-sync.ts';
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

/** Penyedia yang aktif. Ganti di sini untuk berpindah sumber harga (kunci netral tidak berubah). */
function resolveProvider(): PriceProvider | null {
  return tradingViewProvider;
}

serve(async (req) => {
  const db = adminClient();
  let trigger: 'cron' | 'admin' = 'cron';
  if (!safeEqual(req.headers.get('x-cron-secret') ?? '', CRON_SECRET())) {
    const user = await requireUser(req);
    const { data: isAdmin } = await db.from('admin_users').select('user_id').eq('user_id', user.id).maybeSingle();
    if (!isAdmin) throw new HttpError('forbidden', 403);
    trigger = 'admin';
  }
  const log = (run: { ok: boolean; source: string; symbols?: number; updated?: number; failed?: string[]; error?: string }) =>
    db.from('asset_price_runs').insert({ trigger, ...run }).then(({ error }) => error && console.error('asset log gagal', error.message));

  // Satu array dari database: SELECT biasa terpotong di max_rows (1000) dan kunci setelahnya tidak pernah diperbarui.
  const { data: keyList, error: keyError } = await db.rpc('asset_price_keys');
  if (keyError) throw new HttpError('server', 500);
  const keys = (keyList as string[] | null) ?? [];

  const provider = resolveProvider();
  if (!provider) {
    await log({ ok: false, source: 'none', symbols: keys.length, error: 'no_provider' });
    return json({ error: 'no_provider', symbols: keys.length }, 503);
  }

  let result;
  try {
    result = await syncInBatches(keys, provider, new Date(), async (rows) => {
      const { error } = await db.from('asset_prices').upsert(rows);
      if (error) throw new Error(`asset_prices_${error.code}`);
    });
  } catch (e) {
    await log({ ok: false, source: provider.name, symbols: keys.length, error: e instanceof Error ? e.message : String(e) });
    throw new HttpError('server', 500);
  }
  await log({
    ok: !result.error && result.failed.length === 0,
    source: provider.name,
    symbols: keys.length,
    updated: result.updated,
    failed: result.failed.slice(0, 200),
    error: result.error,
  });
  return json({ symbols: keys.length, updated: result.updated, failed: result.failed });
});

/**
 * Sinkron harga aset live tiap jam (brief Fase Aset §5). Dipanggil pg_cron (x-cron-secret) atau admin.
 * Penyedia harga belum dipasang: sumber TradingView menunggu keputusan pemilik soal ketentuan penggunaannya.
 * Tanpa penyedia, setiap percobaan dicatat gagal (`no_provider`) dan aplikasi memakai harga beli / nilai manual.
 */
import { runPriceSync, type PriceProvider } from '../_shared/asset-sync.ts';
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

/** Penyedia yang aktif. null sampai sumber harga disetujui pemilik. */
function resolveProvider(): PriceProvider | null {
  return null;
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

  const { data: keyRows, error: keyError } = await db.from('assets').select('price_key').not('price_key', 'is', null).limit(50_000);
  if (keyError) throw new HttpError('server', 500);
  const keys = [...new Set((keyRows ?? []).map((r: { price_key: string }) => r.price_key))];

  const provider = resolveProvider();
  if (!provider) {
    await log({ ok: false, source: 'none', symbols: keys.length, error: 'no_provider' });
    return json({ error: 'no_provider', symbols: keys.length }, 503);
  }

  const result = await runPriceSync(keys, provider, new Date());
  if (result.rows.length > 0) {
    const { error } = await db.from('asset_prices').upsert(result.rows);
    if (error) {
      await log({ ok: false, source: provider.name, symbols: keys.length, error: `asset_prices_${error.code}` });
      throw new HttpError('server', 500);
    }
  }
  await log({
    ok: !result.error && result.failed.length === 0,
    source: provider.name,
    symbols: keys.length,
    updated: result.rows.length,
    failed: result.failed.slice(0, 200),
    error: result.error,
  });
  return json({ symbols: keys.length, updated: result.rows.length, failed: result.failed });
});

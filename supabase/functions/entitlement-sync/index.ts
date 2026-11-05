/**
 * Cocokkan paket dengan RevenueCat.
 *  - Klien (token pengguna): setelah beli/pulihkan di aplikasi atau di halaman status pesanan. Hanya dirinya.
 *  - Cron (x-cron-secret): Premium yang sudah lewat masa aktif, dan pesanan lunas yang grant-nya gagal.
 */
import { adminClient, requireUser } from '../_shared/auth.ts';
import { safeEqual } from '../_shared/billing.ts';
import { configured, CRON_SECRET } from '../_shared/env.ts';
import { grantOrder, syncPlan, type OrderRow } from '../_shared/entitlement.ts';
import { json, serve } from '../_shared/http.ts';

const SYNC_LIMIT_PER_MINUTE = 6;
const lastCalls = new Map<string, number[]>();

serve(async (req) => {
  const db = adminClient();
  const cron = req.headers.get('x-cron-secret');
  if (cron && safeEqual(cron, CRON_SECRET())) {
    if (!configured('RC_SECRET_KEY', 'RC_PROJECT_ID', 'RC_ENTITLEMENT_ID')) return json({ ok: true, skipped: 'not_configured' });
    const { data: expired } = await db.from('profiles').select('id').eq('plan', 'premium').lt('premium_until', new Date().toISOString()).limit(200);
    for (const p of expired ?? []) await syncPlan(db, p.id).catch((e) => console.error('sync_failed', p.id, String(e)));
    const { data: stuck } = await db
      .from('orders')
      .select('id, user_id, provider, period, status, days, granted_until, grant_error')
      .eq('status', 'paid')
      .not('grant_error', 'is', null)
      // Penanda untuk admin (refund sebagian) bukan grant yang gagal; jangan ditimpa percobaan ulang.
      .neq('grant_error', 'partial_refund')
      .limit(100);
    for (const o of stuck ?? []) await grantOrder(db, o as OrderRow);
    return json({ ok: true, expired: expired?.length ?? 0, retried: stuck?.length ?? 0 });
  }

  const user = await requireUser(req);
  // Batas sederhana per instance: tombol Pulihkan tidak bisa membanjiri API RevenueCat.
  const now = Date.now();
  const recent = (lastCalls.get(user.id) ?? []).filter((t) => now - t < 60_000);
  if (recent.length >= SYNC_LIMIT_PER_MINUTE) return json({ error: 'rate_limited' }, 429);
  lastCalls.set(user.id, [...recent, now]);
  // Kunci RevenueCat belum diset: kembalikan cermin yang tersimpan, jangan error.
  if (!configured('RC_SECRET_KEY', 'RC_PROJECT_ID', 'RC_ENTITLEMENT_ID')) {
    const { data } = await db.from('profiles').select('plan, premium_until').eq('id', user.id).single();
    return json({ plan: data?.plan ?? 'free', premiumUntil: data?.premium_until ?? null });
  }
  return json(await syncPlan(db, user.id));
});

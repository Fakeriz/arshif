/**
 * Cocokkan paket dengan RevenueCat (atau dengan pesanan lunas selama kunci RevenueCat belum diisi).
 *  - Klien (token pengguna): setelah beli/pulihkan di aplikasi atau di halaman status pesanan. Hanya dirinya.
 *  - Cron (x-cron-secret): Premium yang sudah lewat masa aktif, dan pesanan lunas yang grant-nya gagal.
 */
import { adminClient, requireUser } from '../_shared/auth.ts';
import { safeEqual } from '../_shared/billing.ts';
import { configured, CRON_SECRET } from '../_shared/env.ts';
import { grantOrder, syncPlan, type OrderRow } from '../_shared/entitlement.ts';
import { HttpError, json, serve } from '../_shared/http.ts';
import { logEvent } from '../_shared/logger.ts';

const SYNC_LIMIT_PER_MINUTE = 6;
const lastCalls = new Map<string, number[]>();

serve(
  async (req, ctx) => {
    const db = adminClient();
    const cron = req.headers.get('x-cron-secret');
    if (cron !== null) {
      if (!configured('CRON_SECRET')) throw new HttpError('not_configured', 503);
      if (!safeEqual(cron, CRON_SECRET())) throw new HttpError('unauthorized', 401);
      // Tanpa kunci RevenueCat tetap jalan: masa aktif grant manual dihitung dari tabel orders (lihat entitlement.ts).
      const { data: expired } = await db
        .from('profiles')
        .select('id')
        .eq('plan', 'premium')
        .lt('premium_until', new Date().toISOString())
        .order('premium_until', { ascending: true })
        .limit(200);
      for (const p of expired ?? []) {
        await syncPlan(db, p.id).catch((e) =>
          logEvent('error', 'entitlement_sync_expired_failed', { userId: p.id, requestId: ctx.requestId, error: String(e) }),
        );
      }
      const { data: stuck } = await db
        .from('orders')
        .select('id, user_id, provider, period, status, days, granted_until, grant_error')
        .eq('status', 'paid')
        .not('grant_error', 'is', null)
        // Penanda untuk admin (refund sebagian) bukan grant yang gagal; jangan ditimpa percobaan ulang.
        .neq('grant_error', 'partial_refund')
        // Pesanan milik akun yang sudah dihapus tidak bisa diberi grant; jangan dicoba ulang tiap jam.
        .not('user_id', 'is', null)
        .order('created_at', { ascending: true })
        .limit(100);
      for (const o of stuck ?? []) await grantOrder(db, o as OrderRow);
      return json({ ok: true, expired: expired?.length ?? 0, retried: stuck?.length ?? 0 });
    }

    const user = await requireUser(req);
    const { data: allowed, error: rateErr } = await db.rpc('rate_limit_hit', {
      p_user: user.id,
      p_bucket: 'entitlement_sync',
      p_per_min: SYNC_LIMIT_PER_MINUTE,
      p_per_day: 60,
    });
    if (rateErr) {
      const now = Date.now();
      if (lastCalls.size > 5000) lastCalls.clear();
      const recent = (lastCalls.get(user.id) ?? []).filter((t) => now - t < 60_000);
      if (recent.length >= SYNC_LIMIT_PER_MINUTE) throw new HttpError('rate_limited', 429, { retryAfterSec: 60 });
      lastCalls.set(user.id, [...recent, now]);
    } else if (!allowed) {
      throw new HttpError('rate_limited', 429, { retryAfterSec: 60 });
    }
    // Kunci RevenueCat belum diset: kembalikan cermin yang tersimpan, jangan error.
    if (!configured('RC_SECRET_KEY', 'RC_PROJECT_ID', 'RC_ENTITLEMENT_ID')) {
      const { data } = await db.from('profiles').select('plan, premium_until').eq('id', user.id).single();
      return json({ plan: data?.plan ?? 'free', premiumUntil: data?.premium_until ?? null });
    }
    return json(await syncPlan(db, user.id));
  },
  { service: 'entitlement-sync' },
);

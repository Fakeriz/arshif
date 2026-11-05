/**
 * Webhook RevenueCat (in-app iOS/Android). RevenueCat = sumber kebenaran: isi event hanya dipakai untuk
 * tahu SIAPA yang berubah; status diambil ulang dari REST API (syncPlan), jadi urutan event tidak penting.
 * Verifikasi: header Authorization = nilai yang diisi di dashboard. Idempoten lewat event.id.
 */
import { adminClient } from '../_shared/auth.ts';
import { revenueCatUserIds, verifyStaticToken } from '../_shared/billing.ts';
import { RC_WEBHOOK_AUTH } from '../_shared/env.ts';
import { claimEvent, releaseEvent, syncPlan } from '../_shared/entitlement.ts';
import { HttpError, json, readJson, serve } from '../_shared/http.ts';

const NOTIFY_ON = new Set(['INITIAL_PURCHASE', 'NON_RENEWING_PURCHASE', 'UNCANCELLATION']);

serve(async (req) => {
  if (!verifyStaticToken(req.headers.get('authorization'), RC_WEBHOOK_AUTH())) throw new HttpError('unauthorized', 401);
  const body = (await readJson(req)) as { event?: Record<string, unknown> };
  const event = body.event;
  if (!event || typeof event.id !== 'string') throw new HttpError('bad_request', 400);
  const db = adminClient();
  if (!(await claimEvent(db, 'revenuecat', event.id))) return json({ ok: true, duplicate: true });

  try {
    for (const userId of revenueCatUserIds(event)) {
      const { data: exists } = await db.from('profiles').select('id, plan').eq('id', userId).maybeSingle();
      if (!exists) continue;
      const { plan, premiumUntil } = await syncPlan(db, userId);
      if (plan === 'premium' && exists.plan !== 'premium' && NOTIFY_ON.has(String(event.type))) {
        await db.from('notifications').insert({
          user_id: userId,
          type: 'system',
          title_key: 'domain.notif.premiumTitle',
          message_key: premiumUntil ? 'domain.notif.premiumMessage' : 'domain.notif.premiumMessageStore',
          vars: { until: premiumUntil },
          href: '/premium',
        });
      }
    }
    return json({ ok: true });
  } catch (e) {
    await releaseEvent(db, 'revenuecat', event.id);
    throw e;
  }
});

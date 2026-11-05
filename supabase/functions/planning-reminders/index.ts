/**
 * Pengingat Planning (FR-BILL-4, FR-SUB-2): tagihan H-3 dan hari H, langganan H-2, ke pusat notifikasi.
 * Dipanggil pg_cron tiap jam (x-cron-secret). Logika di SQL public.planning_reminders: jam 07.00 lokal tiap
 * pengguna, satu kali per pengingat (dedupe_key).
 */
import { adminClient } from '../_shared/auth.ts';
import { safeEqual } from '../_shared/billing.ts';
import { CRON_SECRET } from '../_shared/env.ts';
import { HttpError, json, serve } from '../_shared/http.ts';

serve(async (req) => {
  const secret = req.headers.get('x-cron-secret');
  if (!secret || !safeEqual(secret, CRON_SECRET())) throw new HttpError('unauthorized', 401);
  const { data, error } = await adminClient().rpc('planning_reminders');
  if (error) throw new Error(`planning_reminders_${error.code}`);
  return json({ ok: true, created: data as number });
});

/**
 * Pengingat Planning (FR-BILL-4, FR-SUB-2): tagihan H-3 dan hari H, langganan H-2, ke pusat notifikasi.
 * Dipanggil pg_cron tiap jam (x-cron-secret). Logika di SQL public.planning_reminders: jam 07.00 lokal tiap
 * pengguna, satu kali per pengingat (dedupe_key).
 * Live Market v2 Fase 5: cron yang sama juga memeriksa alert harga aset (public.price_alerts), tanpa cron baru.
 */
import { adminClient } from '../_shared/auth.ts';
import { safeEqual } from '../_shared/billing.ts';
import { CRON_SECRET } from '../_shared/env.ts';
import { HttpError, json, serve } from '../_shared/http.ts';

serve(async (req) => {
  const secret = req.headers.get('x-cron-secret');
  if (!secret || !safeEqual(secret, CRON_SECRET())) throw new HttpError('unauthorized', 401);
  const db = adminClient();
  const { data, error } = await db.rpc('planning_reminders');
  if (error) throw new Error(`planning_reminders_${error.code}`);
  // Alert harga terpisah: kegagalannya tidak boleh menghapus hasil pengingat tagihan yang sudah tercatat.
  const { data: alerts, error: alertError } = await db.rpc('price_alerts');
  if (alertError) console.error('price_alerts', alertError.code);
  return json({ ok: true, created: data as number, priceAlerts: alertError ? null : (alerts as number) });
});

import type { SupabaseClient } from '@supabase/supabase-js';

import { nextStatus, type BillingPeriod, type OrderStatus } from './billing.ts';
import { configured } from './env.ts';
import * as rc from './revenuecat.ts';

export type OrderRow = {
  id: string;
  user_id: string;
  provider: 'xendit' | 'paddle' | 'manual';
  period: BillingPeriod;
  status: OrderStatus;
  days: number | null;
  granted_until: string | null;
  grant_error: string | null;
};

const ORDER_COLUMNS = 'id, user_id, provider, period, status, days, granted_until, grant_error';
const THREE_HOURS = 3 * 3600_000;

/**
 * Tanpa kunci RevenueCat, sumber kebenaran Premium = pesanan lunas di tabel orders (grant manual admin).
 * Begitu kunci diisi, grant berikutnya lewat RevenueCat dan pesanan lama tetap tercatat untuk audit.
 */
export const revenueCatReady = (): boolean => configured('RC_SECRET_KEY', 'RC_PROJECT_ID', 'RC_ENTITLEMENT_ID');

async function localPremiumUntil(db: SupabaseClient, userId: string): Promise<number | null> {
  const { data, error } = await db
    .from('orders')
    .select('granted_until')
    .eq('user_id', userId)
    .eq('status', 'paid')
    .gt('granted_until', new Date().toISOString())
    .order('granted_until', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`order_read_${error.code}`);
  return data ? Date.parse(data.granted_until) : null;
}

const premiumUntil = (db: SupabaseClient, userId: string) => (revenueCatReady() ? rc.premiumUntil(userId) : localPremiumUntil(db, userId));
const grantPremium = (userId: string, untilMs: number) => (revenueCatReady() ? rc.grantPremium(userId, untilMs) : Promise.resolve());
const revokeGrants = (userId: string) => (revenueCatReady() ? rc.revokeGrants(userId) : Promise.resolve());

/**
 * Cermin paket di profil = entitlement aktif di RevenueCat. Dipanggil setelah grant/revoke, dari webhook
 * RevenueCat, setelah beli/pulihkan di aplikasi, dan oleh cron untuk Premium yang sudah lewat masa aktif.
 */
export async function syncPlan(db: SupabaseClient, userId: string): Promise<{ plan: 'free' | 'premium'; premiumUntil: string | null }> {
  const until = await premiumUntil(db, userId);
  const plan = until ? 'premium' : 'free';
  const premiumUntilIso = until && Number.isFinite(until) ? new Date(until).toISOString() : null;

  let source: 'store' | 'web' | 'manual' | null = null;
  if (until) {
    // Grant web/manual tercatat di orders; akhir masa yang cocok berarti Premium ini berasal dari sana.
    const { data } = await db
      .from('orders')
      .select('provider, granted_until')
      .eq('user_id', userId)
      .eq('status', 'paid')
      .not('granted_until', 'is', null)
      .order('granted_until', { ascending: false })
      .limit(1)
      .maybeSingle();
    const match = data && Number.isFinite(until) && Math.abs(Date.parse(data.granted_until) - until) < THREE_HOURS;
    source = match ? (data.provider === 'manual' ? 'manual' : 'web') : 'store';
  }

  const { error } = await db.from('profiles').update({ plan, premium_until: premiumUntilIso, premium_source: source }).eq('id', userId);
  if (error) throw new Error(`profile_update_${error.code}`);
  return { plan, premiumUntil: premiumUntilIso };
}

/**
 * Ubah status pesanan hanya bila transisinya sah (nextStatus) dan statusnya belum diubah proses lain:
 * update bersyarat pada status lama = kunci optimistik terhadap webhook ganda yang datang bersamaan.
 */
export async function transitionOrder(db: SupabaseClient, orderId: string, incoming: OrderStatus, patch: Record<string, unknown> = {}): Promise<OrderRow | null> {
  const { data: order, error: readError } = await db.from('orders').select(ORDER_COLUMNS).eq('id', orderId).maybeSingle<OrderRow>();
  // Error DB dilempar: webhook menjawab 500, klaim event dilepas, penyedia mengirim ulang.
  if (readError) throw new Error(`order_read_${readError.code}`);
  if (!order) return null;
  const next = nextStatus(order.status, incoming);
  if (!next) return null;
  const now = new Date().toISOString();
  const { data, error } = await db
    .from('orders')
    // Lunas langsung ditandai grant 'pending': bila proses mati sebelum grant selesai, cron mengambilnya.
    .update({ status: next, updated_at: now, ...(next === 'paid' ? { paid_at: now, grant_error: 'pending' } : {}), ...patch })
    .eq('id', orderId)
    .eq('status', order.status)
    .select(ORDER_COLUMNS)
    .maybeSingle<OrderRow>();
  if (error) throw new Error(`order_update_${error.code}`);
  return data ?? null;
}

/**
 * Pesanan lunas -> grant Premium di RevenueCat sesuai durasi, cermin ke profil, notifikasi in-app.
 * Masa aktif ditetapkan atomik di SQL (reserve_grant, lock per pengguna) SEBELUM memanggil RevenueCat, jadi
 * percobaan ulang memakai target yang sama dan dua pembayaran bersamaan bertumpuk. Gagal = grant_error terisi,
 * webhook tetap dijawab 200, cron entitlement-sync mencoba ulang.
 */
export async function grantOrder(db: SupabaseClient, order: OrderRow): Promise<string | null> {
  try {
    const current = await premiumUntil(db, order.user_id);
    if (current === Infinity) {
      // Sudah Premium tanpa tanggal akhir: tidak ada yang perlu diperpanjang.
      await db.from('orders').update({ grant_error: null, updated_at: new Date().toISOString() }).eq('id', order.id);
      await syncPlan(db, order.user_id);
      return null;
    }
    const { data: reserved, error } = await db.rpc('reserve_grant', { p_order: order.id, p_current: current ? new Date(current).toISOString() : null });
    const target = (reserved as { granted_until: string }[] | null)?.[0]?.granted_until;
    if (error || !target) throw new Error(`reserve_grant_${error?.code ?? 'empty'}`);
    await grantPremium(order.user_id, Date.parse(target));
    const { error: doneError } = await db.from('orders').update({ grant_error: null, updated_at: new Date().toISOString() }).eq('id', order.id);
    if (doneError) throw new Error(`order_update_${doneError.code}`);
    const { premiumUntil: until } = await syncPlan(db, order.user_id);
    await db.from('notifications').insert({
      user_id: order.user_id,
      type: 'system',
      title_key: 'domain.notif.premiumTitle',
      message_key: 'domain.notif.premiumMessage',
      vars: { until: until ?? target },
      href: '/premium',
    });
    return until ?? target;
  } catch (e) {
    const message = (e instanceof Error ? e.message : String(e)).slice(0, 200);
    await db.from('orders').update({ grant_error: message, updated_at: new Date().toISOString() }).eq('id', order.id);
    console.error('grant_failed', order.id, message);
    return null;
  }
}

/**
 * Refund/chargeback web. Status diubah dulu (bila belum), lalu pencabutan SELALU dijalankan untuk pesanan yang
 * berstatus refunded: pengiriman ulang webhook setelah RevenueCat gagal tetap menyelesaikan pencabutan.
 * refund_shift menggeser pesanan yang bertumpuk setelahnya sebesar durasi pesanan ini (sekali saja), lalu
 * grant promosi dicabut dan diberikan ulang sampai akhir masa yang tersisa. Langganan store tidak tersentuh.
 */
export async function refundOrder(db: SupabaseClient, orderId: string): Promise<void> {
  await transitionOrder(db, orderId, 'refunded');
  const { data: order, error } = await db.from('orders').select('user_id, status').eq('id', orderId).maybeSingle();
  if (error) throw new Error(`order_read_${error.code}`);
  if (!order || order.status !== 'refunded') return;
  const { data: end, error: shiftError } = await db.rpc('refund_shift', { p_order: orderId });
  if (shiftError) throw new Error(`refund_shift_${shiftError.code}`);
  await revokeGrants(order.user_id);
  if (end) await grantPremium(order.user_id, Date.parse(end as string));
  await syncPlan(db, order.user_id);
}

/** Catat event webhook sekali. false = sudah pernah diproses (balas 200 tanpa memproses ulang). */
export async function claimEvent(db: SupabaseClient, provider: 'revenuecat' | 'xendit' | 'paddle', eventId: string): Promise<boolean> {
  const { data, error } = await db.from('webhook_events').upsert({ provider, event_id: eventId.slice(0, 200) }, { onConflict: 'provider,event_id', ignoreDuplicates: true }).select('event_id');
  if (error) throw new Error(`webhook_events_${error.code}`);
  return (data?.length ?? 0) > 0;
}

/** Proses gagal: lepas klaim supaya pengiriman ulang dari penyedia bisa diproses. */
export async function releaseEvent(db: SupabaseClient, provider: 'revenuecat' | 'xendit' | 'paddle', eventId: string): Promise<void> {
  await db.from('webhook_events').delete().eq('provider', provider).eq('event_id', eventId.slice(0, 200));
}

import type { SupabaseClient } from '@supabase/supabase-js';

import { grantOrder, type OrderRow } from './entitlement.ts';
import { HttpError } from './http.ts';

/**
 * Grant Premium manual oleh admin: pesanan 'manual' lunas lalu jalur grant yang sama dengan pembayaran web.
 * Aktivasi yang gagal (mis. RevenueCat 5xx sesaat) BUKAN error: pesanan sudah tersimpan dengan grant_error dan
 * cron entitlement-sync mencoba ulang tiap jam. Dulu dijawab 502, admin mengklik lagi, dan pesanan kedua
 * menggandakan hari Premium. `queued: true` = jangan klik lagi, tunggu percobaan ulang otomatis.
 */
export async function adminGrant(db: SupabaseClient, adminId: string, userId: string, days: number): Promise<{ queued: boolean }> {
  const { data: order, error } = await db
    .from('orders')
    .insert({ user_id: userId, provider: 'manual', period: 'custom', currency: 'USD', amount: 0, status: 'paid', paid_at: new Date().toISOString(), days, granted_by: adminId })
    .select('id, user_id, provider, period, status, days, granted_until, grant_error')
    .single();
  if (error || !order) throw new HttpError('server', 500);
  if (await grantOrder(db, order as OrderRow)) return { queued: false };
  // null juga berarti "sudah Premium tanpa batas" (tidak ada yang perlu diperpanjang): bedakan lewat grant_error.
  const { data: after } = await db.from('orders').select('grant_error').eq('id', order.id).maybeSingle();
  return { queued: !!after?.grant_error };
}

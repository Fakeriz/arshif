// Klien pemakaian fitur bulanan (feature_usage_log). SATU sumber di sisi
// client: cek + konsumsi lewat RPC Supabase, mengikuti lib/plan-limits.js.
// Guest / mode lokal tidak dilacak: RPC menuntut auth.uid(), dan limit free
// bulanan baru bermakna saat data tersinkron ke cloud.
import { getSupabase } from './supabase'

export const FEATURE_USAGE_ERRORS = {
  LIMIT_REACHED: 'PLAN_LIMIT_REACHED',
  UNAVAILABLE: 'PLAN_LIMIT_UNAVAILABLE',
}

// Konsumsi 1 pemakaian. Return { allowed: true, used, limit } saat lolos;
// { allowed: false, reason } saat diblokir atau RPC gagal.
// Gagal jaringan/RPC TIDAK memblokir aksi di sisi client (fail-open lokal):
// server-side consume_feature_usage di SQL yang jadi pengikat sebenarnya.
export async function consumeFeatureUsage(resource) {
  const supabase = getSupabase()
  const { data: userData } = await supabase.auth.getUser()
  const uid = userData?.user?.id
  if (!uid) return { allowed: true, skipped: 'guest' }

  const { data, error } = await supabase.rpc('consume_feature_usage', { p_resource: resource })
  if (!error && data) return { allowed: data.allowed !== false, used: data.used, limit: data.limit }

  // P0001 = batas habis ATAU resource tak dikenal (fail-closed server).
  const msg = error?.message || ''
  if (error?.code === 'P0001' || /Batas |Resource tidak dikenal/.test(msg)) {
    return { allowed: false, error: msg }
  }
  // Migrasi belum jalan / tabel belum ada: jangan blokir pengguna karena
  // kesalahan infrastruktur (kode 42P01 = relation does not exist).
  if (error?.code === '42P01' || /relation .* does not exist|schema cache/i.test(msg)) {
    return { allowed: true, skipped: 'migration-missing' }
  }
  return { allowed: true, skipped: 'rpc-unavailable', error: msg }
}

// Baca pemakaian bulan berjalan tanpa mengkonsumsi (untuk badge/paywall).
export async function getFeatureUsage(resource) {
  const supabase = getSupabase()
  const { data: userData } = await supabase.auth.getUser()
  const uid = userData?.user?.id
  if (!uid) return { used: 0, period: null, error: 'guest' }
  const { data, error } = await supabase.rpc('get_feature_usage', { p_uid: uid, p_resource: resource })
  if (error) return { used: 0, period: null, error: error.message }
  return data || { used: 0, period: null }
}

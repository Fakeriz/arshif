// Event adopsi draft coach. Hanya untuk user login: tabel mensyaratkan
// auth.uid() = user_id; guest tidak dilacak. Gagal kirim tidak pernah
// memblokir alur user (fail-silent), event sifatnya statistik.
import { getSupabase } from './supabase'

export const COACH_EVENTS = {
  SHOWN: 'draft_shown',
  SAVED_NOW: 'saved_now',
  FORM_OPENED: 'form_opened',
}

export async function logCoachEvent(eventType, { draftKey, txType = null, amount = null } = {}) {
  try {
    if (!eventType || !draftKey) return false
    const supabase = getSupabase()
    const { data: userData } = await supabase.auth.getUser()
    const uid = userData?.user?.id
    if (!uid) return false
    const { error } = await supabase.from('coach_draft_events').insert({
      user_id: uid,
      event_type: eventType,
      draft_key: String(draftKey),
      tx_type: txType,
      amount: amount == null ? null : Number(amount),
    })
    return !error
  } catch {
    return false
  }
}

import { createClient } from '@supabase/supabase-js'

// Direct hardcoded fallback credentials (as requested) with env override
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://rhgfyzqzcyoprtnyikhx.supabase.co'
export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_gggCxqbF1fPHM92bAvDhSg_8fG8rL32'

let _client = null
export function getSupabase() {
  if (_client) return _client
  _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  })
  return _client
}

export const supabase = getSupabase()

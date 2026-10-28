import { createClient } from '@supabase/supabase-js'

const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const configuredAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!configuredUrl || !configuredAnonKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
}

export const SUPABASE_URL = configuredUrl
export const SUPABASE_ANON_KEY = configuredAnonKey

let _client = null
export function getSupabase() {
  if (_client) return _client
  _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  })
  return _client
}

export const supabase = getSupabase()

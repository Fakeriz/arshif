// lib/api-auth.js
// Helper auth Supabase sisi server, SATU sumber untuk semua API route.
// verifikasi user selalu via auth.getUser(token) server-side,
// token dari header Authorization Bearer; tidak ada path bypass lain.

import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabase'

export function readBearerToken(request) {
  return (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
}

export function getServerSupabase(token) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: token ? { headers: { Authorization: `Bearer ${token}` } } : {},
  })
}

// Return { user, sb } kalau token valid, null kalau tidak.
// `request` = NextRequest/Request dari route handler.
export async function getUser(request) {
  const token = readBearerToken(request)
  if (!token) return null
  try {
    const sb = getServerSupabase(token)
    const { data, error } = await sb.auth.getUser(token)
    if (error || !data?.user) return null
    return { user: data.user, sb }
  } catch {
    return null
  }
}

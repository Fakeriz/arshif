// app/api/push/subscribe/route.js
// Menyimpan / menghapus web push subscription per user.
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const json = (data, status = 200) => NextResponse.json(data, { status })

function getServerSupabase(token) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: token ? { headers: { Authorization: `Bearer ${token}` } } : {},
  })
}

async function getUser(request) {
  const authHeader = request.headers.get('authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!token) return null
  const sb = getServerSupabase(token)
  const { data, error } = await sb.auth.getUser(token)
  if (error || !data?.user) return null
  return { user: data.user, sb }
}

// POST: simpan subscription
export async function POST(request) {
  const auth = await getUser(request)
  if (!auth) return json({ error: 'Unauthorized' }, 401)
  const { user, sb } = auth

  let body
  try { body = await request.json() } catch { return json({ error: 'Body tidak valid' }, 400) }
  const { endpoint, keys, userAgent } = body || {}
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return json({ error: 'Subscription tidak lengkap' }, 400)
  }

  const { error } = await sb.from('push_subscriptions').upsert(
    {
      user_id: user.id,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      user_agent: userAgent || null,
    },
    { onConflict: 'user_id,endpoint' }
  )
  if (error) return json({ error: 'Gagal menyimpan: ' + error.message }, 500)

  // Pastikan settings ada (default: push mati sampai user aktifkan)
  await sb.from('notification_settings').upsert(
    { user_id: user.id },
    { onConflict: 'user_id', ignoreDuplicates: true }
  )

  return json({ ok: true })
}

// DELETE: hapus subscription (berdasarkan endpoint)
export async function DELETE(request) {
  const auth = await getUser(request)
  if (!auth) return json({ error: 'Unauthorized' }, 401)
  const { user, sb } = auth

  let body
  try { body = await request.json() } catch { body = {} }
  const { endpoint } = body || {}
  if (!endpoint) return json({ error: 'Endpoint wajib' }, 400)

  const { error } = await sb
    .from('push_subscriptions')
    .delete()
    .eq('user_id', user.id)
    .eq('endpoint', endpoint)
  if (error) return json({ error: 'Gagal menghapus: ' + error.message }, 500)
  return json({ ok: true })
}

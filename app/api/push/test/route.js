// app/api/push/test/route.js
// Kirim notifikasi test ke device user yang sedang login.
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabase'
import {
  initWebPush,
  isExpiredOrInvalidSubscription,
  formatPushError,
} from '@/lib/push-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const json = (data, status = 200) => NextResponse.json(data, { status })

function getServerSupabase(token) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: token ? { headers: { Authorization: `Bearer ${token}` } } : {},
  })
}

export async function POST(request) {
  const authHeader = request.headers.get('authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!token) return json({ error: 'Unauthorized' }, 401)

  const sb = getServerSupabase(token)
  const { data: authData, error: authError } = await sb.auth.getUser(token)
  const user = authData?.user
  if (authError || !user) return json({ error: 'Unauthorized' }, 401)

  try {
    initWebPush(user.email)
  } catch (err) {
    return json({ error: err.message, sent: 0, failed: 0 }, 500)
  }

  const { data: subs } = await sb
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', user.id)

  if (!subs?.length) {
    return json({ error: 'Belum ada device terdaftar. Aktifkan push dulu.' }, 400)
  }

  const payload = JSON.stringify({
    title: 'Arshif',
    body: 'Notifikasi test berhasil! Push notification sudah aktif di perangkat ini.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { action: 'notifications', type: 'test' },
  })

  let ok = 0
  let failed = 0
  let lastError = null
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      )
      ok++
    } catch (e) {
      failed++
      lastError = formatPushError(e)
      console.error('[WebPush Test Error]:', {
        statusCode: e.statusCode,
        body: e.body,
        endpoint: sub.endpoint,
      })
      // Hapus subscription yang expired atau tidak valid dari database
      if (isExpiredOrInvalidSubscription(e)) {
        await sb.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
      }
    }
  }

  // Kalau ada minimal 1 perangkat yang sukses menerima, bersihkan lastError agar toast sukses
  if (ok > 0) {
    lastError = null
  }

  return json({ ok: ok > 0, sent: ok, failed, devices: subs.length, lastError })
}


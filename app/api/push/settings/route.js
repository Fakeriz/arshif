// app/api/push/settings/route.js
// Baca / ubah pengaturan notifikasi per user.
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const json = (data, status = 200) => NextResponse.json(data, { status })

const DEFAULTS = {
  push_enabled: false,
  bill_enabled: true,
  budget_enabled: true,
  announcement_enabled: true,
}

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

// GET: ambil settings (buat default kalau belum ada)
export async function GET(request) {
  const auth = await getUser(request)
  if (!auth) return json({ error: 'Unauthorized' }, 401)
  const { user, sb } = auth

  // Jalankan query settings dan device count secara paralel
  const [settingsRes, countRes] = await Promise.all([
    sb.from('notification_settings').select('*').eq('user_id', user.id).maybeSingle(),
    sb.from('push_subscriptions').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
  ])

  let data = settingsRes.data

  if (!data) {
    const { data: inserted } = await sb
      .from('notification_settings')
      .upsert({ user_id: user.id }, { onConflict: 'user_id' })
      .select()
      .maybeSingle()
    data = inserted || { user_id: user.id, ...DEFAULTS }
  }

  return json({
    settings: {
      push_enabled: !!data.push_enabled,
      bill_enabled: data.bill_enabled !== false,
      budget_enabled: data.budget_enabled !== false,
      announcement_enabled: data.announcement_enabled !== false,
    },
    devices: countRes.count || 0,
    permission: null, // diisi client-side
  })
}

// PUT: ubah settings
export async function PUT(request) {
  const auth = await getUser(request)
  if (!auth) return json({ error: 'Unauthorized' }, 401)
  const { user, sb } = auth

  let body
  try { body = await request.json() } catch { return json({ error: 'Body tidak valid' }, 400) }

  const update = { user_id: user.id, updated_at: new Date().toISOString() }
  for (const k of ['push_enabled', 'bill_enabled', 'budget_enabled', 'announcement_enabled']) {
    if (typeof body[k] === 'boolean') update[k] = body[k]
  }

  const { data, error } = await sb
    .from('notification_settings')
    .upsert(update, { onConflict: 'user_id' })
    .select()
    .single()
  if (error) return json({ error: 'Gagal menyimpan: ' + error.message }, 500)

  return json({
    ok: true,
    settings: {
      push_enabled: !!data.push_enabled,
      bill_enabled: data.bill_enabled !== false,
      budget_enabled: data.budget_enabled !== false,
      announcement_enabled: data.announcement_enabled !== false,
    },
  })
}

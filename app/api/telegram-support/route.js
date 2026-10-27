import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const clean = (value, max = 2000) => String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max)
const requestsByIp = new Map()

function rateLimit(request) {
  const ip = (request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown').split(',')[0].trim()
  const now = Date.now()
  const recent = (requestsByIp.get(ip) || []).filter((time) => now - time < 60_000)
  if (recent.length >= 5) return false
  recent.push(now)
  requestsByIp.set(ip, recent)
  if (requestsByIp.size > 1000) {
    for (const [key, times] of requestsByIp) {
      if (!times.some((time) => now - time < 60_000)) requestsByIp.delete(key)
    }
  }
  return true
}

async function resolveUser(request) {
  const header = request.headers.get('authorization') || ''
  const token = header.replace(/^Bearer\\s+/i, '').trim()
  if (!token) return null
  try {
    const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    })
    const { data } = await client.auth.getUser(token)
    return data?.user || null
  } catch {
    return null
  }
}

function configError() {
  return NextResponse.json({ error: 'Telegram support is not configured on the server' }, { status: 503 })
}

export async function POST(request) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) return configError()
  if (!rateLimit(request)) return NextResponse.json({ error: 'Too many support requests. Try again later.' }, { status: 429 })

  try {
    const user = await resolveUser(request)
    const form = await request.formData()
    const type = clean(form.get('type'), 40) || 'bug'
    const subject = clean(form.get('subject'), 300)
    const description = clean(form.get('description'), 5000)
    const userEmail = user?.email || 'Mode Tamu / Demo'
    const userId = user?.id || '-'
    const file = form.get('file')

    if (!subject || !description) {
      return NextResponse.json({ error: 'Subject and description are required' }, { status: 400 })
    }

    const typeLabel = type === 'feature' || type === 'suggestion'
      ? 'SARAN FITUR / FEEDBACK BARU'
      : type === 'help' || type === 'question'
        ? 'PERTANYAAN PENGGUNA / BANTUAN'
        : 'BUG REPORT / KENDALA SISTEM'
    const text = [
      `[${typeLabel}]`,
      `Pengirim: ${userEmail}`,
      `UID: ${userId}`,
      `Waktu: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}`,
      '',
      `Subjek: ${subject}`,
      `Deskripsi: ${description}`,
    ].join('\n')

    let telegramResponse
    if (file && typeof file.arrayBuffer === 'function' && file.size > 0) {
      if (file.size > 5 * 1024 * 1024) {
        return NextResponse.json({ error: 'Attachment exceeds the 5MB limit' }, { status: 413 })
      }
      const payload = new FormData()
      payload.append('chat_id', chatId)
      payload.append('caption', text.slice(0, 1024))
      const bytes = await file.arrayBuffer()
      const blob = new Blob([bytes], { type: file.type || 'application/octet-stream' })
      payload.append(file.type?.startsWith('image/') ? 'photo' : 'document', blob, file.name || 'attachment')
      const endpoint = file.type?.startsWith('image/') ? 'sendPhoto' : 'sendDocument'
      telegramResponse = await fetch(`https://api.telegram.org/bot${token}/${endpoint}`, {
        method: 'POST',
        body: payload,
      })
    } else {
      telegramResponse = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text }),
      })
    }

    const data = await telegramResponse.json().catch(() => ({}))
    if (!telegramResponse.ok || !data.ok) {
      console.error('Telegram support error:', data)
      return NextResponse.json({ error: 'Telegram rejected the support report' }, { status: 502 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Telegram support handler error:', error)
    return NextResponse.json({ error: 'Unable to send support report' }, { status: 500 })
  }
}

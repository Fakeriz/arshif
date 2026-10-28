import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const escapeTelegramHtml = (value, max = 200) => String(value || '')
  .replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])
  .slice(0, max)

export async function POST(req) {
  try {
    const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET
    if (!webhookSecret) {
      return NextResponse.json({ error: 'Webhook secret is not configured' }, { status: 503 })
    }
    const providedSecret = req.headers.get('x-telegram-webhook-secret') || ''
    if (providedSecret !== webhookSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const record = body?.record || body

    const email = record?.email || 'Email tidak diketahui'
    const name =
      record?.raw_user_meta_data?.full_name ||
      record?.raw_user_meta_data?.name ||
      record?.full_name ||
      'Pengguna Google / Baru'
    const createdAt = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })

    const token = process.env.TELEGRAM_BOT_TOKEN
    const chatId = process.env.TELEGRAM_CHAT_ID

    // Jika environment variable belum diisi di Vercel
    if (!token || !chatId) {
      console.error('Telegram config missing: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is undefined')
      return NextResponse.json(
        { error: 'Server configuration missing: Telegram bot token or chat ID' },
        { status: 500 }
      )
    }

    const text = `<b>User Baru Mendaftar Arshif!</b>\n\n<b>Nama:</b> ${escapeTelegramHtml(name)}\n<b>Email:</b> ${escapeTelegramHtml(email)}\n<b>Waktu:</b> ${escapeTelegramHtml(createdAt)}`

    const teleRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
      }),
    })

    const teleData = await teleRes.json().catch(() => ({}))

    if (!teleRes.ok) {
      console.error('Telegram API error:', {
        status: teleRes.status,
        description: typeof teleData?.description === 'string' ? teleData.description.slice(0, 200) : undefined,
      })
      return NextResponse.json(
        { error: 'Telegram notification failed' },
        { status: 502 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Internal handler error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
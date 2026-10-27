import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req) {
  try {
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

    const text = `🎉 *User Baru Mendaftar Arshif!*

👤 *Nama:* ${name}
📧 *Email:* ${email}
⏰ *Waktu:* ${createdAt}`

    const teleRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
      }),
    })

    const teleData = await teleRes.json().catch(() => ({}))

    if (!teleRes.ok) {
      console.error('Telegram API Error Response:', teleData)
      return NextResponse.json(
        { error: 'Telegram API returned error', details: teleData },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true, data: teleData })
  } catch (err) {
    console.error('Internal handler error:', err)
    return NextResponse.json({ error: err?.message || 'Unknown error' }, { status: 500 })
  }
}
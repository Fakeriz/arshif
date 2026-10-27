/**
 * Helper to send support ticket notifications to Telegram Admin
 * Supports dynamic message templates per category and multipart/form-data upload using native FormData
 */

function sanitizeMarkdown(text = '') {
  if (!text) return ''
  // Escape markdown special characters to prevent Telegram parse errors
  return String(text).replace(/([_*`\[\\])/g, '\\$1')
}

export async function sendTelegramSupportNotification({
  type = 'bug',
  subject = '',
  description = '',
  userEmail = '',
  userId = '',
  file = null,
}) {
  const botToken = process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN
  const chatId = process.env.NEXT_PUBLIC_TELEGRAM_CHAT_ID

  if (!botToken || !chatId) {
    throw new Error('Environment variable Telegram belum diisi (NEXT_PUBLIC_TELEGRAM_BOT_TOKEN / NEXT_PUBLIC_TELEGRAM_CHAT_ID kosong).')
  }

  const hasFile = Boolean(file)
  const safeSubject = sanitizeMarkdown(subject.trim())
  const safeDescription = sanitizeMarkdown(description.trim())
  const safeUserEmail = sanitizeMarkdown(userEmail || 'Mode Tamu / Demo')
  const safeUserId = userId ? sanitizeMarkdown(userId) : '-'
  const timestamp = new Date().toLocaleString('id-ID')

  // Dynamic Message Builder berdasarkan kategori
  let body = ''

  if (type === 'suggestion' || type === 'feature') {
    const header = '💡 *[SARAN FITUR / FEEDBACK BARU]* 💡\n--------------------------------------'
    body =
      `${header}\n` +
      `👤 *Pengirim:* ${safeUserEmail}\n` +
      `⏰ *Waktu:* ${timestamp}\n\n` +
      `✨ *Ide / Fitur:*\n${safeSubject}\n\n` +
      `📋 *Detail & Kebutuhan Pengguna:*\n${safeDescription}` +
      (hasFile ? '\n\n📎 *Contoh / Mockup:* Terlampir di bawah' : '')
  } else if (type === 'help' || type === 'question') {
    const header = '❓ *[PERTANYAAN PENGGUNA / BANTUAN]* ❓\n--------------------------------------'
    body =
      `${header}\n` +
      `👤 *Penanya:* ${safeUserEmail}\n` +
      `⏰ *Waktu:* ${timestamp}\n\n` +
      `💬 *Topik Pertanyaan:*\n${safeSubject}\n\n` +
      `📖 *Rincian Kendala/Pertanyaan:*\n${safeDescription}` +
      (hasFile ? '\n\n📎 *Berkas Pendukung:* Terlampir di bawah' : '')
  } else {
    // Default: 'bug' / 'error'
    const header = '🚨 *[BUG REPORT / KENDALA SISTEM]* 🚨\n--------------------------------------'
    body =
      `${header}\n` +
      `👤 *Pelapor:* ${safeUserEmail}\n` +
      `🆔 *UID:* ${safeUserId}\n` +
      `⏰ *Waktu:* ${timestamp}\n\n` +
      `📝 *Subjek Kendala:*\n${safeSubject}\n\n` +
      `📄 *Langkah / Deskripsi Masalah:*\n${safeDescription}` +
      (hasFile ? '\n\n📎 *Lampiran Bukti:* Terlampir di bawah' : '')
  }

  // Telegram caption limit adalah 1024 karakter
  const caption = body.length > 1024 ? body.slice(0, 1020) + '...' : body

  // Kondisi A: Jika Pengguna Melampirkan File/Gambar (file ada)
  if (file) {
    const formData = new FormData()
    formData.append('chat_id', chatId)
    formData.append('caption', caption)
    formData.append('parse_mode', 'Markdown')

    let endpoint = ''
    if (file.type && file.type.startsWith('image/')) {
      formData.append('photo', file)
      endpoint = `https://api.telegram.org/bot${botToken}/sendPhoto`
    } else {
      formData.append('document', file)
      endpoint = `https://api.telegram.org/bot${botToken}/sendDocument`
    }

    // JANGAN pasang Header 'Content-Type', biarkan browser mengaturnya otomatis untuk multipart/form-data
    const res = await fetch(endpoint, {
      method: 'POST',
      body: formData,
    })

    let data = await res.json().catch(() => ({}))

    // Fallback jika Markdown formatting Telegram gagal di-parse oleh API Telegram
    if (!data.ok && data.description && /parse|entity|can't parse/i.test(data.description)) {
      const retryFormData = new FormData()
      retryFormData.append('chat_id', chatId)
      retryFormData.append('caption', caption.replace(/[*`\\]/g, ''))
      if (file.type && file.type.startsWith('image/')) {
        retryFormData.append('photo', file)
      } else {
        retryFormData.append('document', file)
      }
      const retryRes = await fetch(endpoint, {
        method: 'POST',
        body: retryFormData,
      })
      data = await retryRes.json().catch(() => ({}))
    }

    if (!data.ok) {
      console.error('Telegram API error details (file):', data)
      throw new Error(data.description || 'Gagal mengirim file ke Telegram')
    }

    return { success: true, data }
  }

  // Kondisi B: Jika Tanpa Lampiran File (sendMessage biasa dengan payload JSON)
  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: body,
      parse_mode: 'Markdown',
    }),
  })

  let data = await res.json().catch(() => ({}))

  // Fallback jika Markdown formatting Telegram gagal di-parse
  if (!data.ok && data.description && /parse|entity|can't parse/i.test(data.description)) {
    const plainRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: body.replace(/[*`\\]/g, ''),
      }),
    })
    data = await plainRes.json().catch(() => ({}))
  }

  if (!data.ok) {
    console.error('Telegram API error details (message):', data)
    throw new Error(data.description || 'Gagal mengirim pesan ke Telegram')
  }

  return { success: true, data }
}

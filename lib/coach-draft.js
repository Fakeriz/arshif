// Ekstrak blok transaksi yang dikeluarkan coach dari jawaban teksnya.
// Coach tidak pernah menulis ke database: hasilnya draft yang dibuka di form
// transaksi, user yang menekan simpan.

const BLOCK_RE = /```arshif-tx\s*([\s\S]*?)```/i
const TYPES = new Set(['expense', 'income', 'transfer'])

function toNumber(value) {
  const n = Number(String(value ?? '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function cleanDate(value) {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

export function normalizeDraft(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const amount = toNumber(raw.amount)
  if (amount === null || amount <= 0) return null
  const type = TYPES.has(raw.type) ? raw.type : 'expense'
  const currency = String(raw.currency || '').trim().toUpperCase()
  const draft = {
    type,
    amount: Math.round(amount * 100) / 100,
    currency: /^[A-Z]{3}$/.test(currency) ? currency : null,
    category: typeof raw.category === 'string' && raw.category.trim() ? raw.category.trim().slice(0, 40) : null,
    note: typeof raw.note === 'string' ? raw.note.trim().slice(0, 120) : '',
    merchant: typeof raw.merchant === 'string' ? raw.merchant.trim().slice(0, 60) : null,
    payment_method: typeof raw.payment_method === 'string' ? raw.payment_method.trim().slice(0, 20) : null,
    account_name: typeof raw.account_name === 'string' ? raw.account_name.trim().slice(0, 60) : null,
    date: cleanDate(raw.date),
  }
  return draft
}

// Mengembalikan { reply, draft }. Blok transaksi selalu dibuang dari teks yang
// ditampilkan, termasuk saat isinya tidak valid (jangan bocorkan JSON mentah).
export function extractDraft(reply) {
  const text = typeof reply === 'string' ? reply : ''
  const match = BLOCK_RE.exec(text)
  if (!match) return { reply: text.trim(), draft: null }
  const cleaned = text.replace(BLOCK_RE, '').replace(/\n{3,}/g, '\n\n').trim()
  let parsed = null
  try {
    parsed = JSON.parse(match[1].trim())
  } catch {
    return { reply: cleaned, draft: null }
  }
  return { reply: cleaned, draft: normalizeDraft(parsed) }
}

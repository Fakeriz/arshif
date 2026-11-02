// Draft transaksi dari blok arshif-tx di jawaban coach. Coach tidak menulis ke
// database: hasilnya draft yang dibuka di form, user yang menyimpan.
import { CATEGORIES } from './categories.js'

const BLOCK_SOURCE = '```arshif-tx\\s*([\\s\\S]*?)```'
const TYPES = new Set(['expense', 'income', 'transfer'])
const CURRENCY_RE = /^[A-Z]{3}$/
const CATEGORY_RE = /^[a-z][a-z_]{1,19}$/
const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/
const DATE_TIME_RE = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:?\d{2})?$/i

const DEFAULT_CATEGORIES = CATEGORIES.map((c) => c.id)
const MAX_WALLETS = 20

function toNumber(value) {
  const n = Number(String(value ?? '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function isRealDate(year, month, day) {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false
  const d = new Date(Date.UTC(year, month - 1, day))
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day
}

// Hanya YYYY-MM-DD dan ISO yang diterima. String lain ("kemarin", "02/11/2026")
// jadi null supaya form mengisi tanggal hari ini, bukan ditebak Date() mentah.
function cleanDate(value) {
  const s = String(value ?? '').trim()
  if (!s || /^today$/i.test(s)) return null

  const dateOnly = s.match(DATE_ONLY_RE)
  if (dateOnly) {
    const [y, m, d] = dateOnly.slice(1, 4).map(Number)
    return isRealDate(y, m, d) ? s : null
  }

  const dt = s.match(DATE_TIME_RE)
  if (!dt) return null
  const y = Number(dt[1])
  const m = Number(dt[2])
  const d = Number(dt[3])
  const ss = Number(dt[6] || 0)
  if (!isRealDate(y, m, d)) return null
  if (Number(dt[4]) > 23 || Number(dt[5]) > 59 || ss > 59) return null
  const offset = dt[8]
  if (offset && offset.toUpperCase() !== 'Z') {
    const digits = offset.slice(1).replace(':', '')
    if (Number(digits.slice(0, 2)) > 14 || Number(digits.slice(2)) > 59) return null
  }
  // Jam dinding dibiarkan seperti yang ditulis model: form memakai bagian
  // tanggal dan jam apa adanya, konversi zona waktu bukan urusan draft.
  return s.replace(' ', 'T')
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
    currency: CURRENCY_RE.test(currency) ? currency : null,
    category: typeof raw.category === 'string' && raw.category.trim()
      ? raw.category.trim().toLowerCase().slice(0, 40)
      : null,
    note: typeof raw.note === 'string' ? raw.note.trim().slice(0, 120) : '',
    merchant: typeof raw.merchant === 'string' ? raw.merchant.trim().slice(0, 60) : null,
    payment_method: typeof raw.payment_method === 'string' ? raw.payment_method.trim().slice(0, 20) : null,
    account_name: typeof raw.account_name === 'string' ? raw.account_name.trim().slice(0, 60) : null,
    to_account_name: typeof raw.to_account_name === 'string' ? raw.to_account_name.trim().slice(0, 60) : null,
    date: cleanDate(raw.date),
  }
  return draft
}

// Daftar kategori yang dikirim client, dibersihkan; kosong berarti pakai
// fallback (server mengirim VOICE_CATEGORIES di sana).
export function readCategories(list, fallback = DEFAULT_CATEGORIES) {
  const ids = (Array.isArray(list) ? list : [])
    .map((c) => (typeof c === 'string' ? c : c?.id))
    .map((c) => (typeof c === 'string' ? c.trim().toLowerCase() : ''))
    .filter((c) => CATEGORY_RE.test(c))
  if (!ids.length) return fallback.slice()
  return Array.from(new Set(ids))
}

// Terima string ringkas "Nama (CUR)" dari client baru maupun objek
// {name,currency} dari client lama. Hanya nama + mata uang yang dipakai.
export function parseWallets(list, homeCurrency = 'IDR') {
  const home = String(homeCurrency || '').toUpperCase()
  const safeHome = CURRENCY_RE.test(home) ? home : 'IDR'
  const out = []
  for (const item of Array.isArray(list) ? list : []) {
    let name = ''
    let currency = safeHome
    if (typeof item === 'string') {
      const m = item.match(/^(.*?)\s*\(([A-Za-z]{3})\)\s*$/)
      name = (m ? m[1] : item).trim()
      currency = m ? m[2].toUpperCase() : safeHome
    } else if (item && typeof item === 'object') {
      name = String(item.name || '').trim()
      const cur = String(item.currency || '').toUpperCase()
      currency = CURRENCY_RE.test(cur) ? cur : safeHome
    }
    if (!name) continue
    out.push({ name: name.slice(0, 60), currency })
    if (out.length >= MAX_WALLETS) break
  }
  return out
}

function walletName(account) {
  if (typeof account === 'string') return account.replace(/\s*\([A-Za-z]{3}\)\s*$/, '').trim()
  return String(account?.name || '').trim()
}

// Cocokkan dua arah seperti voice: "BCA" ketemu "BCA Utama", dan sebaliknya.
function matchWallet(name, accounts) {
  const needle = String(name || '').trim().toLowerCase()
  if (!needle) return null
  const hit = (Array.isArray(accounts) ? accounts : []).find((a) => {
    const candidate = walletName(a).toLowerCase()
    return candidate && (candidate.includes(needle) || needle.includes(candidate))
  })
  return hit ? walletName(hit) : null
}

// Validasi draft terhadap data user: kategori asing jadi null (bukan food),
// mata uang kosong/rusak jatuh ke home currency, akun dicocokkan ke nama asli.
export function resolveDraft(draft, { categories, accounts, homeCurrency } = {}) {
  if (!draft) return null
  const validCategories = new Set(readCategories(categories, DEFAULT_CATEGORIES))
  const home = String(homeCurrency || '').toUpperCase()
  const currency = CURRENCY_RE.test(draft.currency || '')
    ? draft.currency
    : (CURRENCY_RE.test(home) ? home : 'IDR')
  return {
    ...draft,
    category: draft.category && validCategories.has(draft.category) ? draft.category : null,
    currency,
    account_name: matchWallet(draft.account_name, accounts),
    to_account_name: matchWallet(draft.to_account_name, accounts),
  }
}

// Mengembalikan { reply, draft }. Semua blok transaksi dibuang dari teks yang
// ditampilkan; blok pertama yang valid jadi draft, sisanya diabaikan.
export function extractDraft(reply) {
  const text = typeof reply === 'string' ? reply : ''
  const blocks = [...text.matchAll(new RegExp(BLOCK_SOURCE, 'gi'))]
  if (!blocks.length) return { reply: text.trim(), draft: null }
  const cleaned = text.replace(new RegExp(BLOCK_SOURCE, 'gi'), '').replace(/\n{3,}/g, '\n\n').trim()
  for (const block of blocks) {
    let parsed = null
    try {
      parsed = JSON.parse(block[1].trim())
    } catch {
      continue
    }
    const draft = normalizeDraft(parsed)
    if (draft) return { reply: cleaned, draft }
  }
  return { reply: cleaned, draft: null }
}

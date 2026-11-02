// Simpan draft transaksi dari chat coach. Draft tidak pernah ditulis diam-diam:
// user menekan tombol, lalu transaksi lewat jalur store yang sama dengan form.

// FNV-1a 64-bit, cukup untuk id stabil per pesan coach.
function hash64(str) {
  let h = 0xcbf29ce484222325n
  const prime = 0x100000001b3n
  const mask = 0xffffffffffffffffn
  for (let i = 0; i < str.length; i++) {
    h ^= BigInt(str.charCodeAt(i))
    h = (h * prime) & mask
  }
  return h
}

// Id deterministik dari kunci pesan: kirim ulang pesan yang sama menabrak
// primary key, jadi tidak ada baris dobel walau tombol ditekan dua kali.
export function draftTxId(key) {
  const k = String(key ?? '')
  if (!k) return null
  const a = hash64(`a:${k}`).toString(16).padStart(16, '0')
  const b = hash64(`b:${k}`).toString(16).padStart(16, '0')
  const hex = a + b
  const variant = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

const CATEGORY_BY_TYPE = {
  income: 'salary',
  transfer: 'other',
  expense: 'other',
}

// Akun dipilih dari nama yang dikirim model: cocok persis dulu, lalu salah satu
// arah substring seperti voice parser, terakhir akun pertama bila user hanya punya satu.
export function resolveAccount(draft, accounts = []) {
  const list = (accounts || []).filter((a) => a?.id)
  if (!list.length) return null
  const wanted = String(draft?.account_name || '').trim().toLowerCase()
  if (!wanted) return list.length === 1 ? list[0] : null

  const exact = list.find((a) => String(a.name || '').trim().toLowerCase() === wanted)
  if (exact) return exact

  const loose = list.find((a) => {
    const name = String(a.name || '').trim().toLowerCase()
    return name && (name.includes(wanted) || wanted.includes(name))
  })
  return loose || null
}

export function resolveToAccount(draft, accounts = []) {
  if (draft?.type !== 'transfer') return null
  const list = (accounts || []).filter((a) => a?.id)
  if (!list.length) return null
  const wanted = String(draft?.to_account_name || '').trim().toLowerCase()
  if (!wanted) return null

  const exact = list.find((a) => String(a.name || '').trim().toLowerCase() === wanted)
  if (exact) return exact

  return list.find((a) => {
    const name = String(a.name || '').trim().toLowerCase()
    return name && (name.includes(wanted) || wanted.includes(name))
  }) || null
}

// Payload siap kirim ke store.createTransaction. Nominal dan mata uang sudah
// divalidasi server, di sini hanya menyusun bentuk yang dipakai form.
export function buildCoachTx(draft, { accounts = [], home = 'IDR', id = null, now = new Date() } = {}) {
  if (!draft || !(Number(draft.amount) > 0)) return null
  const type = draft.type || 'expense'
  const account = resolveAccount(draft, accounts)
  const toAccount = resolveToAccount(draft, accounts)
  const stamp = now instanceof Date ? now.toISOString() : String(now)
  const currency = String(draft.currency || home || 'IDR').toUpperCase().slice(0, 3)
  const category = draft.category || CATEGORY_BY_TYPE[type] || 'other'

  return {
    ...(id ? { id } : {}),
    type,
    amount: Number(draft.amount),
    currency,
    category,
    payment_method: draft.payment_method || (type === 'income' ? 'bank' : 'cash'),
    account_id: account?.id || null,
    to_account_id: toAccount?.id || null,
    merchant: draft.merchant || null,
    note: draft.note || '',
    items: [],
    date: draft.date || stamp,
    transaction_date: draft.date || stamp,
  }
}

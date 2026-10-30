// app/api/_handlers/receipt-cache.js
// In-memory cache struk (base64 thumbnail) untuk proxy Drive.
// Eviksi: TTL 15 menit + maksimum entri (purge kedaluwarsa dulu, lalu tertua).
const RECEIPT_CACHE_TTL = 15 * 60 * 1000
const MAX_RECEIPT_CACHE_ENTRIES = 50

const RECEIPT_CACHE = new Map()

// Ambil entry cache yang masih segar; hapus kalau kedaluwarsa.
export function receiptCacheGet(id) {
  if (!RECEIPT_CACHE.has(id)) return null
  const cached = RECEIPT_CACHE.get(id)
  if (cached?.time && Date.now() - cached.time > RECEIPT_CACHE_TTL) {
    RECEIPT_CACHE.delete(id)
    return null
  }
  return cached
}

// Simpan entry: purge kedaluwarsa dulu, lalu eviksi tertua sampai di bawah batas.
export function receiptCacheSet(id, entry) {
  if (RECEIPT_CACHE.has(id)) RECEIPT_CACHE.delete(id)
  const now = Date.now()
  for (const [key, value] of RECEIPT_CACHE) {
    if (!value?.time || now - value.time > RECEIPT_CACHE_TTL) RECEIPT_CACHE.delete(key)
  }
  while (RECEIPT_CACHE.size >= MAX_RECEIPT_CACHE_ENTRIES) {
    const oldestId = RECEIPT_CACHE.keys().next().value
    if (oldestId === undefined) break
    RECEIPT_CACHE.delete(oldestId)
  }
  RECEIPT_CACHE.set(id, { ...entry, time: now })
}

export function receiptCacheDelete(id) {
  RECEIPT_CACHE.delete(id)
}

export const RECEIPT_CACHE_LIMITS = { ttl: RECEIPT_CACHE_TTL, maxEntries: MAX_RECEIPT_CACHE_ENTRIES }

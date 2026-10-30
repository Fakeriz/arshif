// Perbandingan secret yang timing-safe (verifikasi credential
// server-side tidak boleh bocor lewat early-exit string comparison).

import crypto from 'crypto'

// Return true kalau sama. Selalu membandingkan hash agar panjang tidak bocor.
export function safeSecretEqual(provided, expected) {
  if (!expected || typeof expected !== 'string') return false
  const a = crypto.createHash('sha256').update(String(provided || '')).digest()
  const b = crypto.createHash('sha256').update(expected).digest()
  return crypto.timingSafeEqual(a, b)
}

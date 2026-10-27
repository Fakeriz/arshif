// lib/amount.js
// Sanitasi input nominal untuk keyboard mobile berbagai locale.
// Masalah: di beberapa locale (mis. Turki/Eropa) tombol desimal adalah koma (,),
// tapi `type="number"` memblokirnya. Solusi: input pakai `type="text"`
// + `inputMode="decimal"`, lalu sanitasi nilainya dengan fungsi di bawah.

/**
 * Bersihkan string input nominal:
 * - koma (,) -> titik (.)
 * - buang karakter selain digit dan titik
 * - maksimal satu titik desimal
 * - batasi digit di belakang desimal (default 2)
 */
export function sanitizeAmount(raw, maxDecimals = 2) {
  let val = String(raw ?? '').replace(/,/g, '.').replace(/[^0-9.]/g, '')
  const dotIdx = val.indexOf('.')
  if (dotIdx !== -1) {
    val = val.slice(0, dotIdx + 1) + val.slice(dotIdx + 1).replace(/\./g, '').slice(0, maxDecimals)
  }
  return val
}

/** Parse string nominal yang sudah disanitasi menjadi number. */
export function parseAmount(raw) {
  return parseFloat(raw) || 0
}

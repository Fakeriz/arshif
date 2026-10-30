// lib/money-parse.js
// SATU sumber parsing nilai uang untuk seluruh app (logika uang
// hanya boleh punya satu implementasi yang di-test, bukan versi tersebar).

/**
 * Parse nilai uang dari input bebas (number, "1.234,56", "1,234.56",
 * "(500)" = negatif, "Rp 12.500-", dst).
 * Return number (bulat ke 2 desimal) atau null kalau bukan angka.
 *
 * Aturan:
 * - koma + titik bersamaan: pemisah TERAKHIR = desimal (ID "1.234,56", EN "1,234.56")
 * - koma saja: grup tepat \d{1,3},\d{3} atau banyak grup = ribuan; lainnya = desimal
 * - titik saja: grup tepat \d{1,3}(\.\d{3})+ = ribuan; lainnya = desimal
 * - (angka) = negatif; tanda minus di akhir ("500-") = negatif
 */
export function parseMoney(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  let s = String(value ?? '').trim()
  if (!s) return null
  let neg = false
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1).trim() }
  s = s.replace(/[^\d.,-]/g, '')
  if (!s || s === '-' || s === '.' || s === ',') return null
  if (/-$/.test(s) && /\d/.test(s)) { neg = true; s = s.slice(0, -1) } // "500-"
  if (/^-/.test(s)) { neg = true }
  s = s.replace(/-/g, '')
  if (!s) return null

  const hasComma = s.includes(',')
  const hasDot = s.includes('.')
  if (hasComma && hasDot) {
    // pemisah terakhir = desimal → "1.234,56" (ID) atau "1,234.56" (EN)
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.')
    else s = s.replace(/,/g, '')
  } else if (hasComma) {
    const pcs = s.split(',')
    if (pcs.length > 2) s = pcs.join('')
    else if (/^\d{1,3},\d{3}$/.test(s)) s = pcs.join('') // 1,234 → ribuan
    else s = s.replace(',', '.')                         // 12,5 → desimal
  } else if (hasDot) {
    // "10.000" (ID: sepuluh ribu) vs "10.50" (desimal), grup tepat = ribuan
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '')
  }
  const n = parseFloat(s)
  if (isNaN(n)) return null
  return Math.round((neg ? -n : n) * 100) / 100
}

/**
 * Versi toleran untuk nilai AI/eksternal: selalu return number (0 bila
 * tidak bisa di-parse), dipakai di route API di mana input dari model.
 */
export function parseMoneyOrZero(value) {
  const n = parseMoney(value)
  return n === null ? 0 : n
}

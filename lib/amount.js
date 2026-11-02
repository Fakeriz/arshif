// lib/amount.js
// Sanitasi input nominal untuk keyboard mobile, dan parse lewat satu sumber
// (lib/money-parse.js) supaya "10.000" gaya Indonesia tidak dibaca 10.

import { parseMoney } from './money-parse'

/**
 * Sanitasi string nominal yang sedang diketik:
 * - hanya digit, titik, dan koma
 * - titik ribuan gaya Indonesia ("10.000") dibiarkan apa adanya
 * - desimal dipotong sesuai maxDecimals
 */
export function sanitizeAmount(raw, maxDecimals = 2) {
  const val = String(raw ?? '').replace(/[^0-9.,]/g, '')
  if (!val) return ''

  const hasComma = val.includes(',')
  const hasDot = val.includes('.')

  if (hasComma && hasDot) {
    // Pemisah terakhir = desimal, sisanya pemisah ribuan.
    const decimalSep = val.lastIndexOf(',') > val.lastIndexOf('.') ? ',' : '.'
    const groupSep = decimalSep === ',' ? '.' : ','
    const parts = val.split(decimalSep)
    const head = parts.slice(0, -1).join('').split(groupSep).join('')
    const tail = parts[parts.length - 1].slice(0, maxDecimals)
    return `${head}.${tail}`
  }

  if (hasComma) {
    // "1,234" = ribuan gaya EN, "12,5" = desimal gaya ID.
    if (/^\d{1,3}(,\d{3})+$/.test(val)) return val.split(',').join('')
    const parts = val.split(',')
    return `${parts.slice(0, -1).join('')}.${parts[parts.length - 1].slice(0, maxDecimals)}`
  }

  if (hasDot) {
    // "10.000" dan "1.234.567" = ribuan gaya Indonesia, biarkan apa adanya.
    if (/^\d{1,3}(\.\d{3})+$/.test(val)) return val
    const parts = val.split('.')
    return `${parts.slice(0, -1).join('')}.${parts[parts.length - 1].slice(0, maxDecimals)}`
  }

  return val
}

/** Parse string nominal menjadi number lewat parser uang tunggal. */
export function parseAmount(raw) {
  const n = parseMoney(raw)
  return n === null ? 0 : n
}

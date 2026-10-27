// lib/amount.js
// Sanitizes amount input across mobile keyboard locales where the decimal
// key is a comma, which `type="number"` blocks.

/**
 * Sanitize an amount string:
 * - comma becomes a decimal point
 * - strip everything except digits and one dot
 * - cap decimal digits (default 2)
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

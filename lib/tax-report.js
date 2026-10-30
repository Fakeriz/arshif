// Agregasi laporan pajak dari transactions.tax_deductible.
// Pure logic, tanpa React/Supabase: dipakai TaxReportSheet dan test node.
// Parsing nominal WAJIB lewat lib/money-parse (satu implementasi uang).

import { parseMoneyOrZero } from './money-parse'

const txDate = (tx) => {
  try {
    const d = new Date(tx?.date || tx?.transaction_date || tx?.created_at || 0)
    return isNaN(d.getTime()) ? null : d
  } catch { return null }
}

/**
 * Agregasi transaksi tax_deductible per periode.
 * @param {Array} transactions
 * @param {Object} opts
 *   - year (wajib), month (0-11, opsional: null = setahun penuh)
 *   - toHome (fn(amount, currency) => number, opsional; default identitas)
 * @returns {{ total: number, count: number, byCategory: Array<{category, total, count}>, transactions: Array }}
 */
export function buildTaxReport(transactions, { year, month = null, toHome } = {}) {
  const convert = typeof toHome === 'function' ? toHome : (a) => a
  const list = Array.isArray(transactions) ? transactions : []

  const matched = list.filter((tx) => {
    if (!tx?.tax_deductible) return false
    const d = txDate(tx)
    if (!d) return false
    if (d.getFullYear() !== year) return false
    if (month !== null && month !== undefined && d.getMonth() !== month) return false
    return true
  })

  const catMap = {}
  let total = 0
  matched.forEach((tx) => {
    // Parse dulu lewat money-parse (string "1.500.000" tetap terbaca),
    // baru konversi ke mata uang dasar. Urutan terbalik merusak string
    // karena convert() melakukan Number() mentah.
    const raw = parseMoneyOrZero(tx.amount)
    const amount = parseMoneyOrZero(convert(raw, tx.currency))
    const cat = tx.category || 'other'
    if (!catMap[cat]) catMap[cat] = { category: cat, total: 0, count: 0 }
    catMap[cat].total += amount
    catMap[cat].count += 1
    total += amount
  })

  // Bulatkan total ke 2 desimal agar hasil agregasi stabil untuk test/display.
  const round2 = (n) => Math.round(n * 100) / 100
  const byCategory = Object.values(catMap)
    .map((c) => ({ ...c, total: round2(c.total) }))
    .sort((a, b) => b.total - a.total)

  return { total: round2(total), count: matched.length, byCategory, transactions: matched }
}

/**
 * Baris AOA (array of arrays) untuk export CSV/XLSX via paket xlsx.
 * Kolom: Period, Category, Transactions, Total Deductible, Currency.
 */
export function taxReportRows(report, { label = '', currency = '' } = {}) {
  const rows = [
    ['Period', 'Category', 'Transactions', 'Total Deductible', 'Currency'],
    [label, 'All', report.count, report.total, currency],
  ]
  ;(report.byCategory || []).forEach((c) => {
    rows.push([label, c.category, c.count, c.total, currency])
  })
  return rows
}

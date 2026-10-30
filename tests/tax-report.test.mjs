// tests/tax-report.test.mjs
// Test untuk lib/tax-report.js: agregasi transaksi tax_deductible per periode.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildTaxReport, taxReportRows } from '../lib/tax-report.js'

const tx = (over = {}) => ({
  id: 'tx_x',
  type: 'expense',
  amount: 100,
  currency: 'USD',
  category: 'other',
  date: '2026-03-15T10:00:00Z',
  tax_deductible: false,
  ...over,
})

test('buildTaxReport only includes tax_deductible transactions', () => {
  const list = [
    tx({ id: 'a', tax_deductible: true, amount: 500 }),
    tx({ id: 'b', tax_deductible: false, amount: 999 }),
    tx({ id: 'c', amount: 777 }), // field tidak ada = tidak deductible
    tx({ id: 'd', tax_deductible: null, amount: 888 }),
  ]
  const r = buildTaxReport(list, { year: 2026, month: 2 })
  assert.equal(r.count, 1)
  assert.equal(r.total, 500)
})

test('buildTaxReport filters by year', () => {
  const list = [
    tx({ id: 'a', tax_deductible: true, amount: 100, date: '2026-01-10T00:00:00Z' }),
    tx({ id: 'b', tax_deductible: true, amount: 200, date: '2025-06-10T00:00:00Z' }),
    tx({ id: 'c', tax_deductible: true, amount: 300, date: '2026-12-31T23:59:00Z' }),
  ]
  const r = buildTaxReport(list, { year: 2026, month: null })
  assert.equal(r.count, 2)
  assert.equal(r.total, 400)
})

test('buildTaxReport filters by month (null month = full year)', () => {
  const list = [
    tx({ id: 'a', tax_deductible: true, amount: 10, date: '2026-03-05T00:00:00Z' }),
    tx({ id: 'b', tax_deductible: true, amount: 20, date: '2026-04-05T00:00:00Z' }),
  ]
  const rMonth = buildTaxReport(list, { year: 2026, month: 2 }) // Maret
  assert.equal(rMonth.count, 1)
  assert.equal(rMonth.total, 10)

  const rYear = buildTaxReport(list, { year: 2026, month: null })
  assert.equal(rYear.count, 2)
  assert.equal(rYear.total, 30)
})

test('buildTaxReport groups by category and sorts by total desc', () => {
  const list = [
    tx({ id: 'a', tax_deductible: true, amount: 100, category: 'food' }),
    tx({ id: 'b', tax_deductible: true, amount: 250, category: 'transport' }),
    tx({ id: 'c', tax_deductible: true, amount: 50, category: 'food' }),
    tx({ id: 'd', tax_deductible: true, amount: 70, category: 'business' }),
  ]
  const r = buildTaxReport(list, { year: 2026, month: 2 })
  assert.deepEqual(r.byCategory.map((c) => c.category), ['transport', 'food', 'business'])
  assert.deepEqual(r.byCategory.map((c) => c.total), [250, 150, 70])
  assert.deepEqual(r.byCategory.map((c) => c.count), [1, 2, 1])
  assert.equal(r.total, 470)
})

test('buildTaxReport uses category other for missing category', () => {
  const r = buildTaxReport([tx({ tax_deductible: true, category: undefined })], { year: 2026, month: 2 })
  assert.deepEqual(r.byCategory.map((c) => c.category), ['other'])
})

test('buildTaxReport handles string amounts via money-parse (ID format)', () => {
  // Nominal string ID "1.500.000" tetap dibaca benar lewat parseMoneyOrZero.
  const r = buildTaxReport([tx({ tax_deductible: true, amount: '1.500.000' })], { year: 2026, month: 2 })
  assert.equal(r.total, 1500000)
})

test('buildTaxReport converts amounts via toHome before aggregating', () => {
  const toHome = (amount, currency) => (currency === 'IDR' ? amount / 16300 : amount)
  const list = [
    tx({ id: 'a', tax_deductible: true, amount: 163000, currency: 'IDR' }),
    tx({ id: 'b', tax_deductible: true, amount: 50, currency: 'USD' }),
  ]
  const r = buildTaxReport(list, { year: 2026, month: 2, toHome })
  assert.equal(r.count, 2)
  assert.equal(r.total, 60)
})

test('buildTaxReport ignores invalid/missing dates and non-array input', () => {
  assert.deepEqual(buildTaxReport([tx({ tax_deductible: true, date: 'not-a-date' })], { year: 2026, month: 2 }), { total: 0, count: 0, byCategory: [], transactions: [] })
  assert.deepEqual(buildTaxReport(null, { year: 2026, month: 2 }), { total: 0, count: 0, byCategory: [], transactions: [] })
  assert.deepEqual(buildTaxReport(undefined, { year: 2026, month: 2 }), { total: 0, count: 0, byCategory: [], transactions: [] })
})

test('buildTaxReport falls back to transaction_date then created_at', () => {
  const r = buildTaxReport([
    tx({ id: 'a', tax_deductible: true, date: undefined, transaction_date: '2026-02-01T00:00:00Z' }),
    tx({ id: 'b', tax_deductible: true, date: undefined, transaction_date: undefined, created_at: '2026-02-20T00:00:00Z' }),
  ], { year: 2026, month: 1 })
  assert.equal(r.count, 2)
})

test('buildTaxReport empty list returns zeroed report', () => {
  const r = buildTaxReport([], { year: 2026, month: 0 })
  assert.equal(r.count, 0)
  assert.equal(r.total, 0)
  assert.deepEqual(r.byCategory, [])
})

test('taxReportRows builds export rows with header, total and per-category', () => {
  const report = buildTaxReport([
    tx({ id: 'a', tax_deductible: true, amount: 100, category: 'food' }),
    tx({ id: 'b', tax_deductible: true, amount: 200, category: 'food' }),
    tx({ id: 'c', tax_deductible: true, amount: 70, category: 'business' }),
  ], { year: 2026, month: 2 })
  const rows = taxReportRows(report, { label: 'March 2026', currency: 'USD' })
  assert.deepEqual(rows[0], ['Period', 'Category', 'Transactions', 'Total Deductible', 'Currency'])
  assert.deepEqual(rows[1], ['March 2026', 'All', 3, 370, 'USD'])
  assert.deepEqual(rows[2], ['March 2026', 'food', 2, 300, 'USD'])
  assert.deepEqual(rows[3], ['March 2026', 'business', 1, 70, 'USD'])
  assert.equal(rows.length, 4)
})

test('taxReportRows handles empty report', () => {
  const rows = taxReportRows({ total: 0, count: 0, byCategory: [] }, { label: '2026', currency: 'IDR' })
  assert.equal(rows.length, 2)
  assert.deepEqual(rows[1], ['2026', 'All', 0, 0, 'IDR'])
})

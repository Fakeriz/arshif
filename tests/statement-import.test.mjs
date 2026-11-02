// Test untuk lib/statement-import.js: validasi tanggal impor dan
// pemeriksaan kontinuitas saldo rekening koran.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeDate, checkBalanceContinuity } from '../lib/statement-import.js'

test('normalizeDate accepts valid dates', () => {
  const d = normalizeDate('30/10/2026')
  assert.equal(d.getFullYear(), 2026)
  assert.equal(d.getMonth(), 9)
  assert.equal(d.getDate(), 30)
  const iso = normalizeDate('2026-10-30')
  assert.equal(iso.getFullYear(), 2026)
  assert.equal(iso.getMonth(), 9)
  assert.equal(iso.getDate(), 30)
})

test('normalizeDate rejects impossible dates instead of rolling over', () => {
  assert.equal(normalizeDate('2026-13-45'), null)
  assert.equal(normalizeDate('31/02/2026'), null)
  assert.equal(normalizeDate('2026-02-29'), null) // 2026 bukan kabisat
  assert.equal(normalizeDate('32/01/2026'), null)
})

test('normalizeDate accepts Feb 29 on leap years', () => {
  const d = normalizeDate('29/02/2024')
  assert.equal(d.getFullYear(), 2024)
  assert.equal(d.getMonth(), 1)
  assert.equal(d.getDate(), 29)
})

test('checkBalanceContinuity flags non-finite balances instead of passing', () => {
  const rows = [
    { date: new Date(2026, 0, 1), dateStr: '2026-01-01', amount: 100, type: 'income', balanceAfter: 1000 },
    { date: new Date(2026, 0, 2), dateStr: '2026-01-02', amount: 50, type: 'expense', balanceAfter: NaN },
  ]
  const res = checkBalanceContinuity(rows)
  assert.equal(res.checked, true)
  assert.equal(res.ok, false)
  assert.equal(res.at, '2026-01-02')
})

test('checkBalanceContinuity still passes a consistent ledger', () => {
  const rows = [
    { date: new Date(2026, 0, 1), dateStr: '2026-01-01', amount: 100, type: 'income', balanceAfter: 1000 },
    { date: new Date(2026, 0, 2), dateStr: '2026-01-02', amount: 50, type: 'expense', balanceAfter: 950 },
  ]
  assert.deepEqual(checkBalanceContinuity(rows), { checked: true, ok: true })
})

// Regresi audit: tanda minus di belakang dan nama bulan Indonesia.
test('parseAmount membaca minus di belakang dan minus unicode', async () => {
  const { parseAmount } = await import('../lib/statement-import.js')
  assert.equal(parseAmount('100.00-'), -100)
  assert.equal(parseAmount('1.234,56-'), -1234.56)
  assert.equal(parseAmount('\u221250'), -50)
  assert.equal(parseAmount('DR 25.000'), -25000)
  assert.equal(parseAmount('CR 1,234.56'), 1234.56)
})

test('normalizeDate mengenali nama bulan Indonesia', async () => {
  const { normalizeDate, fmtDateStr } = await import('../lib/statement-import.js')
  // Tanggal adalah hari kalender lokal, bukan instant UTC: assert lewat
  // fmtDateStr (getter lokal) supaya hasilnya sama di mesin UTC maupun +08.
  // toISOString di sini akan bergeser sehari untuk TZ positif.
  assert.equal(fmtDateStr(normalizeDate('10 Okt 2026')), '2026-10-10')
  assert.equal(fmtDateStr(normalizeDate('10 Agustus 2026')), '2026-08-10')
  assert.equal(normalizeDate('31 Feb 2026'), null)
})

test('baris tanpa tanggal terbaca ditandai, bukan diisi hari ini', async () => {
  const { normalizeRows } = await import('../lib/statement-import.js')
  const rows = normalizeRows([['tgl ngawur', 'Kopi', '18000']], { date: 0, desc: 1, amount: 2 }, 'single', 'IDR')
  assert.equal(rows.length, 1)
  assert.equal(rows[0].date, null)
  assert.equal(rows[0].dateMissing, true)
  assert.equal(rows[0].dateStr, '')
})

test('duplikat dalam file: kejadian pertama tetap ikut impor', async () => {
  const { markInFileDuplicates } = await import('../lib/statement-import.js')
  const rows = markInFileDuplicates([
    { dateStr: '2026-11-01', amount: 18000, currency: 'IDR', desc: 'Kopi Kenangan', idx: 0 },
    { dateStr: '2026-11-01', amount: 18000, currency: 'IDR', desc: 'Kopi Kenangan', idx: 1 },
  ])
  assert.equal(rows[0].dupInFile, false, 'baris pertama tidak ditandai duplikat')
  assert.equal(rows[1].dupInFile, true, 'salinan kedua ditandai, bisa disertakan manual')
})

// Kolom dengan tanggal bertanda tidak boleh jadi pasangan debit kosong.
test('detectMapping tidak menjadikan kolom balance sebagai debit', async () => {
  const { detectMapping } = await import('../lib/statement-import.js')
  const r = detectMapping(['Date', 'Desc', 'Amount', 'Balance'], [
    ['2026-11-01', 'A', '100', '1100'],
    ['2026-11-02', 'B', '-50', '1050'],
    ['2026-11-03', 'C', '200', '1250'],
  ])
  assert.equal(r.mapping.amount, 2)
  assert.equal(r.mapping.balance, 3)
  assert.equal(r.mapping.debit, -1)
  assert.equal(r.mapping.credit, -1)
})

test('detectMapping mengenali debit/kredit terpisah', async () => {
  const { detectMapping } = await import('../lib/statement-import.js')
  const r = detectMapping(['Date', 'Desc', 'Debit', 'Credit'], [
    ['2026-11-01', 'A', '100', ''],
    ['2026-11-02', 'B', '', '500'],
    ['2026-11-03', 'C', '50', ''],
  ])
  assert.equal(r.dirMode, 'split')
  assert.equal(r.mapping.debit, 2)
  assert.equal(r.mapping.credit, 3)
})

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

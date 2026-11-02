import assert from 'node:assert/strict'
import test from 'node:test'
import { shiftCycleDate } from '../lib/cycle.js'

test('shiftCycleDate memajukan bulanan dan menjaga akhir bulan', () => {
  assert.equal(shiftCycleDate('2026-11-05', 'monthly', 1), '2026-12-05')
  assert.equal(shiftCycleDate('2026-01-31', 'monthly', 1), '2026-02-28')
  assert.equal(shiftCycleDate('2026-12-31', 'monthly', 1), '2027-01-31')
})

test('shiftCycleDate mendukung kuartal, tahunan, dan mingguan', () => {
  assert.equal(shiftCycleDate('2026-11-05', 'quarterly', 1), '2027-02-05')
  assert.equal(shiftCycleDate('2026-11-05', 'yearly', 1), '2027-11-05')
  assert.equal(shiftCycleDate('2026-11-05', 'weekly', 2), '2026-11-19')
  assert.equal(shiftCycleDate('2026-11-05', 'biweekly', 1), '2026-11-19')
})

test('shiftCycleDate mundur satu siklus dan menolak input rusak', () => {
  assert.equal(shiftCycleDate('2026-03-31', 'monthly', -1), '2026-02-28')
  assert.equal(shiftCycleDate('2026-11-05', 'monthly', -1), '2026-10-05')
  assert.equal(shiftCycleDate('', 'monthly', 1), null)
  assert.equal(shiftCycleDate('bukan tanggal', 'monthly', 1), null)
})

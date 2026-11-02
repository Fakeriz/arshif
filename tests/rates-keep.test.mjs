import assert from 'node:assert/strict'
import test from 'node:test'
import { convertOrKeep, convert, FALLBACK_RATES } from '../lib/rates.js'
import { signedAccountBalance, computeBalanceDelta } from '../lib/ledger.js'

const RATES = { USD: 1, IDR: 16000, EUR: 0.9 }

test('kurs dikenal: konversi normal', () => {
  const r = convertOrKeep(100, 'USD', 'IDR', RATES)
  assert.equal(r.value, 1600000)
  assert.equal(r.converted, true)
})

test('kurs tak dikenal: nominal asli, bukan 0', () => {
  const r = convertOrKeep(1000, 'XYZ', 'IDR', RATES)
  assert.equal(r.value, 1000)
  assert.equal(r.converted, false)
})

test('mata uang sama: nominal asli, converted true', () => {
  const r = convertOrKeep(500, 'IDR', 'IDR', RATES)
  assert.equal(r.value, 500)
  assert.equal(r.converted, true)
})

test('amount bukan angka: jatuh ke 0, tetap converted', () => {
  const r = convertOrKeep(null, 'USD', 'IDR', RATES)
  assert.equal(r.value, 0)
  assert.equal(r.converted, true)
})

test('total homepage tidak menghilangkan akun berkurs asing', () => {
  const accounts = [
    { id: 'a1', name: 'Bank', currency: 'IDR', balance: 1000000, type: 'cash' },
    { id: 'a2', name: 'USD', currency: 'USD', balance: 100, type: 'cash' },
    { id: 'a3', name: 'Aneh', currency: 'ZZZ', balance: 500, type: 'cash' },
  ]
  const total = accounts.reduce((s, a) => s + convertOrKeep(signedAccountBalance(a), a.currency, 'IDR', RATES).value, 0)
  // 1.000.000 + 1.600.000 + 500 (nominal asli, bukan 0)
  assert.equal(total, 2600500)
})

test('ledger: transaksi berkurs asing tetap menggeser saldo akun', () => {
  const accounts = [{ id: 'a1', name: 'Aneh', currency: 'ZZZ', balance: 1000, type: 'cash' }]
  const tx = { type: 'expense', amount: 250, currency: 'ZZZ', account_id: 'a1' }
  const after = computeBalanceDelta(accounts, tx, 1, RATES)
  assert.equal(after[0].balance, 750)
  const reverted = computeBalanceDelta(after, tx, -1, RATES)
  assert.equal(reverted[0].balance, 1000)
})

test('convert asli tetap melempar error bila kurs hilang (kontrak lama)', () => {
  assert.throws(() => convert(10, 'ZZZ', 'IDR', RATES), /Missing exchange rate/)
})

test('fallback rates lengkap untuk mata uang umum', () => {
  assert.ok(FALLBACK_RATES.USD > 0)
  assert.ok(FALLBACK_RATES.IDR > 0)
  assert.ok(FALLBACK_RATES.MYR > 0)
})

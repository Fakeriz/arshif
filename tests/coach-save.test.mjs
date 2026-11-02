import assert from 'node:assert/strict'
import test from 'node:test'
import { buildCoachTx, draftTxId, resolveAccount } from '../lib/coach-save.js'

const accounts = [
  { id: 'acc-bca', name: 'BCA', currency: 'IDR' },
  { id: 'acc-wise', name: 'Wise USD', currency: 'USD' },
]

test('id deterministik: kunci sama menghasilkan id sama, kunci beda id beda', () => {
  const a = draftTxId('chat:1')
  const b = draftTxId('chat:1')
  const c = draftTxId('chat:2')
  assert.equal(a, b)
  assert.notEqual(a, c)
  assert.match(a, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
})

test('akun dicocokkan persis dulu, lalu salah satu arah', () => {
  assert.equal(resolveAccount({ account_name: 'BCA' }, accounts).id, 'acc-bca')
  assert.equal(resolveAccount({ account_name: 'bca' }, accounts).id, 'acc-bca')
  assert.equal(resolveAccount({ account_name: 'Wise' }, accounts).id, 'acc-wise')
  assert.equal(resolveAccount({ account_name: 'Tidak Ada' }, accounts), null)
})

test('satu akun saja dipakai walau nama tidak disebut', () => {
  assert.equal(resolveAccount({}, [accounts[0]]).id, 'acc-bca')
  assert.equal(resolveAccount({}, accounts), null)
})

test('payload transaksi memakai field form, nominal dan mata uang dari draft', () => {
  const tx = buildCoachTx(
    { type: 'expense', amount: 25000, currency: 'IDR', category: 'food', note: 'Kopi', account_name: 'BCA' },
    { accounts, home: 'IDR', id: 'tx-1' }
  )
  assert.equal(tx.id, 'tx-1')
  assert.equal(tx.amount, 25000)
  assert.equal(tx.currency, 'IDR')
  assert.equal(tx.category, 'food')
  assert.equal(tx.account_id, 'acc-bca')
  assert.equal(tx.note, 'Kopi')
  assert.ok(tx.date)
})

test('draft tanpa nominal atau tanpa category tetap aman', () => {
  assert.equal(buildCoachTx({ amount: 0 }), null)
  const tx = buildCoachTx({ type: 'income', amount: 100 }, { accounts, home: 'IDR' })
  assert.equal(tx.category, 'salary')
  assert.equal(tx.currency, 'IDR')
  assert.equal(tx.payment_method, 'bank')
})

test('tanggal dari draft dipakai apa adanya, tanpa konversi zona', () => {
  const tx = buildCoachTx({ amount: 10, date: '2026-11-02T08:30:00.000Z' }, { accounts, home: 'IDR' })
  assert.equal(tx.date, '2026-11-02T08:30:00.000Z')
})

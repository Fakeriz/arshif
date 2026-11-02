// Regresi: jalur fallback edit transaksi harus memakai snapshot akun HASIL
// revert, bukan snapshot asli. applyTxToBalances membaca account.balance dari
// array yang diterima, jadi meneruskan array basi membuat delta baru dihitung
// dari saldo sebelum revert -> saldo akhir meleset sebesar delta lama.
import assert from 'node:assert/strict'
import test from 'node:test'
import { applyTxToBalances, applyTransactionReplacement } from '../lib/ledger.js'

function recordingStore() {
  const writes = []
  return {
    mode: 'guest',
    writes,
    async updateAccount(id, patch) {
      writes.push({ id, balance: patch.balance })
      return { id, ...patch }
    },
  }
}

const accounts = [{ id: 'acc-1', name: 'Bank', currency: 'IDR', balance: 1000, type: 'cash' }]
const oldTx = { id: 'tx-1', type: 'expense', amount: 100, currency: 'IDR', account_id: 'acc-1' }
const newTx = { id: 'tx-1', type: 'expense', amount: 250, currency: 'IDR', account_id: 'acc-1' }

test('urutan benar: revert lalu apply pada snapshot berurutan = 850', async () => {
  const store = recordingStore()
  const afterRevert = await applyTxToBalances(store, accounts, oldTx, -1, {})
  const afterApply = await applyTxToBalances(store, afterRevert, newTx, 1, {})
  assert.equal(afterApply[0].balance, 850)
  assert.deepEqual(store.writes.map((w) => w.balance), [1100, 850])
})

test('urutan salah (snapshot basi) menghasilkan 750 - inilah bug lama', async () => {
  const store = recordingStore()
  await applyTxToBalances(store, accounts, oldTx, -1, {})
  const afterApply = await applyTxToBalances(store, accounts, newTx, 1, {})
  assert.equal(afterApply[0].balance, 750, 'membuktikan snapshot basi meleset 100')
})

test('applyTransactionReplacement memberi hasil yang sama tanpa double-count', async () => {
  const store = recordingStore()
  const result = await applyTransactionReplacement(store, accounts, { oldTx, newTx, rates: {} })
  assert.equal(result[0].balance, 850)
  assert.deepEqual(store.writes.map((w) => w.balance), [1100, 850])
})

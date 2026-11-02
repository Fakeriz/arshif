import assert from 'node:assert/strict'
import test from 'node:test'
import { saveTxWithBalance } from '../lib/tx-save.js'

const tx = { type: 'expense', amount: 50000, currency: 'IDR', category: 'food', account_id: 'acc-1' }

test('jalur context dipakai bila tersedia, store langsung tidak disentuh', async () => {
  let hits = 0
  const result = await saveTxWithBalance({
    tx,
    addTransaction: async (t) => { hits++; return { ...t, id: 'ctx-1' } },
    store: { createTransaction: async () => { throw new Error('must not be called') } },
  })
  assert.equal(hits, 1)
  assert.equal(result.id, 'ctx-1')
})

test('fallback: baris dibuat lalu saldo akun dimutasi lewat store.updateAccount', async () => {
  let created = null
  const updates = []
  const store = {
    mode: 'guest',
    createTransaction: async (t) => { created = { ...t, id: 'tx-9' }; return created },
    updateAccount: async (id, patch) => { updates.push([id, patch]); return { id, ...patch } },
  }
  const accounts = [{ id: 'acc-1', balance: 200000, currency: 'IDR' }]
  const out = await saveTxWithBalance({ tx, store, accounts, rates: {} })
  assert.equal(out.id, 'tx-9')
  assert.equal(updates.length, 1)
  assert.equal(updates[0][0], 'acc-1')
  assert.equal(updates[0][1].balance, 150000)
})

test('tanpa addTransaction maupun store langsung: gagal dengan pesan jelas', async () => {
  await assert.rejects(
    () => saveTxWithBalance({ tx, store: {} }),
    /no transaction store available/
  )
})

import assert from 'node:assert/strict'
import test from 'node:test'
import { applyTransactionReplacement, buildTransferWithFeeTransactions, computeBalanceDelta, evaluateExpression, signedAccountBalance } from '../lib/ledger.js'
import { convert, safeConvert } from '../lib/rates.js'
import { allocateEqualShares, roundMoney } from '../lib/currencies.js'

test('editing an expense applies the new amount exactly once', () => {
  const accounts = [{ id: 'a', currency: 'USD', balance: 950 }]
  const oldTx = { type: 'expense', amount: 50, currency: 'USD', account_id: 'a' }
  const newTx = { type: 'expense', amount: 30, currency: 'USD', account_id: 'a' }
  const reverted = computeBalanceDelta(accounts, oldTx, -1, { USD: 1 })
  const updated = computeBalanceDelta(reverted, newTx, 1, { USD: 1 })
  assert.equal(updated[0].balance, 970)
})

test('persisted transaction replacement writes the correct final balance', async () => {
  const writes = []
  const store = { updateAccount: async (id, patch) => writes.push({ id, balance: patch.balance }) }
  const accounts = [{ id: 'a', currency: 'USD', balance: 950 }]
  await applyTransactionReplacement(store, accounts, {
    oldTx: { type: 'expense', amount: 50, currency: 'USD', account_id: 'a' },
    newTx: { type: 'expense', amount: 30, currency: 'USD', account_id: 'a' },
    rates: { USD: 1 },
  })
  assert.deepEqual(writes, [{ id: 'a', balance: 1000 }, { id: 'a', balance: 970 }])
})

test('conversion requires known rates and does not silently return the source amount', () => {
  assert.throws(() => convert(10, 'USD', 'XXX', { USD: 1 }), /Missing exchange rate/)
  assert.equal(safeConvert(10, 'USD', 'XXX', { USD: 1 }), null)
})

test('equal split remainder is allocated so shares reconstruct total', () => {
  const shares = allocateEqualShares(100, 3, 'USD')
  assert.deepEqual(shares, [33.33, 33.33, 33.34])
  assert.equal(roundMoney(shares.reduce((a, b) => a + b, 0), 'USD'), 100)
})

test('rounding is symmetric for negative half-cent values', () => {
  assert.equal(roundMoney(-2.675, 'USD'), -2.68)
})

test('credit-card accounts are liabilities and move in the right direction', async () => {
  assert.equal(signedAccountBalance({ type: 'card', balance: 250 }), -250)
  const writes = []
  const store = { updateAccount: async (id, patch) => { writes.push(patch.balance) } }
  const account = { id: 'card', type: 'card', currency: 'USD', balance: 250 }
  await import('../lib/ledger.js').then(({ applyTxToBalances }) => applyTxToBalances(store, [account], {
    type: 'expense', amount: 50, currency: 'USD', account_id: 'card'
  }, 1, { USD: 1 }))
  await import('../lib/ledger.js').then(({ applyTxToBalances }) => applyTxToBalances(store, [{ ...account, balance: 300 }], {
    type: 'income', amount: 50, currency: 'USD', account_id: 'card'
  }, 1, { USD: 1 }))
  assert.deepEqual(writes, [300, 250])
})

test('liability account balances reduce net worth', () => {
  assert.equal(signedAccountBalance({ type: 'credit', balance: 250 }), -250)
  assert.equal(signedAccountBalance({ type: 'credit', balance: -250 }), -250)
  assert.equal(signedAccountBalance({ type: 'bank', balance: 250 }), 250)
})

test('transaction replacement restores the old balance when a later write fails', async () => {
  const writes = []
  let calls = 0
  const store = { updateAccount: async (id, patch) => {
    calls += 1
    writes.push(patch.balance)
    if (calls === 2) throw new Error('simulated failure')
  } }
  const { applyTransactionReplacement } = await import('../lib/ledger.js')
  await assert.rejects(() => applyTransactionReplacement(store, [{ id: 'a', currency: 'USD', balance: 950 }], {
    oldTx: { type: 'expense', amount: 50, currency: 'USD', account_id: 'a' },
    newTx: { type: 'expense', amount: 30, currency: 'USD', account_id: 'a' },
    rates: { USD: 1 },
  }))
  assert.deepEqual(writes, [1000, 970, 950])
})

test('transfer fee is persisted as a separate expense so it is not lost', () => {
  const [transfer, feeTx] = buildTransferWithFeeTransactions({
    id: 't1', type: 'transfer', amount: 100, fee: 5, currency: 'USD', account_id: 'a', to_account_id: 'b', note: 'Rent',
  })
  assert.equal(transfer.fee, 0)
  assert.equal(feeTx.type, 'expense')
  assert.equal(feeTx.category, 'transfer')
  assert.equal(feeTx.amount, 5)
  assert.equal(feeTx.to_account_id, null)
})

test('calculator division by zero returns a safe result', () => {
  assert.equal(evaluateExpression('5/0'), 0)
})

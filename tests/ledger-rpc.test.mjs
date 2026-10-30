import assert from 'node:assert/strict'
import test from 'node:test'

// Test jalur RPC applyTxToBalances: sukses, no-op idempoten, 404 -> fallback,
// error jaringan -> fallback, dan store non-supabase (guest) yang tidak boleh
// pernah memanggil RPC.
const { applyTxToBalances, setBalanceRpcClient } = await import('../lib/ledger.js')

function resetRpc() {
  setBalanceRpcClient(null)
}

test.afterEach(() => resetRpc())

function makeStore(writes) {
  return {
    mode: 'supabase',
    updateAccount: async (id, patch) => {
      writes.push({ id, balance: patch.balance })
      return { id, ...patch }
    },
  }
}

test('RPC sukses menulis saldo sekali lewat RPC, bukan updateAccount', async () => {
  const rpcCalls = []
  setBalanceRpcClient({
    rpc: async (name, args) => {
      rpcCalls.push({ name, args })
      return { data: { ok: true, applied: true, updated: 1 }, error: null }
    },
  })
  const writes = []
  const accounts = [{ id: 'a', currency: 'USD', balance: 1000 }]
  const result = await applyTxToBalances(makeStore(writes), accounts, {
    id: 'tx-1', type: 'expense', amount: 50, currency: 'USD', account_id: 'a',
  }, 1, { USD: 1 })

  assert.equal(rpcCalls.length, 1, 'RPC dipanggil tepat sekali')
  assert.equal(rpcCalls[0].name, 'apply_transaction_balance_delta')
  assert.deepEqual(rpcCalls[0].args.p_account_deltas, [{ account_id: 'a', delta: -50 }])
  assert.equal(rpcCalls[0].args.p_sign, 1)
  assert.equal(writes.length, 0, 'tidak ada fallback updateAccount saat RPC sukses')
  assert.equal(result[0].balance, 950, 'saldo lokal disinkronkan')
})

test('transfer memanggil RPC sekali untuk kedua akun sekaligus', async () => {
  const rpcCalls = []
  setBalanceRpcClient({
    rpc: async (name, args) => {
      rpcCalls.push(args)
      return { data: { ok: true, applied: true, updated: 2 }, error: null }
    },
  })
  const writes = []
  const accounts = [
    { id: 'a', currency: 'USD', balance: 1000 },
    { id: 'b', currency: 'USD', balance: 200 },
  ]
  const result = await applyTxToBalances(makeStore(writes), accounts, {
    id: 'tx-2', type: 'transfer', amount: 100, currency: 'USD', account_id: 'a', to_account_id: 'b',
  }, 1, { USD: 1 })

  assert.equal(rpcCalls.length, 1, 'satu RPC untuk semua akun (atomik)')
  assert.equal(rpcCalls[0].p_account_deltas.length, 2)
  assert.equal(writes.length, 0)
  assert.equal(result[0].balance, 900)
  assert.equal(result[1].balance, 300)
})

test('RPC no-op idempoten tidak menulis ulang saldo', async () => {
  setBalanceRpcClient({
    rpc: async () => ({ data: { ok: true, applied: false, idempotent: true }, error: null }),
  })
  const writes = []
  const accounts = [{ id: 'a', currency: 'USD', balance: 950 }]
  const result = await applyTxToBalances(makeStore(writes), accounts, {
    id: 'tx-1', type: 'expense', amount: 50, currency: 'USD', account_id: 'a',
  }, 1, { USD: 1 })

  assert.equal(writes.length, 0, 'tidak ada tulisan saat server bilang sudah diterapkan')
  assert.equal(result[0].balance, 950)
})

test('RPC 404 (fungsi belum dimigrasikan) jatuh ke updateAccount', async () => {
  setBalanceRpcClient({
    rpc: async () => ({ data: null, error: { code: 'PGRST202', message: 'Could not find the function public.apply_transaction_balance_delta' } }),
  })
  const writes = []
  const accounts = [{ id: 'a', currency: 'USD', balance: 1000 }]
  const result = await applyTxToBalances(makeStore(writes), accounts, {
    id: 'tx-3', type: 'expense', amount: 50, currency: 'USD', account_id: 'a',
  }, 1, { USD: 1 })

  assert.deepEqual(writes, [{ id: 'a', balance: 950 }])
  assert.equal(result[0].balance, 950)
})

test('RPC error jaringan jatuh ke updateAccount', async () => {
  setBalanceRpcClient({
    rpc: async () => { throw new Error('Failed to fetch') },
  })
  const writes = []
  const accounts = [{ id: 'a', currency: 'USD', balance: 1000 }]
  const result = await applyTxToBalances(makeStore(writes), accounts, {
    id: 'tx-4', type: 'expense', amount: 50, currency: 'USD', account_id: 'a',
  }, 1, { USD: 1 })

  assert.deepEqual(writes, [{ id: 'a', balance: 950 }])
  assert.equal(result[0].balance, 950)
})

test('revert memakai p_sign = -1', async () => {
  const rpcCalls = []
  setBalanceRpcClient({
    rpc: async (name, args) => {
      rpcCalls.push(args)
      return { data: { ok: true, applied: true, updated: 1 }, error: null }
    },
  })
  const writes = []
  await applyTxToBalances(makeStore(writes), [{ id: 'a', currency: 'USD', balance: 950 }], {
    id: 'tx-5', type: 'expense', amount: 50, currency: 'USD', account_id: 'a',
  }, -1, { USD: 1 })

  assert.equal(rpcCalls[0].p_sign, -1)
  assert.equal(writes.length, 0)
})

test('store guest (mode non-supabase) tidak pernah memanggil RPC', async () => {
  let rpcCalled = false
  setBalanceRpcClient({
    rpc: async () => {
      rpcCalled = true
      return { data: { ok: true, applied: true }, error: null }
    },
  })
  const writes = []
  const guestStore = { mode: 'guest', updateAccount: async (id, patch) => writes.push({ id, balance: patch.balance }) }
  const result = await applyTxToBalances(guestStore, [{ id: 'a', currency: 'USD', balance: 1000 }], {
    id: 'tx-6', type: 'expense', amount: 50, currency: 'USD', account_id: 'a',
  }, 1, { USD: 1 })

  assert.equal(rpcCalled, false, 'guest tidak punya RPC')
  assert.deepEqual(writes, [{ id: 'a', balance: 950 }])
  assert.equal(result[0].balance, 950)
})

test('transaksi tanpa id tidak memakai RPC (tidak ada kunci idempotensi)', async () => {
  let rpcCalled = false
  setBalanceRpcClient({
    rpc: async () => {
      rpcCalled = true
      return { data: { ok: true, applied: true }, error: null }
    },
  })
  const writes = []
  await applyTxToBalances(makeStore(writes), [{ id: 'a', currency: 'USD', balance: 1000 }], {
    type: 'expense', amount: 50, currency: 'USD', account_id: 'a',
  }, 1, { USD: 1 })

  assert.equal(rpcCalled, false)
  assert.deepEqual(writes, [{ id: 'a', balance: 950 }])
})

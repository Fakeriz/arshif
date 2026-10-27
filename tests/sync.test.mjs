import assert from 'node:assert/strict'
import test from 'node:test'

// Patch window BEFORE importing sync.js so the typeof window guard passes
global.window = {}
const store = {}
global.localStorage = {
  getItem(k) { const v = store[k]; return v ?? null },
  setItem(k, v) { store[k] = v },
  removeItem() {},
  clear() { Object.keys(store).forEach(k => delete store[k]) },
  get length() { return Object.keys(store).length },
  key(n) { return Object.keys(store)[n] ?? null },
}

const { flushSyncQueue } = await import('../lib/sync.js')

async function runFlush(payloads, mockSupabase) {
  store['arshif_sync_queue'] = JSON.stringify(payloads.map(p => ({
    id: p.id, action: p.action || 'insert', table: p.table || 'transactions',
    payload: { id: p.id, ...p.payload }, timestamp: Date.now(),
  })))
  store['arshif_offline_txs'] = '[]'
  const notifications = []
  await flushSyncQueue(mockSupabase, s => notifications.push(s))
  return notifications
}

test('non-network errors surface hasFailures and keep items in queue', async () => {
  const notifications = await runFlush(
    [
      { id: 'a1', payload: { user_id: 'u1', type: 'expense', amount: 100 } },
      { id: 'a2', payload: { user_id: 'u1', type: 'income', amount: 200 } },
    ],
    {
      from: () => ({
        upsert: async () => ({ data: null, error: { message: 'row violates RLS', code: 'PGRST300' } }),
        delete: async () => ({ data: null, error: { message: 'not found', code: 'PGRST101' } }),
      }),
    }
  )
  const remaining = JSON.parse(global.localStorage.getItem('arshif_sync_queue') ?? '[]')
  // Items stay in queue for retry
  assert.equal(remaining.length, 2, 'both items remain for retry on non-network failure')
  // The LAST notification (from the second broadcastSyncState in finally) must
  // carry the failure signal so HomeTab can toast it.
  const last = notifications[notifications.length - 1]
  assert.ok(last.hasFailures === true, 'last notification must have hasFailures=true')
  assert.ok(last.failedCount > 0, 'last notification must report failedCount > 0')
})

test('network errors break the loop and preserve only unprocessed items', async () => {
  let callCount = 0
  const notifications = await runFlush(
    [
      { id: 'ok1', payload: { user_id: 'u1', type: 'expense', amount: 50 } },
      { id: 'fail1', payload: { user_id: 'u1', type: 'expense', amount: 60 } },
    ],
    {
      from: () => ({
        upsert: async () => {
          callCount++
          if (callCount === 1) return { data: { id: 'ok1' }, error: null }
          return { data: null, error: { message: 'Failed to fetch', code: 'FETCH_ERR' } }
        },
        delete: async () => ({ data: null, error: null }),
      }),
    }
  )
  // ok1 succeeded → removed; fail1 caused network break → stays.
  const remaining = JSON.parse(global.localStorage.getItem('arshif_sync_queue') ?? '[]')
  assert.equal(remaining.length, 1, 'only the network-failed item remains after break')
  assert.equal(remaining[0].id, 'fail1')
  // Last notification carries the outcome
  const last = notifications[notifications.length - 1]
  assert.equal(last.queueCount, 1, 'queue count reflects one remaining item')
})

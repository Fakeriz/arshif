import assert from 'node:assert/strict'
import test from 'node:test'

// Test integrasi lib/store.js terhadap PostgREST (supabase-js) dengan fetch
// di-mock: migrasi metadata localStorage -> kolom DB, pagination listTransactions,
// dan perilaku kalau kolom DB belum ada.
//
// Catatan: supabase-js menangkap referensi global fetch saat klien dibuat (di
// waktu import), jadi mock harus dipasang SEBELUM ./lib/store.js diimpor.
process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'http://supabase.test'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= 'test-anon-key'

// --- Lingkungan browser minimal -------------------------------------------------
const lsStore = new Map()
global.window = {}
global.localStorage = {
  getItem: (k) => (lsStore.has(k) ? lsStore.get(k) : null),
  setItem: (k, v) => lsStore.set(k, String(v)),
  removeItem: (k) => lsStore.delete(k),
  clear: () => lsStore.clear(),
  get length() { return lsStore.size },
  key: (n) => Array.from(lsStore.keys())[n] ?? null,
}

// --- Mock PostgREST --------------------------------------------------------------
const DRIVE_URL = 'https://drive.google.com/file/d/FILE123/view'

let state = { rows: [], patches: [], posts: [], patchError: null, calls: [] }

function jsonResponse(data, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: { get: () => null },
    text: async () => (status === 204 || data === null ? '' : JSON.stringify(data)),
  }
}

function param(params, key) {
  const raw = params.get(key)
  return raw && raw.startsWith('eq.') ? raw.slice(3) : raw
}

global.fetch = async (url, options = {}) => {
  const parsed = new URL(url)
  const params = parsed.searchParams
  const method = options.method || 'GET'
  const path = parsed.pathname.replace(/^\/rest\/v1\//, '')
  const body = options.body ? JSON.parse(options.body) : null
  state.calls.push({ path, method, params, body })

  if (path !== 'transactions') return jsonResponse([])

  if (method === 'GET' && params.get('select') === 'id,receipt_url') {
    return jsonResponse(
      state.rows.filter((r) => r.receipt_url).map((r) => ({ id: r.id, receipt_url: r.receipt_url }))
    )
  }

  if (method === 'GET' && params.get('select') === 'split,storage_provider,receipt_cache') {
    const row = state.rows.find((r) => r.id === param(params, 'id'))
    return jsonResponse(row
      ? [{ split: row.split ?? null, storage_provider: row.storage_provider ?? null, receipt_cache: row.receipt_cache ?? null }]
      : [])
  }

  if (method === 'GET' && params.get('select') === '*') {
    const offset = Number(params.get('offset') || 0)
    const limit = Number(params.get('limit') || 200)
    const sorted = [...state.rows].sort((a, b) => String(b.date).localeCompare(String(a.date)))
    return jsonResponse(sorted.slice(offset, offset + limit))
  }

  if (method === 'POST') {
    state.posts.push(body)
    return jsonResponse([{ id: body?.id || 'server-id', created_at: '2026-10-30T00:00:00Z' }], 201)
  }

  if (method === 'PATCH') {
    if (state.patchError) return jsonResponse(state.patchError, 400)
    const id = param(params, 'id')
    const row = state.rows.find((r) => r.id === id)
    state.patches.push({ id, patch: body })
    if (row) Object.assign(row, body)
    return jsonResponse(null, 204)
  }

  return jsonResponse([])
}

const { createStore } = await import('../lib/store.js')

function reset(rows = [], opts = {}) {
  lsStore.clear()
  state = { rows: rows.map((r) => ({ ...r })), patches: [], posts: [], patchError: opts.patchError || null, calls: [] }
}

function seedLegacyKeys() {
  lsStore.set('arshif_tx_split_tx1', JSON.stringify([{ user: 'A', share: 60 }]))
  lsStore.set('arshif_tx_storage_tx1', 'google_drive')
  lsStore.set(`arshif_receipt_cache_${DRIVE_URL}`, 'data:image/jpeg;base64,PREVIEW1')
  lsStore.set('arshif_tx_split_tx2', JSON.stringify([{ user: 'B', share: 40 }]))
}

test('migrasi sekali-jalan memindahkan split/storage/receipt ke kolom DB lalu menghapus key', async () => {
  reset([
    { id: 'tx1', date: '2026-10-01', receipt_url: DRIVE_URL, split: null, storage_provider: null, receipt_cache: null },
    { id: 'tx2', date: '2026-09-01', receipt_url: null, split: null, storage_provider: null, receipt_cache: null },
  ])
  seedLegacyKeys()

  const store = createStore({ user: { id: 'u1' } })
  const list = await store.listTransactions()

  const tx1 = state.rows.find((r) => r.id === 'tx1')
  assert.deepEqual(tx1.split, [{ user: 'A', share: 60 }], 'split tx1 masuk kolom DB')
  assert.equal(tx1.storage_provider, 'google_drive')
  assert.equal(tx1.receipt_cache, 'data:image/jpeg;base64,PREVIEW1')
  assert.deepEqual(state.rows.find((r) => r.id === 'tx2').split, [{ user: 'B', share: 40 }])

  assert.equal(lsStore.has('arshif_tx_split_tx1'), false, 'key split lama dihapus')
  assert.equal(lsStore.has('arshif_tx_storage_tx1'), false, 'key storage lama dihapus')
  assert.equal(lsStore.has(`arshif_receipt_cache_${DRIVE_URL}`), false, 'key receipt lama dihapus')
  assert.equal(lsStore.has('arshif_tx_split_tx2'), false)

  const row1 = list.find((r) => r.id === 'tx1')
  assert.deepEqual(row1.split, [{ user: 'A', share: 60 }], 'hasil baca memakai kolom DB')
  assert.equal(row1.storage_provider, 'google_drive')
  assert.equal(row1.receipt_preview, 'data:image/jpeg;base64,PREVIEW1')

  const patchesBefore = state.patches.length
  await store.listTransactions()
  assert.equal(state.patches.length, patchesBefore, 'migrasi tidak diulang pada pemanggilan kedua')
  assert.equal(lsStore.get('arshif_tx_meta_migrated_u1'), 'true', 'flag migrasi sekali-jalan terpasang')
})

test('migrasi dibatalkan dan key dipertahankan kalau kolom DB belum ada', async () => {
  reset(
    [{ id: 'tx1', date: '2026-10-01', receipt_url: DRIVE_URL, split: null, storage_provider: null, receipt_cache: null }],
    { patchError: { code: 'PGRST204', message: "Could not find the 'split' column of 'transactions' in the schema cache" } }
  )
  seedLegacyKeys()

  const store = createStore({ user: { id: 'u1' } })
  await store.listTransactions()

  assert.equal(lsStore.has('arshif_tx_split_tx1'), true, 'key lokal dipertahankan')
  assert.equal(lsStore.has('arshif_tx_storage_tx1'), true)
  assert.equal(lsStore.has(`arshif_receipt_cache_${DRIVE_URL}`), true)
  assert.equal(lsStore.has('arshif_tx_meta_migrated_u1'), false, 'flag tidak dipasang, migrasi dicoba lagi nanti')
})

test('listTransactions memakai offset/limit batch 200 berurutan sampai data habis', async () => {
  const rows = []
  for (let i = 0; i < 450; i++) {
    rows.push({ id: `tx${String(i).padStart(3, '0')}`, date: `2026-10-${String((i % 28) + 1).padStart(2, '0')}`, receipt_url: null })
  }
  reset(rows)

  const store = createStore({ user: { id: 'u1' } })
  const list = await store.listTransactions()

  assert.equal(list.length, 450, 'semua baris terambil, tidak dipotong di 150')
  const pageCalls = state.calls.filter((c) => c.method === 'GET' && c.params.get('select') === '*')
  assert.deepEqual(pageCalls.map((c) => Number(c.params.get('offset'))), [0, 200, 400])
  assert.deepEqual(pageCalls.map((c) => Number(c.params.get('limit'))), [200, 200, 200])
  assert.ok(pageCalls.every((c) => c.params.get('order')), 'query tetap terurut agar pagination stabil')
})

test('listTransactions menggabungkan data offline tanpa duplikasi setelah pagination', async () => {
  reset([
    { id: 'tx1', date: '2026-10-05', receipt_url: null, amount: 100 },
    { id: 'tx2', date: '2026-10-04', receipt_url: null, amount: 200 },
  ])
  // Baris offline: satu update pada tx yang sudah tersinkron + satu baris baru
  lsStore.set('arshif_offline_txs', JSON.stringify([
    { id: 'tx1', date: '2026-10-05', amount: 150, _synced: false },
    { id: 'tx3', date: '2026-10-03', amount: 300, _synced: false },
  ]))

  const store = createStore({ user: { id: 'u1' } })
  const list = await store.listTransactions()

  assert.equal(list.length, 3, 'tidak ada duplikat: tx1 di-merge, bukan ditambah')
  assert.equal(list.find((r) => r.id === 'tx1').amount, 150, 'versi offline menang')
  assert.equal(list.find((r) => r.id === 'tx1')._synced, false)
  assert.equal(list.find((r) => r.id === 'tx3')._synced, false)
  assert.equal(list.find((r) => r.id === 'tx2')._synced, true, 'baris server tetap _synced')
  // Urutan menurun menurut tanggal
  assert.deepEqual(list.map((r) => r.id), ['tx1', 'tx2', 'tx3'])
})

test('updateTransaction menulis split ke kolom DB dan membersihkan key lama', async () => {
  reset([{ id: 'tx1', date: '2026-10-01', receipt_url: null, split: [{ user: 'A', share: 60 }], storage_provider: null, receipt_cache: null }])
  lsStore.set('arshif_tx_split_tx1', JSON.stringify([{ user: 'A', share: 60 }]))

  const store = createStore({ user: { id: 'u1' } })
  await store.updateTransaction('tx1', { split: [{ user: 'A', share: 30 }, { user: 'B', share: 30 }] })

  const patch = state.patches.find((p) => p.id === 'tx1')
  assert.ok(patch, 'PATCH terkirim ke server')
  assert.deepEqual(patch.patch.split, [{ user: 'A', share: 30 }, { user: 'B', share: 30 }])
  assert.equal(lsStore.has('arshif_tx_split_tx1'), false, 'key lama dibersihkan setelah tersimpan')
})

test('createTransaction mengirim split/storage_provider/receipt_cache ke kolom DB', async () => {
  reset([])

  const store = createStore({ user: { id: 'u1' } })
  await store.createTransaction({
    type: 'expense', amount: 25, currency: 'USD', account_id: 'acc1',
    receipt_url: DRIVE_URL, split: [{ user: 'A', share: 25 }], receipt_preview: 'data:image/jpeg;base64,NEW',
  })

  assert.equal(state.posts.length, 1)
  const inserted = state.posts[0]
  assert.deepEqual(inserted.split, [{ user: 'A', share: 25 }])
  assert.equal(inserted.storage_provider, 'google_drive')
  assert.equal(inserted.receipt_cache, 'data:image/jpeg;base64,NEW')
  assert.equal(lsStore.has('arshif_tx_storage_new-tx'), false, 'tidak menulis key localStorage lagi')
  assert.equal(lsStore.has(`arshif_receipt_cache_${DRIVE_URL}`), false)
})

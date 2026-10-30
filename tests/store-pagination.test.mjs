import assert from 'node:assert/strict'
import test from 'node:test'

// Test pagination fetchAllRows dari lib/store.js: batch 200 berulang sampai
// habis, menggantikan .limit(150) yang memotong riwayat transaksi.
// store.js mengimpor supabase.js yang butuh env, diset sebelum import dinamis.
process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'http://localhost:9999'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= 'test-anon-key'

const { fetchAllRows } = await import('../lib/store.js')

test('pagination mengambil semua halaman sampai batch terakhir tidak penuh', async () => {
  const ranges = []
  const total = 450
  const result = await fetchAllRows((from, to) => {
    ranges.push([from, to])
    const batch = []
    for (let i = from; i <= Math.min(to, total - 1); i++) batch.push({ id: `t${i}` })
    return Promise.resolve({ data: batch, error: null })
  })

  assert.equal(result.rows.length, 450, 'semua 450 baris terambil')
  assert.equal(result.error, null)
  assert.deepEqual(ranges, [[0, 199], [200, 399], [400, 599]], 'range batch 200 berurutan')
})

test('pagination berhenti setelah satu batch kalau data kurang dari pageSize', async () => {
  const ranges = []
  const result = await fetchAllRows((from, to) => {
    ranges.push([from, to])
    return Promise.resolve({ data: [{ id: 'only' }], error: null })
  })

  assert.equal(result.rows.length, 1)
  assert.equal(ranges.length, 1, 'tidak ada request halaman tambahan')
})

test('pagination tepat pada kelipatan pageSize melakukan satu request konfirmasi', async () => {
  const ranges = []
  let served = 0
  const result = await fetchAllRows((from, to) => {
    ranges.push([from, to])
    // Hanya 200 baris tersedia: halaman pertama penuh, halaman kedua kosong.
    const batch = served === 0
      ? Array.from({ length: 200 }, (_, i) => ({ id: `t${i}` }))
      : []
    served += 1
    return Promise.resolve({ data: batch, error: null })
  })

  assert.equal(result.rows.length, 200)
  assert.equal(ranges.length, 2, 'batch penuh memicu request konfirmasi halaman kosong')
  assert.deepEqual(ranges, [[0, 199], [200, 399]])
})

test('error pada halaman mana pun menghentikan pagination dan diteruskan', async () => {
  let calls = 0
  const result = await fetchAllRows((from, to) => {
    calls += 1
    if (calls === 2) return Promise.resolve({ data: null, error: { message: 'boom' } })
    const batch = []
    for (let i = from; i <= to; i++) batch.push({ id: `t${i}` })
    return Promise.resolve({ data: batch, error: null })
  })

  assert.equal(result.rows.length, 200, 'baris halaman pertama tetap dikembalikan')
  assert.ok(result.error, 'error diteruskan ke pemanggil')
})

test('pagination dihentikan batas pengaman maxRows', async () => {
  const ranges = []
  const result = await fetchAllRows((from, to) => {
    ranges.push([from, to])
    const batch = []
    for (let i = from; i <= to; i++) batch.push({ id: `t${i}` })
    return Promise.resolve({ data: batch, error: null })
  }, 200, 600)

  assert.equal(result.rows.length, 600, 'berhenti di batas maxRows')
  assert.equal(ranges.length, 3)
})

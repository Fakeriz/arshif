import assert from 'node:assert/strict'
import test from 'node:test'

// Kontrak payload voice log: client mengirim akun ringkas, server menormalisasi.
function normalizeAccounts(arr, homeCurrency = 'IDR') {
  return (Array.isArray(arr) ? arr : []).map((a) => {
    if (typeof a === 'string') {
      const m = a.match(/^(.*?)\s*\(([A-Z]{3})\)\s*$/)
      return { name: (m ? m[1] : a).trim(), currency: (m ? m[2] : homeCurrency) }
    }
    return (typeof a === 'object' && a !== null)
      ? { name: String(a.name || '').trim(), currency: String(a.currency || homeCurrency).toUpperCase().slice(0, 3) }
      : null
  }).filter((a) => a && a.name)
}

test('string Nama (CUR) dipetakan ke nama + currency', () => {
  assert.deepEqual(normalizeAccounts(['BCA (IDR)', 'GoPay (USD)']), [
    { name: 'BCA', currency: 'IDR' },
    { name: 'GoPay', currency: 'USD' },
  ])
})

test('objek lama {id,name,currency} tetap diterima, id diabaikan', () => {
  assert.deepEqual(normalizeAccounts([{ id: 'x', name: 'Cash', currency: 'idr' }]), [
    { name: 'Cash', currency: 'IDR' },
  ])
})

test('entri rusak dibuang, bukan membuat prompt gagal', () => {
  assert.deepEqual(normalizeAccounts([42, null, '   ']), [])
  assert.deepEqual(normalizeAccounts([]), [])
})

test('payload baru ~70% lebih pendek dari format lama', () => {
  const accounts = ['BCA', 'GoPay', 'Cash'].map((n, i) => ({ id: `id-${i}-uuid-panjang-sekali`, name: n, currency: 'IDR' }))
  const body = { text: 'beli kopi dua lima', homeCurrency: 'IDR', language: 'id', accounts }
  const categories = ['salary', 'food', 'groceries', 'transport', 'bills', 'shopping', 'entertainment', 'health', 'travel', 'education', 'business', 'other']
  const before = JSON.stringify({ ...body, categories }).length
  const after = JSON.stringify({ text: body.text, homeCurrency: 'IDR', language: 'id', accounts: accounts.map((a) => `${a.name} (${a.currency})`) }).length
  assert.ok((1 - after / before) >= 0.6, `hemat ${(Math.round((1 - after / before) * 100))}%, minimal 60%`)
})

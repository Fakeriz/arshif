import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildTransferWithFeeTransactions,
  createTransferWithFee,
  deleteTransferWithFee,
  feeRowsFor,
  replaceTransferWithFee,
  txWithChildFee,
} from '../lib/ledger.js'

// Store palsu yang mencatat setiap tulisan: cukup untuk melacak baris dan
// saldo tanpa Supabase. mode 'guest' memaksa jalur fallback updateAccount,
// jadi delta saldo terlihat sebagai tulisan eksplisit.
function makeStore(seedAccounts = []) {
  let seq = 0
  const rows = new Map()
  const accounts = new Map(seedAccounts.map((a) => [a.id, { ...a }]))
  const writes = []
  return {
    mode: 'guest',
    rows,
    accounts,
    writes,
    async createTransaction(t) {
      const id = t.id || `tx-${++seq}`
      const row = { ...t, id }
      rows.set(id, row)
      writes.push(['create', id])
      return row
    },
    async updateTransaction(id, patch) {
      const row = { ...(rows.get(id) || {}), ...patch }
      rows.set(id, row)
      writes.push(['update', id, patch])
      return row
    },
    async deleteTransaction(id) {
      rows.delete(id)
      writes.push(['delete', id])
      return true
    },
    async updateAccount(id, patch) {
      accounts.set(id, { ...(accounts.get(id) || { id }), ...patch })
      writes.push(['account', id, patch.balance])
      return accounts.get(id)
    },
  }
}

const seed = () => [
  { id: 'acc-1', balance: 1000, currency: 'IDR' },
  { id: 'acc-2', balance: 0, currency: 'IDR' },
]

const transfer = (fee = 5) => ({
  type: 'transfer',
  amount: 100,
  currency: 'IDR',
  home_currency: 'IDR',
  account_id: 'acc-1',
  to_account_id: 'acc-2',
  category: 'transfer',
  fee,
  date: '2026-11-04T10:00:00.000Z',
})

test('baris fee menunjuk induk lewat fee_of, bukan id turunan yang bukan uuid', () => {
  const [parent, feeRow] = buildTransferWithFeeTransactions({ ...transfer(), id: 'p-1' })
  assert.equal(parent.fee, 0, 'induk disimpan dengan fee 0 supaya tidak dihitung dua kali')
  assert.equal(feeRow.fee_of, 'p-1')
  assert.equal(feeRow.id, null, 'id fee dibiarkan kosong: "${id}_fee" bukan uuid valid')
  assert.equal(feeRow.amount, 5)
  assert.equal(feeRow.type, 'expense')
})

test('transfer tanpa fee tidak menghasilkan baris anak', () => {
  const rows = buildTransferWithFeeTransactions({ ...transfer(0) })
  assert.equal(rows.length, 1)
  assert.equal(rows[0].fee, 0)
})

test('simpan transfer berfee: induk + baris anak, saldo memuat fee sekali', async () => {
  const store = makeStore(seed())
  const result = await createTransferWithFee(store, seed(), transfer(5), {})

  const parentId = result.saved.id
  const feeId = result.fee.id
  assert.ok(parentId && feeId && parentId !== feeId)
  assert.equal(store.rows.get(parentId).fee, 0)
  assert.equal(store.rows.get(feeId).fee_of, parentId)
  assert.equal(store.rows.get(feeId).amount, 5)

  assert.equal(store.accounts.get('acc-1').balance, 895, '100 transfer + 5 fee keluar dari sumber')
  assert.equal(store.accounts.get('acc-2').balance, 100)
})

test('hapus transfer ikut menghapus baris fee dan mengembalikan saldo', async () => {
  const store = makeStore(seed())
  const created = await createTransferWithFee(store, seed(), transfer(5), {})
  const txList = [created.saved, created.fee]

  const fees = feeRowsFor(created.saved.id, txList)
  assert.equal(fees.length, 1)

  const afterDelete = await deleteTransferWithFee(store, created.accounts.map((a) => ({ ...a })), { tx: created.saved, fees, rates: {} })
  assert.equal(store.rows.size, 0, 'tidak ada baris fee yatim yang tertinggal')
  const source = afterDelete.find((a) => a.id === 'acc-1')
  const dest = afterDelete.find((a) => a.id === 'acc-2')
  assert.equal(source.balance, 1000)
  assert.equal(dest.balance, 0)
})

test('edit fee memakai baris anak yang sama, bukan membuat baris kedua', async () => {
  const store = makeStore(seed())
  const created = await createTransferWithFee(store, seed(), transfer(5), {})
  const oldTx = created.saved
  const oldFee = created.fee

  const accounts = await replaceTransferWithFee(store, created.accounts.map((a) => ({ ...a })), {
    oldTx,
    oldFee,
    newData: { ...transfer(12), id: oldTx.id },
    rates: {},
  })

  assert.equal(store.rows.size, 2, 'fee 5 -> 12 tidak boleh menambah baris')
  assert.equal(store.rows.get(oldFee.id).amount, 12)
  assert.equal(store.rows.get(oldFee.id).fee_of, oldTx.id)
  assert.equal(store.rows.get(oldTx.id).fee, 0)

  assert.equal(accounts.find((a) => a.id === 'acc-1').balance, 888, '100 + 12, bukan 100 + 5 + 12')
  assert.equal(accounts.find((a) => a.id === 'acc-2').balance, 100)
})

test('edit yang menghapus fee membuang baris anaknya', async () => {
  const store = makeStore(seed())
  const created = await createTransferWithFee(store, seed(), transfer(5), {})

  const accounts = await replaceTransferWithFee(store, created.accounts.map((a) => ({ ...a })), {
    oldTx: created.saved,
    oldFee: created.fee,
    newData: { ...transfer(0), id: created.saved.id },
    rates: {},
  })

  assert.equal(store.rows.size, 1)
  assert.equal(store.rows.has(created.fee.id), false)
  assert.equal(accounts.find((a) => a.id === 'acc-1').balance, 900)
})

test('edit yang menambah fee membuat baris anak dengan tautan induk', async () => {
  const store = makeStore(seed())
  const created = await createTransferWithFee(store, seed(), transfer(0), {})

  const accounts = await replaceTransferWithFee(store, created.accounts.map((a) => ({ ...a })), {
    oldTx: created.saved,
    oldFee: null,
    newData: { ...transfer(7), id: created.saved.id },
    rates: {},
  })

  const fees = [...store.rows.values()].filter((r) => r.fee_of === created.saved.id)
  assert.equal(fees.length, 1)
  assert.equal(fees[0].amount, 7)
  assert.equal(accounts.find((a) => a.id === 'acc-1').balance, 893)
})

test('form edit menerima nominal fee dari baris anak', () => {
  const parent = { id: 'p-1', type: 'transfer', amount: 100, fee: 0 }
  const txList = [parent, { id: 'f-1', fee_of: 'p-1', type: 'expense', amount: 9 }]
  const editable = txWithChildFee(parent, txList)
  assert.equal(editable.fee, 9)
  assert.equal(editable.fee_id, 'f-1')
  assert.equal(txWithChildFee(parent, []).fee, 0)
})

test('gagal menghapus baris fee mengembalikan saldo dan melempar error', async () => {
  const store = makeStore(seed())
  const created = await createTransferWithFee(store, seed(), transfer(5), {})
  const brokenStore = { ...store, deleteTransaction: async () => { throw new Error('delete ditolak') } }

  await assert.rejects(
    () => deleteTransferWithFee(brokenStore, created.accounts.map((a) => ({ ...a })), { tx: created.saved, fees: [created.fee], rates: {} }),
    /delete ditolak/
  )
  assert.equal(store.accounts.get('acc-1').balance, 895, 'revert fee sudah dibatalkan lagi; saldo tetap seperti setelah transfer')
  assert.ok(store.rows.has(created.saved.id), 'transfer induk tidak boleh hilang saat fee gagal dihapus')
})

// Penjaga statis: jalur simpan/edit/hapus transfer harus lewat helper di
// lib/ledger.js. Versi lama menulis baris fee langsung dari app/page.js dengan
// id "${id}_fee" (bukan uuid) dan tanpa tautan induk, jadi regresi ini tidak
// akan tertangkap test unit mana pun.
test('app/page.js memakai helper fee, bukan urutan tulis tangan', async () => {
  const { readFile } = await import('node:fs/promises')
  const page = await readFile(new URL('../app/page.js', import.meta.url), 'utf8')
  assert.match(page, /createTransferWithFee\(/)
  assert.match(page, /replaceTransferWithFee\(/)
  assert.match(page, /deleteTransferWithFee\(/)
  assert.doesNotMatch(page, /store\.createTransaction\(/, 'baris transaksi ditulis lewat helper, bukan langsung dari page')
  assert.doesNotMatch(page, /`\$\{[^}]+\}_fee`/, 'id fee tidak boleh diturunkan dari id induk (bukan uuid)')

  const store = await readFile(new URL('../lib/store/supabase-store.js', import.meta.url), 'utf8')
  assert.match(store, /fee_of: t\.fee_of/, 'store harus mengirim kolom fee_of agar tautan induk tersimpan')
})

// Regression test: updateTransaction harus mengizinkan field fee_of supaya
// replaceTransferWithFee bisa mempertahankan tautan baris fee ke transfer induk
// saat edit transfer. Tanpa ini, kolom fee_of akan di-drop diam-diam.
test('updateTransaction mengizinkan fee_of di payload', async () => {
  const { readFile } = await import('node:fs/promises')
  const allowedFromCode = await readFile(new URL('../lib/store/supabase-store.js', import.meta.url), 'utf8')
  assert.match(allowedFromCode, /'fee_of'/, 'fee_of harus ada di daftar allowed updateTransaction')
})

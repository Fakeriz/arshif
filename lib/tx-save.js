// Jalur simpan transaksi yang menyeimbangkan saldo akun.
// addTransaction dari context adalah saveTransaction: menulis baris, memanggil
// RPC saldo, dan menyegarkan state. store.createTransaction saja tidak pernah
// menggeser saldo (tidak ada trigger di DB), jadi jalur itu wajib diikuti
// applyTxToBalances.
import { applyTxToBalances } from './ledger.js'

export async function saveTxWithBalance({ tx, addTransaction, store, accounts = [], rates } = {}) {
  if (!tx) throw new Error('transaction is required')
  if (typeof addTransaction === 'function') return addTransaction(tx)

  if (typeof store?.createTransaction !== 'function') {
    throw new Error('no transaction store available')
  }
  const created = (await store.createTransaction(tx)) || tx
  await applyTxToBalances(store, accounts, created, 1, rates)
  return created
}

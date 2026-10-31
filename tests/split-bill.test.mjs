import assert from 'node:assert/strict'
import test from 'node:test'

import {
  lineTotal,
  itemsSum,
  computeSplitTotals,
  validateReceiptTotals,
} from '../lib/split-bill.js'

const people = [
  { id: 'p1', name: 'aneh' },
  { id: 'p2', name: 'lex' },
]

test('lineTotal mengalikan qty dan mengurangi discount baris', () => {
  assert.equal(lineTotal({ name: 'x', qty: 2, price: 100 }), 200)
  assert.equal(lineTotal({ name: 'x', qty: 2, price: 100, discount: 50 }), 150)
  assert.equal(lineTotal({ name: 'x', qty: 1, price: 100, discount: 0 }), 100)
  // qty/discount tidak valid jatuh ke default aman
  assert.equal(lineTotal({ name: 'x', price: 100 }), 100)
  assert.equal(lineTotal({ name: 'x', qty: 1, price: 100, discount: 'abc' }), 100)
})

test('baris diskon struk-level berharga negatif dan tidak dikali qty/discount', () => {
  assert.equal(lineTotal({ name: 'PROMO', qty: 1, price: -318.35, is_discount: true }), -318.35)
  // field discount diabaikan untuk baris diskon (harga sudah final negatif)
  assert.equal(lineTotal({ name: 'PROMO', qty: 3, price: -50, is_discount: true, discount: 10 }), -150)
})

test('itemsSum memasukkan baris diskon negatif', () => {
  const items = [
    { name: 'a', qty: 1, price: 259.9 },
    { name: 'b', qty: 1, price: 358.9 },
    { name: 'PROMO', qty: 1, price: -318.35, is_discount: true },
  ]
  assert.equal(Math.round(itemsSum(items) * 100) / 100, 300.45)
})

test('computeSplitTotals membagi baris biasa ke assignees saja', () => {
  const items = [
    { name: 'a', qty: 1, price: 100 },
    { name: 'b', qty: 1, price: 50 },
  ]
  const assign = { 0: ['p1'], 1: ['p1', 'p2'] }
  const { totals, unassigned } = computeSplitTotals(items, assign, people)
  assert.equal(totals.p1, 125)
  assert.equal(totals.p2, 25)
  assert.equal(unassigned, 0)
})

test('computeSplitTotals memakai qty dan discount baris', () => {
  const items = [
    { name: 'a', qty: 2, price: 100, discount: 50 }, // line total 150
  ]
  const assign = { 0: ['p1', 'p2'] }
  const { totals } = computeSplitTotals(items, assign, people)
  assert.equal(totals.p1, 75)
  assert.equal(totals.p2, 75)
})

test('computeSplitTotals membagi baris diskon struk-level ke semua peserta', () => {
  const items = [
    { name: 'a', qty: 1, price: 259.9 },
    { name: 'b', qty: 1, price: 358.9 },
    { name: 'PROMO', qty: 1, price: -318.35, is_discount: true },
  ]
  // Hanya item a di-assign ke p1; b belum di-assign; promo dibagi rata
  const assign = { 0: ['p1'] }
  const { totals, unassigned } = computeSplitTotals(items, assign, people)
  // Bulatkan 3 desimal: hasil split 318.35/2 = 159.175 punya 3 desimal,
  // round 2 desimal salah arah karena floating point (-159.17500000000001).
  assert.equal(Math.round(totals.p1 * 1000) / 1000, Math.round((259.9 - 159.175) * 1000) / 1000)
  assert.equal(Math.round(totals.p2 * 1000) / 1000, -159.175)
  assert.equal(Math.round(unassigned * 1000) / 1000, 358.9)
})

test('computeSplitTotals tanpa assign menghasilkan unassigned penuh', () => {
  const items = [{ name: 'a', qty: 1, price: 100 }]
  const { totals, unassigned } = computeSplitTotals(items, {}, people)
  assert.equal(totals.p1, 0)
  assert.equal(unassigned, 100)
})

test('computeSplitTotals dengan array kosong aman', () => {
  const { totals, unassigned } = computeSplitTotals([], {}, people)
  assert.deepEqual(totals, { p1: 0, p2: 0 })
  assert.equal(unassigned, 0)
})

test('validateReceiptTotals: struk dengan diskon cocok', () => {
  // Kasus struk Watsons LO: item 954.55, promo 318.35, bayar 636.20
  const items = [
    { name: 'Head&Shoulders', qty: 1, price: 259.9 },
    { name: 'Marvis', qty: 1, price: 358.9 },
    { name: 'Watsons Kremsi', qty: 1, price: 159.9 },
    { name: 'Watsons Tekrar', qty: 1, price: 15.95 },
    { name: 'Colgate', qty: 1, price: 159.9 },
  ]
  const r = validateReceiptTotals({
    items,
    discounts: [{ name: 'PROMO', amount: 318.35 }],
    tax: 0,
    total: 636.2,
  })
  assert.equal(r.ok, true)
  assert.equal(Math.round(r.expected * 100) / 100, 636.2)
})

test('validateReceiptTotals: struk tanpa diskon cocok', () => {
  const items = [
    { name: 'a', qty: 2, price: 100 },
    { name: 'b', qty: 1, price: 50 },
  ]
  const r = validateReceiptTotals({ items, discounts: [], tax: 0, total: 250 })
  assert.equal(r.ok, true)
})

test('validateReceiptTotals: mismatch terdeteksi (kasus bug LO)', () => {
  // AI nangkep item 954.55 tapi total 636.20, diskon tidak terekstrak
  const items = [
    { name: 'a', qty: 1, price: 259.9 },
    { name: 'b', qty: 1, price: 358.9 },
    { name: 'c', qty: 1, price: 159.9 },
    { name: 'd', qty: 1, price: 15.95 },
    { name: 'e', qty: 1, price: 159.9 },
  ]
  const r = validateReceiptTotals({ items, discounts: [], tax: 0, total: 636.2 })
  assert.equal(r.ok, false)
  assert.equal(Math.round(r.expected * 100) / 100, 954.55)
  assert.ok(r.diff > 300)
})

test('validateReceiptTotals: pajak ditambahkan ke expected', () => {
  const items = [{ name: 'a', qty: 1, price: 100 }]
  const r = validateReceiptTotals({ items, discounts: [], tax: 8, total: 108 })
  assert.equal(r.ok, true)
  assert.equal(r.expected, 108)
})

test('validateReceiptTotals: toleransi pembulatan 1 satuan', () => {
  const items = [{ name: 'a', qty: 1, price: 100.4 }]
  const r = validateReceiptTotals({ items, discounts: [], tax: 0, total: 100 })
  assert.equal(r.ok, true)
})

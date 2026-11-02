import assert from 'node:assert/strict'
import test from 'node:test'
import { encodeCoachContext } from '../lib/coach-context.js'
import { decode } from '@toon-format/toon'

test('konteks coach round-trip: TOON hasil encode bisa dibaca ulang identik', () => {
  const ctx = {
    homeCurrency: 'IDR',
    totalBalance: 15425000,
    savingsRate: null,
    accounts: [{ name: 'BCA', balance: 8300000 }],
    budgets: [{ category: 'food', limit: 3000000, spent: 2450000, pct: 82 }],
    goals: [{ name: 'Dana Darurat', saved: 5000000, target: 20000000, deadline: '2027-06-30', status: 'behind' }],
  }
  const text = encodeCoachContext(ctx)
  assert.ok(text && !text.startsWith('{'), 'harus TOON, bukan JSON')
  const back = decode(text)
  assert.deepEqual(back, ctx, 'decode harus mengembalikan data yang sama persis')
  assert.ok(text.length < JSON.stringify(ctx).length, 'TOON harus lebih pendek dari JSON')
})

test('input rusak atau kosong tidak melempar error', () => {
  assert.equal(encodeCoachContext(null), null)
  assert.equal(encodeCoachContext({}), null)
  assert.equal(encodeCoachContext('string'), null)
})

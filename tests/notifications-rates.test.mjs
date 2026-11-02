import assert from 'node:assert/strict'
import test from 'node:test'
import { deriveNotifications } from '../lib/notifications.js'

const t = (k) => k
const fmt = (v) => String(v)

test('transaksi berkurs asing tidak boleh membuat deriveNotifications melempar', () => {
  const budgets = [{ id: 'b1', category: 'food', limit_amount: 100000, currency: 'IDR' }]
  const transactions = [
    // 'ZZZ' tidak ada di FALLBACK_RATES: convert() melempar, dan seluruh
    // derivasi notifikasi ikut mati - lonceng notifikasi dan push cron 500.
    { id: 't1', type: 'expense', amount: 50000, currency: 'ZZZ', category: 'food', date: '2026-11-02T10:00:00' },
  ]
  const out = deriveNotifications({
    bills: [], budgets, goals: [], transactions, home: 'IDR', rates: {}, fmt, t,
  })
  assert.ok(Array.isArray(out.notifications))
})

test('budget limit 0 tidak memicu notifikasi dan tidak menghasilkan Infinity', () => {
  const budgets = [{ id: 'b0', category: 'food', limit_amount: 0, currency: 'IDR' }]
  const transactions = [
    { id: 't1', type: 'expense', amount: 50000, currency: 'IDR', category: 'food', date: '2026-11-02T10:00:00' },
  ]
  const out = deriveNotifications({
    bills: [], budgets, goals: [], transactions, home: 'IDR', rates: {}, fmt, t,
  })
  for (const n of out.notifications) {
    assert.ok(Number.isFinite(n.meta?.pct ?? 0), 'pct harus angka, bukan Infinity')
  }
})

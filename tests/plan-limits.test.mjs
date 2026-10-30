// tests/plan-limits.test.mjs
// Test untuk lib/plan-limits.js, SATU sumber limits Free vs Premium.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  PLAN_LIMITS,
  PLAN_LIMIT_KIND,
  USAGE_TRACKED_RESOURCES,
  getLimit,
  isAllowed,
  formatLimit,
} from '../lib/plan-limits.js'

test('spesifikasi limits sesuai yang disetujui user', () => {
  assert.deepEqual(PLAN_LIMITS.accounts_wallets, { free: 4, premium: 30 })
  assert.deepEqual(PLAN_LIMITS.savings_goals, { free: 3, premium: 30 })
  assert.deepEqual(PLAN_LIMITS.loans_bills, { free: 3, premium: 30 })
  assert.deepEqual(PLAN_LIMITS.subscriptions, { free: 5, premium: 50 })
  assert.deepEqual(PLAN_LIMITS.smart_automation_per_month, { free: 30, premium: 500 })
  assert.deepEqual(PLAN_LIMITS.receipt_ocr_per_month, { free: 20, premium: 300 })
  assert.deepEqual(PLAN_LIMITS.statement_import_per_month, { free: 1, premium: 10 })
  assert.deepEqual(PLAN_LIMITS.invoices_per_month, { free: 5, premium: 30 })
  assert.deepEqual(PLAN_LIMITS.money_tax_tools, { free: 'basic', premium: 'full' })
})

test('getLimit: tier tidak dikenal jatuh ke free', () => {
  assert.equal(getLimit('accounts_wallets', 'free'), 4)
  assert.equal(getLimit('accounts_wallets', 'premium'), 30)
  assert.equal(getLimit('accounts_wallets', 'admin'), 30)
  assert.equal(getLimit('accounts_wallets', undefined), 4)
  assert.equal(getLimit('accounts_wallets', 'hacker'), 4)
})

test('getLimit: resource tidak dikenal return null', () => {
  assert.equal(getLimit('nope', 'free'), null)
  assert.equal(getLimit('', 'premium'), null)
})

test('isAllowed: di bawah limit boleh, di limit atau lebih ditolak', () => {
  assert.equal(isAllowed('accounts_wallets', 'free', 0), true)
  assert.equal(isAllowed('accounts_wallets', 'free', 3), true)
  assert.equal(isAllowed('accounts_wallets', 'free', 4), false)
  assert.equal(isAllowed('accounts_wallets', 'free', 10), false)
  assert.equal(isAllowed('accounts_wallets', 'premium', 4), true)
  assert.equal(isAllowed('accounts_wallets', 'premium', 29), true)
  assert.equal(isAllowed('accounts_wallets', 'premium', 30), false)
})

test('isAllowed: currentCount belum diketahui tidak memblokir', () => {
  assert.equal(isAllowed('accounts_wallets', 'free', null), true)
  assert.equal(isAllowed('accounts_wallets', 'free', undefined), true)
})

test('isAllowed: resource tiered selalu boleh di sisi client', () => {
  assert.equal(isAllowed('money_tax_tools', 'free', 999), true)
  assert.equal(isAllowed('money_tax_tools', 'premium', 999), true)
})

test('kind & usage tracking: resource bulanan tercatat di server', () => {
  assert.equal(PLAN_LIMIT_KIND.statement_import_per_month, 'monthly')
  assert.equal(PLAN_LIMIT_KIND.accounts_wallets, 'count')
  for (const r of ['smart_automation_per_month', 'receipt_ocr_per_month', 'statement_import_per_month', 'invoices_per_month']) {
    assert.ok(USAGE_TRACKED_RESOURCES.includes(r), `${r} harus terlacak`)
  }
})

test('formatLimit: bentuk display untuk tabel paywall', () => {
  assert.equal(formatLimit('accounts_wallets', 'free'), '4')
  assert.equal(formatLimit('accounts_wallets', 'premium'), '30')
  assert.equal(formatLimit('subscriptions', 'premium'), '50')
  assert.equal(formatLimit('money_tax_tools', 'free'), 'Dasar')
  assert.equal(formatLimit('money_tax_tools', 'premium'), 'Lengkap + ekspor PDF')
  assert.equal(formatLimit('nope', 'free'), '-')
})

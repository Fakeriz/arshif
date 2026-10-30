import assert from 'node:assert/strict'
import test from 'node:test'
import { buildBackupPayload, validateBackupPayload, restoreBackupData } from '../lib/backup.js'
import { clampMonthStartDay, readMonthStartDay, monthRangeLabel, MONTH_START_DEFAULT } from '../lib/month-cycle.js'

test('backup payload includes accounts, transactions and goals with metadata', () => {
  const payload = buildBackupPayload({
    accounts: [{ id: 'a1', name: 'Main' }],
    transactions: [{ id: 't1', amount: 12 }],
    goals: [{ id: 'g1', name: 'Trip' }],
    version: 'v0.1.0',
  })
  assert.equal(payload.app, 'arshif')
  assert.equal(payload.schemaVersion, 1)
  assert.ok(payload.exportedAt)
  assert.equal(payload.version, 'v0.1.0')
  assert.deepEqual(payload.accounts, [{ id: 'a1', name: 'Main' }])
  assert.equal(payload.transactions.length, 1)
  assert.equal(payload.goals.length, 1)
})

test('backup payload defaults missing collections to empty arrays', () => {
  const payload = buildBackupPayload({})
  assert.deepEqual(payload.accounts, [])
  assert.deepEqual(payload.transactions, [])
  assert.deepEqual(payload.goals, [])
})

test('validateBackupPayload accepts a well-formed payload', () => {
  const payload = buildBackupPayload({ accounts: [{ id: 'a' }], transactions: [], goals: [] })
  const res = validateBackupPayload(payload)
  assert.equal(res.ok, true)
  assert.equal(res.data.accounts.length, 1)
})

test('validateBackupPayload rejects foreign or malformed payloads', () => {
  assert.equal(validateBackupPayload(null).ok, false)
  assert.equal(validateBackupPayload([]).ok, false)
  assert.equal(validateBackupPayload({ app: 'other', schemaVersion: 1, accounts: [], transactions: [], goals: [] }).ok, false)
  assert.equal(validateBackupPayload({ app: 'arshif', schemaVersion: 1, accounts: 'nope' }).error, 'missing_accounts')
  assert.equal(validateBackupPayload({ app: 'arshif', schemaVersion: 1, accounts: [null], transactions: [], goals: [] }).error, 'bad_accounts')
  assert.equal(validateBackupPayload({ app: 'arshif', schemaVersion: 0, accounts: [], transactions: [], goals: [] }).error, 'bad_schema')
})

test('restoreBackupData replaces collections in order', async () => {
  const calls = []
  const store = {
    listAccounts: async () => [{ id: 'old-a' }],
    createAccount: async (r) => calls.push(['createAccount', r.id]),
    deleteAccount: async (id) => calls.push(['deleteAccount', id]),
    listTransactions: async () => [],
    createTransaction: async (r) => calls.push(['createTransaction', r.id]),
    deleteTransaction: async (id) => calls.push(['deleteTransaction', id]),
    listGoals: async () => [],
    createGoal: async (r) => calls.push(['createGoal', r.id]),
    deleteGoal: async (id) => calls.push(['deleteGoal', id]),
  }
  const { restored } = await restoreBackupData(store, {
    accounts: [{ id: 'a' }],
    transactions: [{ id: 't' }],
    goals: [{ id: 'g' }],
  })
  assert.equal(restored, 3)
  assert.deepEqual(calls, [
    ['deleteAccount', 'old-a'],
    ['createAccount', 'a'],
    ['createTransaction', 't'],
    ['createGoal', 'g'],
  ])
})

test('month start day defaults to 1 and clamps to 1-31', () => {
  assert.equal(clampMonthStartDay(undefined), MONTH_START_DEFAULT)
  assert.equal(clampMonthStartDay('junk'), MONTH_START_DEFAULT)
  assert.equal(clampMonthStartDay(0), 1)
  assert.equal(clampMonthStartDay(32), 31)
  assert.equal(clampMonthStartDay(15.6), 16)
  assert.equal(readMonthStartDay(() => '20', {}), 20)
  assert.equal(readMonthStartDay(() => null, {}), MONTH_START_DEFAULT)
  assert.equal(readMonthStartDay(() => null, { month_start_day: 25 }), 25)
  assert.equal(readMonthStartDay(() => '99', { month_start_day: 7 }), 7)
})

test('monthRangeLabel clamps start day to days in month (no February rollover)', () => {
  assert.equal(monthRangeLabel(31, 2026, 1), 'Feb 28 – Mar 27, 2026')
  assert.equal(monthRangeLabel(30, 2026, 1), 'Feb 28 – Mar 27, 2026')
  assert.equal(monthRangeLabel(1, 2026, 9), 'Oct 1 – Oct 31, 2026')
  assert.equal(monthRangeLabel(15, 2026, 9), 'Oct 15 – Nov 14, 2026')
})

// Client-side JSON backup for Arshif (accounts, transactions, goals).
// Pure helpers are kept free of browser globals so they are unit-testable.

export const BACKUP_APP = 'arshif'
export const BACKUP_SCHEMA_VERSION = 1
export const BACKUP_LAST_KEY = 'arshif_backup_last'

export function buildBackupPayload({ accounts, transactions, goals, version } = {}) {
  return {
    app: BACKUP_APP,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    version: version || '',
    accounts: Array.isArray(accounts) ? accounts.map((x) => ({ ...x })) : [],
    transactions: Array.isArray(transactions) ? transactions.map((x) => ({ ...x })) : [],
    goals: Array.isArray(goals) ? goals.map((x) => ({ ...x })) : [],
  }
}

export function validateBackupPayload(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'invalid_shape' }
  }
  if (raw.app !== BACKUP_APP) {
    return { ok: false, error: 'not_arshif' }
  }
  if (!Number.isInteger(raw.schemaVersion) || raw.schemaVersion < 1) {
    return { ok: false, error: 'bad_schema' }
  }
  for (const key of ['accounts', 'transactions', 'goals']) {
    if (!Array.isArray(raw[key])) return { ok: false, error: `missing_${key}` }
    if (raw[key].some((item) => !item || typeof item !== 'object' || Array.isArray(item))) {
      return { ok: false, error: `bad_${key}` }
    }
  }
  return { ok: true, data: { accounts: raw.accounts, transactions: raw.transactions, goals: raw.goals } }
}

// Restore by replacing the three collections. Guest mode swaps localStorage
// arrays directly; Supabase mode deletes the user's current rows, then inserts
// the imported ones. `store` needs list/create/delete methods per collection.
export async function restoreBackupData(store, data, { onProgress } = {}) {
  const { accounts, transactions, goals } = data
  const total = accounts.length + transactions.length + goals.length
  let done = 0
  const tick = (n = 1) => {
    done += n
    try { onProgress?.(done, total) } catch {}
  }

  const replace = async ({ list, create, del, rows }) => {
    const current = await list()
    if (Array.isArray(current)) {
      for (const row of current) {
        if (row?.id) { try { await del(row.id) } catch {} }
      }
    }
    for (const row of rows) {
      await create(row)
      tick()
    }
  }

  await replace({
    list: () => store.listAccounts(),
    create: (r) => store.createAccount(r),
    del: (id) => store.deleteAccount(id),
    rows: accounts,
  })
  await replace({
    list: () => store.listTransactions(),
    create: (r) => store.createTransaction(r),
    del: (id) => store.deleteTransaction(id),
    rows: transactions,
  })
  await replace({
    list: () => store.listGoals(),
    create: (r) => store.createGoal(r),
    del: (id) => store.deleteGoal(id),
    rows: goals,
  })

  return { restored: total }
}

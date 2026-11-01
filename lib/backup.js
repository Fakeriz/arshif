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

  // id lama dari file backup tidak boleh ikut insert: store membuat id baru,
  // dan referensi (account_id) dipetakan lewat hasil create.
  const stripId = (row) => {
    const { id, created_at, user_id, ...rest } = row || {}
    return rest
  }

  const replace = async ({ list, create, del, rows }) => {
    const current = await list()
    if (Array.isArray(current)) {
      for (const row of current) {
        if (row?.id) { try { await del(row.id) } catch {} }
      }
    }
    const out = []
    for (const row of rows) {
      out.push(await create(stripId(row)))
      tick()
    }
    return out
  }

  const newAccounts = await replace({
    list: () => store.listAccounts(),
    create: (r) => store.createAccount(r),
    del: (id) => store.deleteAccount(id),
    rows: accounts,
  })

  // Peta id account lama (urutan file) ke id baru; create mengembalikan row
  // dengan id baru pada urutan yang sama.
  const idMap = {}
  accounts.forEach((old, i) => {
    if (old?.id && newAccounts[i]?.id) idMap[old.id] = newAccounts[i].id
  })
  const remap = (aid) => (aid && idMap[aid]) || null

  const newTransactions = await replace({
    list: () => store.listTransactions(),
    create: (r) => store.createTransaction({ ...r, account_id: remap(r.account_id) }),
    del: (id) => store.deleteTransaction(id),
    rows: transactions,
  })

  const txMap = {}
  transactions.forEach((old, i) => {
    if (old?.id && newTransactions[i]?.id) txMap[old.id] = newTransactions[i].id
  })

  await replace({
    list: () => store.listGoals(),
    create: (r) => store.createGoal({ ...r, account_id: remap(r.account_id), linked_account_id: remap(r.linked_account_id) }),
    del: (id) => store.deleteGoal(id),
    rows: goals,
  })

  return { restored: total }
}

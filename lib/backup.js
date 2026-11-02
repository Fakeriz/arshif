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
  if (raw.schemaVersion > BACKUP_SCHEMA_VERSION) {
    return { ok: false, error: 'schema_too_new' }
  }
  for (const key of ['accounts', 'transactions', 'goals']) {
    if (!Array.isArray(raw[key])) return { ok: false, error: `missing_${key}` }
    if (raw[key].some((item) => !item || typeof item !== 'object' || Array.isArray(item))) {
      return { ok: false, error: `bad_${key}` }
    }
  }
  return { ok: true, data: { accounts: raw.accounts, transactions: raw.transactions, goals: raw.goals } }
}

// Restore dengan urutan aman: data baru ditulis DULU, data lama baru dihapus
// setelah semua insert sukses. Kalau insert gagal di tengah, baris yang sudah
// masuk dibersihkan lagi dan data lama tetap utuh.
// `store` perlu list/create/delete per koleksi.
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

  // Snapshot data lama sebelum insert apa pun, supaya penghapusan nanti hanya
  // menyentuh baris yang memang sudah ada.
  const oldAccounts = (await store.listAccounts()) || []
  const oldTransactions = (await store.listTransactions()) || []
  const oldGoals = (await store.listGoals()) || []

  const created = { accounts: [], transactions: [], goals: [] }

  const insertAll = async (rows, create, bucket) => {
    const out = []
    for (const row of rows) {
      const made = await create(stripId(row))
      out.push(made)
      if (made?.id) bucket.push(made)
      tick()
    }
    return out
  }

  const rollbackCreated = async () => {
    for (const row of created.goals) { try { await store.deleteGoal(row.id) } catch {} }
    for (const row of created.transactions) { try { await store.deleteTransaction(row.id) } catch {} }
    for (const row of created.accounts) { try { await store.deleteAccount(row.id) } catch {} }
  }

  let newAccounts = []
  let newTransactions = []

  try {
    newAccounts = await insertAll(accounts, (r) => store.createAccount(r), created.accounts)

    // Peta id account lama (urutan file) ke id baru; create mengembalikan row
    // dengan id baru pada urutan yang sama.
    const idMap = {}
    accounts.forEach((old, i) => {
      if (old?.id && newAccounts[i]?.id) idMap[old.id] = newAccounts[i].id
    })
    const remap = (aid) => (aid && idMap[aid]) || null

    newTransactions = await insertAll(
      transactions,
      (r) => store.createTransaction({
        ...r,
        account_id: remap(r.account_id),
        to_account_id: remap(r.to_account_id),
      }),
      created.transactions
    )

    await insertAll(
      goals,
      (r) => store.createGoal({
        ...r,
        account_id: remap(r.account_id),
        linked_account_id: remap(r.linked_account_id),
      }),
      created.goals
    )
  } catch (error) {
    await rollbackCreated()
    throw error
  }

  // Semua data baru sudah masuk. Sekarang buang data lama, anak dulu baru induk
  // agar foreign key tidak menahan penghapusan.
  try {
    for (const row of oldGoals) { if (row?.id) await store.deleteGoal(row.id) }
    for (const row of oldTransactions) { if (row?.id) await store.deleteTransaction(row.id) }
    for (const row of oldAccounts) { if (row?.id) await store.deleteAccount(row.id) }
  } catch (error) {
    // Data baru sudah lengkap dan data lama belum habis: jangan hapus yang baru,
    // cukup laporkan supaya pengguna bisa mengulang restore.
    error.partialRestore = true
    throw error
  }

  return { restored: total, accounts: newAccounts.length, transactions: newTransactions.length, goals: created.goals.length }
}

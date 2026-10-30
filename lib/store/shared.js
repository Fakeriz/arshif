import { v4 as uuidv4 } from 'uuid'

export const generateId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : uuidv4()

// Guest data lives under these localStorage keys.
export const LS = {
  profile: 'arshif_guest_profile',
  accounts: 'arshif_guest_accounts',
  transactions: 'arshif_guest_transactions',
  goals: 'arshif_guest_goals',
  net_worth_entries: 'arshif_guest_networth_entries',
  import_batches: 'arshif_guest_import_batches',
}

export const lsGet = (k, d) => {
  if (typeof window === 'undefined') return d
  try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d } catch { return d }
}
export const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} }

// Supabase errors arrive in several shapes (error objects, Postgres codes,
// plain messages); wrapError normalizes them and tags missing tables.
export function wrapError(error) {
  if (!error) return null
  const e = new Error(error.message || 'Supabase error')
  e.code = error.code
  e.missingTable = error.code === '42P01' || /relation .* does not exist/i.test(error.message || '') || /Could not find the table/i.test(error.message || '')
  return e
}

export function isMissingColumnError(error) {
  const code = error?.code
  const message = error?.message || ''
  return code === 'PGRST204' || code === '42703' || /does not exist/i.test(message) || /could not find/i.test(message)
}

// Pagination berulang: ambil semua baris lewat .range() batch demi batch
// menggantikan .limit(150) yang memotong riwayat transaksi pengguna aktif.
// buildQuery(from, to) mengembalikan promise { data, error }.
export async function fetchAllRows(buildQuery, pageSize = 200, maxRows = 20000) {
  const rows = []
  for (let from = 0; from < maxRows; from += pageSize) {
    const { data, error } = await buildQuery(from, from + pageSize - 1)
    if (error) return { rows, error }
    const batch = data || []
    rows.push(...batch)
    if (batch.length < pageSize) break
  }
  return { rows, error: null }
}

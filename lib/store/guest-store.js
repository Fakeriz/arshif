import { v4 as uuidv4 } from 'uuid'
import { generateId, LS, lsGet, lsSet } from './shared'
import { normalizeAccountType } from '../categories'

export const DEFAULT_PROFILE = {
  full_name: '',
  avatar_url: '',
  usage_mode: 'personal',
  language: 'en',
  home_currency: 'USD',
  plan_tier: 'free',
  cloud_backup_provider: 'local',
}

export function guestStore() {
  return {
    mode: 'guest',
    async getProfile() { return { ...DEFAULT_PROFILE, ...(lsGet(LS.profile, {}) || {}) } },
    async saveProfile(patch) { const p = { ...DEFAULT_PROFILE, ...(lsGet(LS.profile, {}) || {}), ...patch }; lsSet(LS.profile, p); return p },

    async listAccounts() { return lsGet(LS.accounts, []) || [] },
    // Normalkan type agar konsisten dengan enum account_type yang dipakai store Supabase.
    async createAccount(a) { const list = lsGet(LS.accounts, []) || []; const acc = { id: uuidv4(), created_at: new Date().toISOString(), ...a, type: normalizeAccountType(a?.type) }; lsSet(LS.accounts, [...list, acc]); return acc },
    async updateAccount(id, patch) { const p = patch && 'type' in patch ? { ...patch, type: normalizeAccountType(patch.type) } : patch; const list = (lsGet(LS.accounts, []) || []).map((x) => (x.id === id ? { ...x, ...p } : x)); lsSet(LS.accounts, list); return list.find((x) => x.id === id) },
    async deleteAccount(id) { lsSet(LS.accounts, (lsGet(LS.accounts, []) || []).filter((x) => x.id !== id)) },

    async listTransactions() {
      return (lsGet(LS.transactions, []) || []).map((x) => ({
        description: x.description || x.note || '',
        transaction_date: x.transaction_date || x.date,
        ...x,
      })).sort((a, b) => new Date(b.date || b.transaction_date) - new Date(a.date || a.transaction_date))
    },
    async createTransaction(t) {
      const list = lsGet(LS.transactions, []) || [];
      const tx = {
        id: t.id || generateId(),
        created_at: new Date().toISOString(),
        currency: t.currency || 'USD',
        note: t.note || t.description || null,
        date: t.date || t.transaction_date || new Date().toISOString(),
        account_id: t.account_id || (lsGet(LS.accounts, [])?.[0]?.id) || null,
        ...t,
      };
      lsSet(LS.transactions, [tx, ...list]);
      return tx
    },
    async updateTransaction(id, patch) { const list = (lsGet(LS.transactions, []) || []).map((x) => (x.id === id ? { ...x, ...patch } : x)); lsSet(LS.transactions, list); return list.find((x) => x.id === id) },
    async deleteTransaction(id) { lsSet(LS.transactions, (lsGet(LS.transactions, []) || []).filter((x) => x.id !== id)) },

    // Impor rekening koran (mode lokal: selalu didukung)
    async getImportCapabilities() { return { batchTable: true, columns: true } },
    async createImportBatch(b) {
      const list = lsGet(LS.import_batches, []) || []
      const rec = { id: uuidv4(), created_at: new Date().toISOString(), status: 'completed', ...b }
      lsSet(LS.import_batches, [rec, ...list])
      return rec
    },
    async updateImportBatch(id, patch) {
      const list = (lsGet(LS.import_batches, []) || []).map((x) => (x.id === id ? { ...x, ...patch } : x))
      lsSet(LS.import_batches, list)
      return list.find((x) => x.id === id) || null
    },
    async listImportBatches(accountId, limit = 20) {
      let list = lsGet(LS.import_batches, []) || []
      if (accountId) list = list.filter((x) => x.account_id === accountId)
      return list.slice(0, limit)
    },
    async deleteTransactionsByImportBatch(batchId) {
      lsSet(LS.transactions, (lsGet(LS.transactions, []) || []).filter((x) => x.import_batch_id !== batchId))
      return true
    },
    async findTransactionsInRange(accountId, fromISO, toISO) {
      const from = new Date(fromISO).getTime(), to = new Date(toISO).getTime()
      return (lsGet(LS.transactions, []) || []).filter((x) => {
        if (accountId && x.account_id !== accountId) return false
        const t = new Date(x.date || x.transaction_date || 0).getTime()
        return t >= from && t <= to
      })
    },

    async listGoals() { return lsGet(LS.goals, []) || [] },
    async createGoal(g) { const list = lsGet(LS.goals, []) || []; const goal = { id: uuidv4(), created_at: new Date().toISOString(), saved_amount: 0, ...g }; lsSet(LS.goals, [...list, goal]); return goal },
    async updateGoal(id, patch) { const list = (lsGet(LS.goals, []) || []).map((x) => (x.id === id ? { ...x, ...patch } : x)); lsSet(LS.goals, list); return list.find((x) => x.id === id) },
    async deleteGoal(id) { lsSet(LS.goals, (lsGet(LS.goals, []) || []).filter((x) => x.id !== id)) },

    async getReceiptCache(txId, receiptUrl = null) {
      const list = lsGet(LS.transactions, []) || []
      const row = list.find((x) => x.id === txId)
      return row?.receipt_cache ?? null
    },
    async saveReceiptCache(txId, cache) {
      const list = lsGet(LS.transactions, []) || []
      lsSet(LS.transactions, list.map((x) => (x.id === txId ? { ...x, receipt_cache: cache } : x)))
    },
    async saveTxMeta(id, patch) {
      return this.updateTransaction(id, patch)
    },
    async getTxMeta(id) {
      const list = lsGet(LS.transactions, []) || []
      const row = list.find((x) => x.id === id)
      return row ? { split: row.split ?? null, storage_provider: row.storage_provider ?? null } : null
    },
  }
}
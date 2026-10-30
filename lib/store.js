import { v4 as uuidv4 } from 'uuid'
import { supabase } from './supabase'
import { addToSyncQueue, getOfflineTransactions, saveOfflineTransactions, isOnline, getSyncQueue } from './sync'

const generateId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : uuidv4()

// Hybrid data layer: guest mode -> localStorage, authenticated -> Supabase (RLS protected)

const LS = {
  profile: 'arshif_guest_profile',
  accounts: 'arshif_guest_accounts',
  transactions: 'arshif_guest_transactions',
  goals: 'arshif_guest_goals',
  import_batches: 'arshif_guest_import_batches',
}

const lsGet = (k, d) => {
  if (typeof window === 'undefined') return d
  try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d } catch { return d }
}
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} }

export const DEFAULT_PROFILE = {
  full_name: '',
  avatar_url: '',
  usage_mode: 'personal',
  language: 'en',
  home_currency: 'USD',
  plan_tier: 'free',
  cloud_backup_provider: 'local',
}

function guestStore() {
  return {
    mode: 'guest',
    async getProfile() { return { ...DEFAULT_PROFILE, ...(lsGet(LS.profile, {}) || {}) } },
    async saveProfile(patch) { const p = { ...DEFAULT_PROFILE, ...(lsGet(LS.profile, {}) || {}), ...patch }; lsSet(LS.profile, p); return p },

    async listAccounts() { return lsGet(LS.accounts, []) || [] },
    async createAccount(a) { const list = lsGet(LS.accounts, []) || []; const acc = { id: uuidv4(), created_at: new Date().toISOString(), ...a }; lsSet(LS.accounts, [...list, acc]); return acc },
    async updateAccount(id, patch) { const list = (lsGet(LS.accounts, []) || []).map((x) => (x.id === id ? { ...x, ...patch } : x)); lsSet(LS.accounts, list); return list.find((x) => x.id === id) },
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

    // --- Impor rekening koran (mode lokal: selalu didukung) ---
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
  }
}

function wrapError(error) {
  if (!error) return null
  const e = new Error(error.message || 'Supabase error')
  e.code = error.code
  e.missingTable = error.code === '42P01' || /relation .* does not exist/i.test(error.message || '') || /Could not find the table/i.test(error.message || '')
  return e
}

// Metadata transaksi dulu hidup di localStorage per-perangkat
// (arshif_tx_split_*, arshif_tx_storage_*, arshif_receipt_cache_*) sehingga
// tidak pernah ikut sinkron. Sekarang tersimpan di kolom DB
// (transactions.split / storage_provider / receipt_cache) dan key lama
// dimigrasikan sekali lalu dibersihkan.
const TX_META_MIGRATED_KEY = (uid) => `arshif_tx_meta_migrated_${uid}`
const txMetaMigrations = new Map()

function isMissingColumnError(error) {
  const code = error?.code
  const message = error?.message || ''
  return code === 'PGRST204' || code === '42703' || /does not exist/i.test(message) || /could not find/i.test(message)
}

function collectLegacyTxMeta() {
  const splits = {}
  const providers = {}
  let receiptKeys = 0
  if (typeof window === 'undefined' || !localStorage) return { splits, providers, receiptKeys }
  try {
    const keys = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key) keys.push(key)
    }
    for (const key of keys) {
      if (key.startsWith('arshif_tx_split_')) {
        const id = key.slice('arshif_tx_split_'.length)
        try {
          splits[id] = JSON.parse(localStorage.getItem(key) || 'null')
        } catch {
          splits[id] = null
        }
      } else if (key.startsWith('arshif_tx_storage_')) {
        providers[key.slice('arshif_tx_storage_'.length)] = localStorage.getItem(key)
      } else if (key.startsWith('arshif_receipt_cache_')) {
        receiptKeys += 1
      }
    }
  } catch {}
  return { splits, providers, receiptKeys }
}

function readLegacyReceiptCache(receiptUrl, txId) {
  if (typeof window === 'undefined' || !localStorage) return null
  try {
    const direct =
      localStorage.getItem(`arshif_receipt_cache_${txId}`) ||
      (receiptUrl ? localStorage.getItem(`arshif_receipt_cache_${receiptUrl}`) : null)
    if (direct) return direct
    if (receiptUrl && receiptUrl.includes('drive.google.com')) {
      const match = receiptUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || receiptUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/)
      if (match?.[1]) return localStorage.getItem(`arshif_receipt_cache_${match[1]}`)
    }
  } catch {}
  return null
}

function clearLegacyTxMetaKeys(id, receiptUrl) {
  if (typeof window === 'undefined' || !localStorage) return
  const keys = [`arshif_tx_split_${id}`, `arshif_tx_storage_${id}`, `arshif_receipt_cache_${id}`]
  if (receiptUrl) {
    keys.push(`arshif_receipt_cache_${receiptUrl}`)
    const match = receiptUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || receiptUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/)
    if (match?.[1]) keys.push(`arshif_receipt_cache_${match[1]}`)
  }
  try {
    keys.forEach((key) => localStorage.removeItem(key))
  } catch {}
}

// Migrasi sekali-jalan: pindahkan split/storage_provider/receipt_cache dari
// localStorage ke kolom DB (hanya jika kolom DB masih null), lalu hapus key.
// Kalau migrasi SQL belum dijalankan, key lokal dipertahankan dan flag tidak
// dipasang supaya migrasi dicoba lagi pada sesi berikutnya.
async function migrateLegacyTxMeta(uid) {
  if (typeof window === 'undefined') return
  if (lsGet(TX_META_MIGRATED_KEY(uid), false)) return
  if (txMetaMigrations.has(uid)) return txMetaMigrations.get(uid)

  const run = (async () => {
    const { splits, providers, receiptKeys } = collectLegacyTxMeta()

    // Tidak ada key lama sama sekali: tidak ada yang perlu dimigrasikan.
    if (!receiptKeys && !Object.keys(splits).length && !Object.keys(providers).length) {
      lsSet(TX_META_MIGRATED_KEY(uid), true)
      return
    }

    let receiptRows = []
    if (receiptKeys) {
      try {
        const { data, error } = await supabase
          .from('transactions')
          .select('id, receipt_url')
          .eq('user_id', uid)
          .not('receipt_url', 'is', null)
          .limit(500)
        if (error) throw error
        receiptRows = data || []
      } catch {
        // Gagal ambil daftar struk: jangan pasang flag, coba lagi nanti.
        return
      }
    }

    const ids = new Set([
      ...Object.keys(splits),
      ...Object.keys(providers),
      ...receiptRows.map((row) => row.id),
    ])

    for (const id of ids) {
      const row = receiptRows.find((r) => r.id === id)
      const patch = {}
      if (Object.prototype.hasOwnProperty.call(splits, id) && splits[id] != null) patch.split = splits[id]
      if (providers[id] != null) patch.storage_provider = providers[id]
      const cachedReceipt = row?.receipt_url ? readLegacyReceiptCache(row.receipt_url, id) : null
      if (cachedReceipt) patch.receipt_cache = cachedReceipt

      if (!Object.keys(patch).length) {
        clearLegacyTxMetaKeys(id, row?.receipt_url)
        continue
      }

      try {
        const { data: current, error: selectError } = await supabase
          .from('transactions')
          .select('split, storage_provider, receipt_cache')
          .eq('id', id)
          .eq('user_id', uid)
          .maybeSingle()
        if (selectError) {
          // Kolom belum ada: batalkan migrasi, pertahankan localStorage.
          if (isMissingColumnError(selectError)) return
          clearLegacyTxMetaKeys(id, row?.receipt_url)
          continue
        }
        if (!current) {
          clearLegacyTxMetaKeys(id, row?.receipt_url)
          continue
        }

        const finalPatch = {}
        if (patch.split !== undefined && current.split == null) finalPatch.split = patch.split
        if (patch.storage_provider !== undefined && current.storage_provider == null) {
          finalPatch.storage_provider = patch.storage_provider
        }
        if (patch.receipt_cache !== undefined && current.receipt_cache == null) {
          finalPatch.receipt_cache = patch.receipt_cache
        }

        if (Object.keys(finalPatch).length) {
          const { error: updateError } = await supabase
            .from('transactions')
            .update(finalPatch)
            .eq('id', id)
            .eq('user_id', uid)
          if (updateError) {
            if (isMissingColumnError(updateError)) return
            clearLegacyTxMetaKeys(id, row?.receipt_url)
            continue
          }
        }
        clearLegacyTxMetaKeys(id, row?.receipt_url)
      } catch {
        // Gagal tak terduga: pertahankan key, coba lagi sesi berikutnya.
      }
    }

    lsSet(TX_META_MIGRATED_KEY(uid), true)
  })().finally(() => txMetaMigrations.delete(uid))

  txMetaMigrations.set(uid, run)
  return run
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

function supabaseStore(userId, userMeta = {}) {
  const uid = userId
  const table = (name) => supabase.from(name)
  const throwIf = (error) => { const e = wrapError(error); if (e) throw e }

  return {
    mode: 'supabase',
    async getProfile() {
      const localProvider = lsGet(`arshif_cloud_backup_provider_${uid}`) || lsGet('arshif_cloud_backup_provider') || 'local'
      const { data, error } = await table('profiles').select('*').eq('id', uid).maybeSingle()
      throwIf(error)
      if (data) return { ...DEFAULT_PROFILE, cloud_backup_provider: localProvider, ...data }
      const fresh = {
        id: uid,
        ...DEFAULT_PROFILE,
        cloud_backup_provider: localProvider,
        full_name: userMeta?.full_name || userMeta?.name || '',
        avatar_url: userMeta?.avatar_url || userMeta?.picture || '',
      }
      const { data: created, error: e2 } = await table('profiles').upsert(fresh).select().maybeSingle()
      if (e2) {
        const fallback = { ...fresh }
        delete fallback.cloud_backup_provider
        const { data: retry } = await table('profiles').upsert(fallback).select().maybeSingle()
        return { ...fresh, ...(retry || {}) }
      }
      return { ...fresh, ...(created || {}) }
    },
    async saveProfile(patch) {
      if (patch?.cloud_backup_provider) {
        lsSet(`arshif_cloud_backup_provider_${uid}`, patch.cloud_backup_provider)
        lsSet('arshif_cloud_backup_provider', patch.cloud_backup_provider)
      }
      const safePatch = { ...(patch || {}) }
      delete safePatch.plan_tier
      const payload = { id: uid, ...safePatch, updated_at: new Date().toISOString() }
      let { data, error } = await table('profiles').upsert(payload).select().maybeSingle()
      if (error && (error.code === 'PGRST204' || error.code === '42703' || /does not exist/i.test(error.message || ''))) {
        const safePayload = { ...payload }
        delete safePayload.cloud_backup_provider
        const retry = await table('profiles').upsert(safePayload).select().maybeSingle()
        if (!retry.error) return { ...safePayload, ...safePatch, ...(retry.data || {}) }
      }
      throwIf(error)
      return { ...safePatch, ...(data || {}) }
    },

    async listAccounts() { const { data, error } = await table('accounts').select('*').eq('user_id', uid).order('created_at'); throwIf(error); return data || [] },
    async createAccount(a) { const { data, error } = await table('accounts').insert({ ...a, user_id: uid }).select().maybeSingle(); throwIf(error); return data },
    async updateAccount(id, patch) { const { data, error } = await table('accounts').update(patch).eq('id', id).eq('user_id', uid).select().maybeSingle(); throwIf(error); return data },
    async deleteAccount(id) { const { error } = await table('accounts').delete().eq('id', id).eq('user_id', uid); throwIf(error) },

    async listTransactions() {
      await migrateLegacyTxMeta(uid)
      let serverData = []

      if (!isOnline()) {
        const cached = lsGet(`arshif_state_cache_${uid}`, {})?.transactions || []
        serverData = cached
      } else {
        // Pagination berulang batch 200 hingga habis (menggantikan limit(150)).
        // Urutan sekunder id menjaga pagination stabil saat banyak baris
        // berbagi tanggal yang sama.
        const { rows, error } = await fetchAllRows((from, to) =>
          table('transactions')
            .select('*')
            .eq('user_id', uid)
            .order('date', { ascending: false })
            .order('id', { ascending: false })
            .range(from, to)
        )
        if (error) {
          if (/network|fetch|offline|Failed to fetch/i.test(error.message || '')) {
            serverData = lsGet(`arshif_state_cache_${uid}`, {})?.transactions || []
          } else {
            throwIf(error)
          }
        } else {
          serverData = rows
        }
      }

      // Merge with offline queued mutations
      const offlineList = getOfflineTransactions()
      const syncQueue = getSyncQueue()
      const deletedIds = new Set(syncQueue.filter((q) => q.action === 'delete').map((q) => q.id))

      const map = new Map()
      serverData.forEach((row) => {
        if (!deletedIds.has(row.id)) {
          map.set(row.id, { ...row, _synced: true })
        }
      })
      offlineList.forEach((row) => {
        if (!deletedIds.has(row.id)) {
          const existing = map.get(row.id) || {}
          map.set(row.id, { ...existing, ...row, _synced: false })
        }
      })

      const combined = Array.from(map.values()).sort(
        (a, b) => new Date(b.date || b.transaction_date) - new Date(a.date || a.transaction_date)
      )

      return combined.map((row) => {
        // Sumber utama: kolom DB. localStorage hanya jadi fallback bila kolom
        // masih null (mis. migrasi SQL belum dijalankan di device ini).
        let split = row.split ?? null
        if (split == null) {
          try {
            const s = localStorage.getItem(`arshif_tx_split_${row.id}`)
            if (s) split = JSON.parse(s)
          } catch {}
        }
        const localStoreProvider = lsGet(`arshif_tx_storage_${row.id}`)
        const itemMeta = Array.isArray(row.items) && row.items[0] && typeof row.items[0] === 'object' ? row.items[0] : {}
        let cachedReceipt = row.receipt_cache ?? null
        if (cachedReceipt == null && typeof localStorage !== 'undefined' && row.receipt_url) {
          try {
            cachedReceipt =
              localStorage.getItem(`arshif_receipt_cache_${row.receipt_url}`) ||
              localStorage.getItem(`arshif_receipt_cache_${row.id}`)
            if (!cachedReceipt && row.receipt_url.includes('drive.google.com')) {
              const match = row.receipt_url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || row.receipt_url.match(/[?&]id=([a-zA-Z0-9_-]+)/)
              if (match?.[1]) {
                cachedReceipt = localStorage.getItem(`arshif_receipt_cache_${match[1]}`)
              }
            }
          } catch {}
        }
        return {
          description: row.description || row.note || '',
          transaction_date: row.transaction_date || row.date,
          bill_id: row.bill_id || itemMeta.bill_id || null,
          billing_month: row.billing_month || itemMeta.billing_month || null,
          storage_provider: row.storage_provider || localStoreProvider || (row.receipt_url?.includes('drive.google.com') ? 'google_drive' : 'local'),
          receipt_preview: cachedReceipt || row.receipt_preview || null,
          split,
          ...row,
        }
      })
    },

    async createTransaction(t) {
      await migrateLegacyTxMeta(uid)
      const meta = {
        ...(t.bill_id ? { bill_id: t.bill_id } : {}),
        ...(t.billing_month ? { billing_month: t.billing_month } : {}),
        ...(t.description ? { description: t.description } : {}),
      }
      const rawDate = t.date || t.transaction_date || new Date().toISOString()
      const storageProvider = t.storage_provider || (t.receipt_url?.includes('drive.google.com') ? 'google_drive' : 'local')
      const receiptCache = t.receipt_cache || t.receipt_preview || (t.receipt_url?.startsWith('data:') ? t.receipt_url : null) || null
      const id = t.id || generateId()

      // Fallback account_id otomatis agar terhindar dari not-null constraint error di Supabase
      let resolvedAccountId = t.account_id || null
      if (!resolvedAccountId) {
        try {
          const { data: firstAcc } = await table('accounts').select('id').eq('user_id', uid).order('created_at').limit(1).maybeSingle()
          if (firstAcc?.id) {
            resolvedAccountId = firstAcc.id
          }
        } catch (accErr) {
          console.warn('Fallback account resolution error:', accErr)
        }
      }

      const cleanPayload = {
        id,
        user_id: uid,
        type: t.type || 'expense',
        amount: Number(t.amount) || 0,
        currency: t.currency || 'USD',
        home_currency: t.home_currency || null,
        home_currency_amount: t.home_currency_amount != null ? Number(t.home_currency_amount) : null,
        rate: t.rate != null ? Number(t.rate) : null,
        category: t.category || 'other',
        payment_method: t.payment_method || 'bank',
        account_id: resolvedAccountId,
        to_account_id: t.to_account_id || null,
        fee: Number(t.fee) || 0,
        note: t.note || t.description || null,
        description: t.description || t.note || null,
        merchant: t.merchant || null,
        receipt_number: t.receipt_number || null,
        receipt_url: t.receipt_url || null,
        items: Array.isArray(t.items) && t.items.length ? t.items : (Object.keys(meta).length ? [meta] : []),
        tax_deductible: !!t.tax_deductible,
        date: rawDate,
        transaction_date: t.transaction_date || rawDate,
        bill_id: t.bill_id || null,
        billing_month: t.billing_month || null,
        // Metadata split / provider / cache struk: kolom DB (ikut sync),
        // bukan lagi localStorage per-perangkat.
        ...(t.split != null ? { split: t.split } : {}),
        storage_provider: storageProvider,
        ...(receiptCache != null ? { receipt_cache: receiptCache } : {}),
        // Kolom impor (hanya dikirim jika wizard impor menyediakannya ,
        // berarti migrasi import_batches sudah dijalankan)
        ...(t.import_batch_id ? { import_batch_id: t.import_batch_id } : {}),
        ...(t.fingerprint ? { fingerprint: t.fingerprint } : {}),
      }

      // Optimistic cache update in local offline store
      const offlineList = getOfflineTransactions()
      saveOfflineTransactions([{ ...cleanPayload, _synced: false }, ...offlineList.filter((x) => x.id !== id)])

      // If offline: queue immediately
      if (!isOnline()) {
        addToSyncQueue('insert', 'transactions', cleanPayload)
        return { ...cleanPayload, id, _synced: false }
      }

      // Online: attempt insert
      try {
        const { data, error } = await table('transactions').insert(cleanPayload).select('id, created_at').maybeSingle()
        if (error) {
          if (/network|fetch|offline|Failed to fetch/i.test(error.message || '')) {
            addToSyncQueue('insert', 'transactions', cleanPayload)
            return { ...cleanPayload, storage_provider: storageProvider, id, _synced: false }
          }
          if (error.code === 'PGRST204' || error.code === '42703' || /does not exist/i.test(error.message || '')) {
            const minimalPayload = {
              id,
              user_id: uid,
              type: cleanPayload.type,
              amount: cleanPayload.amount,
              currency: cleanPayload.currency,
              category: cleanPayload.category,
              payment_method: cleanPayload.payment_method,
              account_id: cleanPayload.account_id,
              to_account_id: cleanPayload.to_account_id,
              note: cleanPayload.note,
              date: cleanPayload.date,
            }
            const { data: minData, error: minErr } = await table('transactions').insert(minimalPayload).select('id, created_at').maybeSingle()
            if (minErr && /network|fetch|offline|Failed to fetch/i.test(minErr.message || '')) {
              addToSyncQueue('insert', 'transactions', minimalPayload)
              return { ...cleanPayload, id, _synced: false }
            }
            throwIf(minErr)
            return { ...cleanPayload, id: minData?.id || id, _synced: true }
          }
          throwIf(error)
        }
        return { ...cleanPayload, id: data?.id || id, _synced: true }
      } catch (err) {
        if (/network|fetch|offline|Failed to fetch/i.test(err?.message || '')) {
          addToSyncQueue('insert', 'transactions', cleanPayload)
          return { ...cleanPayload, id, _synced: false }
        }
        throw err
      }
    },

    async updateTransaction(id, patch) {
      await migrateLegacyTxMeta(uid)
      const allowed = [
        'type', 'amount', 'currency', 'home_currency', 'home_currency_amount',
        'rate', 'category', 'category_id', 'subcategory', 'payment_method', 'account_id', 'destination_account_id', 'to_account_id',
        'fee', 'note', 'merchant', 'receipt_number', 'receipt_url', 'items',
        'tax_deductible', 'is_tax_deductible', 'date', 'transaction_date', 'description', 'bill_id', 'billing_month', 'auto_logged',
        // Metadata yang kini punya kolom DB sendiri (sebelumnya localStorage)
        'split', 'storage_provider', 'receipt_cache'
      ]
      const cleanPatch = {}
      for (const k of allowed) {
        if (patch[k] !== undefined) cleanPatch[k] = patch[k]
      }
      // receipt_preview dari form disimpan ke kolom receipt_cache
      const receiptCache = patch.receipt_cache ?? patch.receipt_preview ?? (patch.receipt_url?.startsWith('data:') ? patch.receipt_url : null)
      if (receiptCache != null && cleanPatch.receipt_cache === undefined) cleanPatch.receipt_cache = receiptCache

      // Optimistic update in offline list
      const offlineList = getOfflineTransactions()
      const existingOfflineIdx = offlineList.findIndex((x) => x.id === id)
      if (existingOfflineIdx >= 0) {
        offlineList[existingOfflineIdx] = { ...offlineList[existingOfflineIdx], ...patch, _synced: false }
        saveOfflineTransactions(offlineList)
      }

      // Key localStorage lama dibersihkan hanya setelah nilainya pasti tersimpan
      // (di DB atau di antrean sync), supaya tidak ada salinan basi yang bisa
      // menimpa kolom DB saat dibaca.
      let persisted = false
      try {
        if (!isOnline()) {
          addToSyncQueue('update', 'transactions', { id, user_id: uid, ...cleanPatch })
          persisted = true
          return { id, ...patch, _synced: false }
        }

        const { error } = await table('transactions').update(cleanPatch).eq('id', id).eq('user_id', uid)
        if (error) {
          if (/network|fetch|offline|Failed to fetch/i.test(error.message || '')) {
            addToSyncQueue('update', 'transactions', { id, user_id: uid, ...cleanPatch })
            persisted = true
            return { id, ...patch, _synced: false }
          }
          throwIf(error)
        }
        persisted = true
        return { id, ...patch, _synced: true }
      } catch (err) {
        if (/network|fetch|offline|Failed to fetch/i.test(err?.message || '')) {
          addToSyncQueue('update', 'transactions', { id, user_id: uid, ...cleanPatch })
          persisted = true
          return { id, ...patch, _synced: false }
        }
        throw err
      } finally {
        if (persisted) clearLegacyTxMetaKeys(id, patch.receipt_url)
      }
    },

    async deleteTransaction(id) {
      // Optimistic update in offline list
      const offlineList = getOfflineTransactions()
      saveOfflineTransactions(offlineList.filter((x) => x.id !== id))
      // Bersihkan sisa metadata localStorage untuk transaksi yang dihapus
      clearLegacyTxMetaKeys(id)

      if (!isOnline()) {
        addToSyncQueue('delete', 'transactions', { id, user_id: uid })
        return true
      }

      try {
        const { error } = await table('transactions').delete().eq('id', id).eq('user_id', uid)
        if (error) {
          if (/network|fetch|offline|Failed to fetch/i.test(error.message || '')) {
            addToSyncQueue('delete', 'transactions', { id, user_id: uid })
            return true
          }
          throwIf(error)
        }
        return true
      } catch (err) {
        if (/network|fetch|offline|Failed to fetch/i.test(err?.message || '')) {
          addToSyncQueue('delete', 'transactions', { id, user_id: uid })
          return true
        }
        throw err
      }
    },

    // --- Impor rekening koran ---
    // Cek kapabilitas server: tabel import_batches + kolom fingerprint/import_batch_id.
    // Jika migrasi SQL belum dijalankan, impor tetap jalan tanpa pelacakan batch/undo.
    async getImportCapabilities() {
      const caps = { batchTable: false, columns: false }
      try {
        const { error } = await table('import_batches').select('id').limit(0)
        if (!error) caps.batchTable = true
      } catch {}
      try {
        const { error } = await table('transactions').select('fingerprint').limit(0)
        if (!error) caps.columns = true
      } catch {}
      return caps
    },
    async createImportBatch(b) {
      try {
        const { data, error } = await table('import_batches').insert({ ...b, user_id: uid }).select().maybeSingle()
        if (error) return null
        return data
      } catch { return null }
    },
    async updateImportBatch(id, patch) {
      try {
        const { data, error } = await table('import_batches').update(patch).eq('id', id).eq('user_id', uid).select().maybeSingle()
        if (error) return null
        return data
      } catch { return null }
    },
    async listImportBatches(accountId, limit = 20) {
      try {
        let q = table('import_batches').select('*').eq('user_id', uid).order('created_at', { ascending: false }).limit(limit)
        if (accountId) q = q.eq('account_id', accountId)
        const { data, error } = await q
        if (error) return []
        return data || []
      } catch { return [] }
    },
    async deleteTransactionsByImportBatch(batchId) {
      if (!isOnline()) {
        // Offline: hapus dari antrean lokal juga
        const offlineList = getOfflineTransactions()
        saveOfflineTransactions(offlineList.filter((x) => x.import_batch_id !== batchId))
        addToSyncQueue('delete_by_batch', 'transactions', { import_batch_id: batchId, user_id: uid })
        return true
      }
      const { error } = await table('transactions').delete().eq('user_id', uid).eq('import_batch_id', batchId)
      throwIf(error)
      const offlineList = getOfflineTransactions()
      saveOfflineTransactions(offlineList.filter((x) => x.import_batch_id !== batchId))
      return true
    },
    async findTransactionsInRange(accountId, fromISO, toISO) {
      try {
        const { data, error } = await table('transactions')
          .select('id,date,amount,currency,note,description')
          .eq('user_id', uid)
          .eq('account_id', accountId)
          .gte('date', fromISO)
          .lte('date', toISO)
          .limit(2000)
        if (error) return []
        return data || []
      } catch { return [] }
    },

    async listGoals() {
      const { data, error } = await table('goals').select('*').eq('user_id', uid).order('created_at')
      throwIf(error)
      return (data || []).filter((g) => g.type !== 'subscription')
    },
    async createGoal(g) { const { data, error } = await table('goals').insert({ ...g, user_id: uid }).select().maybeSingle(); throwIf(error); return data },
    async updateGoal(id, patch) { const { data, error } = await table('goals').update(patch).eq('id', id).eq('user_id', uid).select().maybeSingle(); throwIf(error); return data },
    async deleteGoal(id) { const { error } = await table('goals').delete().eq('id', id).eq('user_id', uid); throwIf(error) },
  }
}

export function createStore(session) {
  const scope = session?.user?.id || 'guest'
  const base = session?.user?.id ? supabaseStore(session.user.id, session.user.user_metadata || {}) : guestStore()
  const categories = hybridColl(session, 'categories', `arshif_categories_${scope}`)
  const templates = hybridColl(session, 'transaction_templates', `arshif_templates_${scope}`)
  const debts = hybridColl(session, 'debts', `arshif_debts_${scope}`)
  const budgets = session?.user?.id
    ? strictHybridColl(session.user.id, 'budgets')
    : localColl(`arshif_budgets_${scope}`)
  const bills = billsStore(session, scope)
  const splitBills = session?.user?.id
    ? strictHybridColl(session.user.id, 'split_bills')
    : localColl(`arshif_split_bills_${scope}`)
  return {
    ...base,
    ...bills,
    ...localSubscriptions(session, scope, bills),
    listSplitBills: () => splitBills.list(),
    createSplitBill: (r) => splitBills.create(r),
    updateSplitBill: (id, p) => splitBills.update(id, p),
    deleteSplitBill: (id) => splitBills.remove(id),
    listCategories: () => categories.list(),
    createCategory: (r) => categories.create(r),
    updateCategory: (id, p) => categories.update(id, p),
    deleteCategory: (id) => categories.remove(id),
    listTemplates: () => templates.list(),
    createTemplate: (r) => templates.create(r),
    updateTemplate: (id, p) => templates.update(id, p),
    deleteTemplate: (id) => templates.remove(id),
    listDebts: () => debts.list(),
    createDebt: (r) => debts.create(r),
    updateDebt: (id, p) => debts.update(id, p),
    deleteDebt: (id) => debts.remove(id),
    listBudgets: () => budgets.list(),
    createBudget: (r) => budgets.create(r),
    updateBudget: (id, p) => budgets.update(id, p),
    deleteBudget: (id) => budgets.remove(id),
  }
}

function localColl(key) {
  return {
    async list() { return lsGet(key, []) || [] },
    async create(row) { const list = lsGet(key, []) || []; const r = { id: uuidv4(), created_at: new Date().toISOString(), ...row }; lsSet(key, [...list, r]); return r },
    async update(id, patch) { const list = (lsGet(key, []) || []).map((x) => (x.id === id ? { ...x, ...patch } : x)); lsSet(key, list); return list.find((x) => x.id === id) },
    async remove(id) { lsSet(key, (lsGet(key, []) || []).filter((x) => x.id !== id)) },
  }
}

function strictHybridColl(uid, tableName) {
  const tbl = () => supabase.from(tableName)
  return {
    async list() {
      const { data, error } = await tbl().select('*').eq('user_id', uid).order('created_at')
      if (error) throw wrapError(error)
      return data || []
    },
    async create(row) {
      const { data, error } = await tbl().insert({ ...row, user_id: uid }).select().maybeSingle()
      if (error) throw wrapError(error)
      return data
    },
    async update(id, patch) {
      const { data, error } = await tbl().update(patch).eq('id', id).eq('user_id', uid).select().maybeSingle()
      if (error) throw wrapError(error)
      return data
    },
    async remove(id) {
      const { error } = await tbl().delete().eq('id', id).eq('user_id', uid)
      if (error) throw wrapError(error)
    },
  }
}

function hybridColl(session, tableName, key) {
  const uid = session?.user?.id
  const local = localColl(key)
  if (!uid) return local
  const tbl = () => supabase.from(tableName)
  return {
    async list() {
      try { const { data, error } = await tbl().select('*').eq('user_id', uid).order('created_at'); if (error) throw error; return data || [] }
      catch { return local.list() }
    },
    async create(row) {
      try { const { data, error } = await tbl().insert({ ...row, user_id: uid }).select().maybeSingle(); if (error) throw error; return data }
      catch { return local.create(row) }
    },
    async update(id, patch) {
      try { const { data, error } = await tbl().update(patch).eq('id', id).eq('user_id', uid).select().maybeSingle(); if (error) throw error; return data }
      catch { return local.update(id, patch) }
    },
    async remove(id) {
      try { const { error } = await tbl().delete().eq('id', id).eq('user_id', uid); if (error) throw error }
      catch { return local.remove(id) }
    },
  }
}

function billsStore(session, scope) {
  const uid = session?.user?.id
  const key = `arshif_bills_${scope}`
  if (!uid) {
    return {
      async listBills() { return lsGet(key, []) || [] },
      async createBill(b) {
        const list = lsGet(key, []) || []
        const bill = { id: uuidv4(), created_at: new Date().toISOString(), paid_months: {}, ...b }
        lsSet(key, [...list, bill])
        return bill
      },
      async updateBill(id, patch) {
        const list = (lsGet(key, []) || []).map((x) => (x.id === id ? { ...x, ...patch } : x))
        lsSet(key, list)
        return list.find((x) => x.id === id)
      },
      async deleteBill(id) { lsSet(key, (lsGet(key, []) || []).filter((x) => x.id !== id)) },
    }
  }

  const tbl = () => supabase.from('bills')
  return {
    async listBills() {
      const { data, error } = await tbl().select('*').eq('user_id', uid).order('created_at')
      if (error) throw wrapError(error)
      return data || []
    },
    async createBill(b) {
      const { data, error } = await tbl().insert({ ...b, user_id: uid }).select().maybeSingle()
      if (error) throw wrapError(error)
      return data
    },
    async updateBill(id, patch) {
      const { data, error } = await tbl().update(patch).eq('id', id).eq('user_id', uid).select().maybeSingle()
      if (error) throw wrapError(error)
      return data
    },
    async deleteBill(id) {
      const { error } = await tbl().delete().eq('id', id).eq('user_id', uid)
      if (error) throw wrapError(error)
    },
  }
}

function localSubscriptions(session, scope, billsStore) {
  const key = `arshif_subscriptions_${scope}`
  const billsKey = `arshif_bills_${scope}`
  const uid = session?.user?.id
  const localBillMode = !uid
  const localBillList = () => lsGet(billsKey, []) || []

  const createMirrorBill = async (bill) => {
    if (localBillMode) {
      const list = localBillList()
      lsSet(billsKey, [...list, bill])
      return bill
    }
    return billsStore.createBill(bill)
  }

  const updateMirrorBill = async (id, patch) => {
    if (localBillMode) {
      const list = localBillList().map((x) => (x.id === id ? { ...x, ...patch } : x))
      lsSet(billsKey, list)
      return list.find((x) => x.id === id)
    }
    return billsStore.updateBill(id, patch)
  }

  const removeMirrorBills = async (subscriptionId) => {
    if (localBillMode) {
      lsSet(billsKey, localBillList().filter((b) => b.subscription_id !== subscriptionId))
      return
    }
    const list = await billsStore.listBills()
    await Promise.all(list.filter((b) => b.subscription_id === subscriptionId).map((b) => billsStore.deleteBill(b.id)))
  }

  const syncGoal = async (action, sub) => {
    if (!uid) return
    try {
      if (action === 'create' || action === 'update') {
        const payload = {
          id: sub.id,
          user_id: uid,
          name: sub.name || sub.title || 'Subscription',
          target_amount: Number(sub.amount) || 0,
          currency: sub.currency || 'USD',
          type: 'subscription',
          deadline: sub.next_billing_date || null,
        }
        const { error } = await supabase.from('goals').upsert(payload)
        if (error && (error.code === 'PGRST204' || error.code === '42703' || /does not exist/i.test(error.message || ''))) {
          const { type: _, ...safe } = payload
          await supabase.from('goals').upsert(safe)
        }
      } else if (action === 'delete') {
        await supabase.from('goals').delete().eq('id', sub.id).eq('user_id', uid)
      }
    } catch (e) {
      console.warn('Goals subscription sync notice:', e?.message)
    }
  }

  const getDueDay = (sub) => {
    if (sub.next_billing_date) {
      const parts = sub.next_billing_date.split('-')
      if (parts.length === 3) {
        const parsed = parseInt(parts[2], 10)
        if (!isNaN(parsed) && parsed >= 1 && parsed <= 31) return parsed
      }
    }
    return Math.min(31, Math.max(1, Number(sub.due_day) || 1))
  }

  return {
    async listSubscriptions() { return lsGet(key, []) || [] },
    async createSubscription(s) {
      const list = lsGet(key, []) || []
      const sub = {
        id: uuidv4(),
        created_at: new Date().toISOString(),
        show_as_bill: true,
        ...s,
      }
      sub.due_day = getDueDay(sub)
      lsSet(key, [...list, sub])

      if (sub.show_as_bill) {
        await createMirrorBill({
          id: uuidv4(),
          created_at: new Date().toISOString(),
          title: sub.name || sub.title,
          amount: sub.amount,
          currency: sub.currency,
          due_day: sub.due_day,
          next_billing_date: sub.next_billing_date || null,
          cycle: sub.cycle || 'monthly',
          category: sub.category || 'cat_bills',
          account_id: sub.account_id || null,
          payment_method: sub.payment_method || 'card',
          auto_log_expense: Boolean(sub.auto_log_expense),
          is_subscription_mirror: true,
          subscription_id: sub.id,
          cover_url: sub.cover_url || null,
          paid_months: {},
        })
      }

      await syncGoal('create', sub)
      return sub
    },
    async updateSubscription(id, patch) {
      const list = (lsGet(key, []) || []).map((x) => (x.id === id ? { ...x, ...patch } : x))
      lsSet(key, list)
      const updated = list.find((x) => x.id === id)
      if (updated) {
        updated.due_day = getDueDay(updated)
        const bills = await billsStore.listBills()
        const existing = bills.find((b) => b.subscription_id === id)
        if (updated.show_as_bill) {
          const mirrorData = {
            title: updated.name || updated.title,
            amount: updated.amount,
            currency: updated.currency,
            due_day: updated.due_day,
            next_billing_date: updated.next_billing_date || null,
            cycle: updated.cycle || 'monthly',
            category: updated.category || 'cat_bills',
            account_id: updated.account_id || null,
            payment_method: updated.payment_method || 'card',
            auto_log_expense: Boolean(updated.auto_log_expense),
            is_subscription_mirror: true,
            subscription_id: updated.id,
            cover_url: updated.cover_url || null,
          }
          if (existing) {
            await updateMirrorBill(existing.id, mirrorData)
          } else {
            await createMirrorBill({
              id: uuidv4(),
              created_at: new Date().toISOString(),
              ...mirrorData,
              paid_months: {},
            })
          }
        } else {
          await removeMirrorBills(id)
        }
        await syncGoal('update', updated)
      }
      return updated
    },
    async deleteSubscription(id) {
      lsSet(key, (lsGet(key, []) || []).filter((x) => x.id !== id))
      await removeMirrorBills(id)
      await syncGoal('delete', { id })
    }
  }
}
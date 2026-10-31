import { supabase } from '../supabase'
import { addToSyncQueue, getOfflineTransactions, saveOfflineTransactions, isOnline, getSyncQueue } from '../sync'
import { DEFAULT_PROFILE } from './guest-store'
import { generateId, lsGet, lsSet, wrapError } from './shared'
import { migrateLegacyTxMeta, clearLegacyTxMetaKeys, readLegacyReceiptCache } from './tx-meta-migration'
import { normalizeAccountType } from '../categories'

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

export function supabaseStore(userId, userMeta = {}) {
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
    // Normalkan type agar nilai di luar enum account_type (mis. 'bank' dari data
    // lama atau payload backup) tidak ditolak Postgres saat insert/update.
    async createAccount(a) { const { data, error } = await table('accounts').insert({ ...a, type: normalizeAccountType(a?.type), user_id: uid }).select().maybeSingle(); throwIf(error); return data },
    async updateAccount(id, patch) { const p = patch && 'type' in patch ? { ...patch, type: normalizeAccountType(patch.type) } : patch; const { data, error } = await table('accounts').update(p).eq('id', id).eq('user_id', uid).select().maybeSingle(); throwIf(error); return data },
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

      const offlineList = getOfflineTransactions()
      saveOfflineTransactions([{ ...cleanPayload, _synced: false }, ...offlineList.filter((x) => x.id !== id)])

      if (!isOnline()) {
        addToSyncQueue('insert', 'transactions', cleanPayload)
        return { ...cleanPayload, id, _synced: false }
      }

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

    // Impor rekening koran: cek kapabilitas server (tabel import_batches +
    // kolom fingerprint/import_batch_id). Jika migrasi SQL belum dijalankan,
    // impor tetap jalan tanpa pelacakan batch/undo.
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

    async getReceiptCache(txId, receiptUrl = null) {
      const row = await this.listTransactions().then((list) => list.find((x) => x.id === txId))
      if (row?.receipt_cache) return row.receipt_cache
      return readLegacyReceiptCache(receiptUrl, txId)
    },
    async saveReceiptCache(txId, cache, receiptUrl = null) {
      await this.updateTransaction(txId, { receipt_cache: cache })
      clearLegacyTxMetaKeys(txId, receiptUrl)
    },
    async saveTxMeta(id, patch) {
      return this.updateTransaction(id, patch)
    },
    async getTxMeta(id) {
      const tx = await this.listTransactions().then((list) => list.find((x) => x.id === id))
      return tx ? { split: tx.split, storage_provider: tx.storage_provider } : null
    },
  }
}

// lib/sync.js
// Offline-first sync queue management for Arshif PWA

const SYNC_QUEUE_KEY = 'arshif_sync_queue'
const OFFLINE_TXS_KEY = 'arshif_offline_txs'

const lsGet = (k, fallback = []) => {
  if (typeof window === 'undefined') return fallback
  try {
    const v = localStorage.getItem(k)
    return v ? JSON.parse(v) : fallback
  } catch {
    return fallback
  }
}

const lsSet = (k, val) => {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(k, JSON.stringify(val))
  } catch {}
}

export function isOnline() {
  if (typeof navigator === 'undefined') return true
  return navigator.onLine !== false
}

export function getSyncQueue() {
  return lsGet(SYNC_QUEUE_KEY, [])
}

export function getOfflineTransactions() {
  return lsGet(OFFLINE_TXS_KEY, [])
}

export function saveOfflineTransactions(txs) {
  lsSet(OFFLINE_TXS_KEY, txs)
}

function broadcastSyncState(detail) {
  if (typeof window === 'undefined') return
  try {
    window.dispatchEvent(new CustomEvent('arshif_sync_state', { detail }))
  } catch {}
}

export function addToSyncQueue(action, table = 'transactions', payload = {}) {
  const currentQueue = getSyncQueue()
  const id =
    payload.id ||
    (typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `tx_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`)

  const item = {
    id,
    action, // 'insert' | 'update' | 'delete'
    table: table || 'transactions',
    payload: { ...payload, id },
    timestamp: Date.now(),
  }

  // Deduplicate / replace earlier action for the same ID if appropriate
  const existingIdx = currentQueue.findIndex((q) => q.id === id && q.table === table)
  let updatedQueue = []

  if (action === 'delete') {
    // If was just inserted offline and not yet sent to server, remove both
    const wasPendingInsert = currentQueue.some((q) => q.id === id && q.action === 'insert')
    if (wasPendingInsert) {
      updatedQueue = currentQueue.filter((q) => q.id !== id)
    } else {
      updatedQueue = [...currentQueue.filter((q) => q.id !== id), item]
    }
  } else if (existingIdx >= 0) {
    const prev = currentQueue[existingIdx]
    const mergedAction = prev.action === 'insert' ? 'insert' : action
    updatedQueue = [...currentQueue]
    updatedQueue[existingIdx] = {
      ...item,
      action: mergedAction,
      payload: { ...prev.payload, ...item.payload },
    }
  } else {
    updatedQueue = [...currentQueue, item]
  }

  lsSet(SYNC_QUEUE_KEY, updatedQueue)

  // Maintain offline transactions cache
  if (table === 'transactions') {
    const offlineList = getOfflineTransactions()
    if (action === 'delete') {
      saveOfflineTransactions(offlineList.filter((t) => t.id !== id))
    } else {
      const idx = offlineList.findIndex((t) => t.id === id)
      const txItem = { ...payload, id, _synced: false }
      if (idx >= 0) {
        offlineList[idx] = { ...offlineList[idx], ...txItem }
        saveOfflineTransactions(offlineList)
      } else {
        saveOfflineTransactions([txItem, ...offlineList])
      }
    }
  }

  broadcastSyncState({
    isOffline: !isOnline(),
    isSyncing: false,
    queueCount: updatedQueue.length,
  })

  return item
}

// Filter allowed Supabase columns to avoid PGRST204 errors
const ALLOWED_TX_COLUMNS = [
  'id',
  'user_id',
  'type',
  'amount',
  'currency',
  'home_currency',
  'home_currency_amount',
  'rate',
  'category',
  'subcategory',
  'payment_method',
  'account_id',
  'destination_account_id',
  'to_account_id',
  'bill_id',
  'billing_month',
  'auto_logged',
  'fee',
  'note',
  'description',
  'merchant',
  'receipt_number',
  'receipt_url',
  'items',
  'tax_deductible',
  'is_tax_deductible',
  'category_id',
  'date',
  'transaction_date',
  'created_at',
]

function cleanPayloadForUpsert(payload) {
  if (!payload || typeof payload !== 'object') return payload
  const clean = {}
  for (const k of ALLOWED_TX_COLUMNS) {
    if (payload[k] !== undefined) {
      clean[k] = payload[k]
    }
  }
  return clean
}

let isCurrentlySyncing = false

export async function flushSyncQueue(supabase, onStatusChange) {
  if (typeof window === 'undefined') return { synced: 0 }
  if (!isOnline()) {
    onStatusChange?.({ isOffline: true, isSyncing: false, queueCount: getSyncQueue().length })
    broadcastSyncState({ isOffline: true, isSyncing: false, queueCount: getSyncQueue().length })
    return { synced: 0 }
  }

  if (isCurrentlySyncing) return { synced: 0 }

  const queue = getSyncQueue()
  if (!queue || queue.length === 0) {
    onStatusChange?.({ isOffline: false, isSyncing: false, queueCount: 0 })
    broadcastSyncState({ isOffline: false, isSyncing: false, queueCount: 0 })
    return { synced: 0 }
  }

  isCurrentlySyncing = true
  onStatusChange?.({ isOffline: false, isSyncing: true, queueCount: queue.length })
  broadcastSyncState({ isOffline: false, isSyncing: true, queueCount: queue.length })

  let syncedCount = 0
  let failedCount = 0
  const failedIds = []
  const remaining = [...queue]

  try {
    for (let i = 0; i < queue.length; i++) {
      const item = queue[i]
      if (!isOnline()) break

      try {
        if (item.action === 'insert' || item.action === 'update') {
          const clean = cleanPayloadForUpsert(item.payload)
          const { error } = await supabase.from(item.table).upsert(clean)
          if (error) {
            // Check if network error vs schema/error — network errors stop retry;
            // non-network errors persist in the queue but MUST surface to the user
            // so they know the cloud write failed instead of silently dropping it.
            if (/network|fetch|timeout|connection/i.test(error.message || '')) {
              break // Stop syncing until connection improves
            }
            console.warn(`Sync queue item ${item.id} error:`, error)
            failedCount++
            failedIds.push(item.id)
            // Do NOT remove — keep retrying on next online cycle
          } else {
            syncedCount++
            // Remove from remaining queue
            const remIdx = remaining.findIndex((r) => r.id === item.id)
            if (remIdx >= 0) remaining.splice(remIdx, 1)
            lsSet(SYNC_QUEUE_KEY, remaining)
          }
        } else if (item.action === 'delete') {
          const { error } = await supabase.from(item.table).delete().eq('id', item.id)
          if (error) {
            if (/network|fetch|timeout|connection/i.test(error.message || '')) {
              break
            }
            console.warn(`Sync queue delete item ${item.id} error:`, error)
            failedCount++
            failedIds.push(item.id)
          } else {
            syncedCount++
            const remIdx = remaining.findIndex((r) => r.id === item.id)
            if (remIdx >= 0) remaining.splice(remIdx, 1)
            lsSet(SYNC_QUEUE_KEY, remaining)
          }
        }
      } catch (opErr) {
        console.warn(`Sync execution error for item ${item.id}:`, opErr)
        if (/network|fetch|offline|Failed to fetch/i.test(opErr?.message || '')) {
          break
        }
        failedCount++
        failedIds.push(item.id)
      }
    }
  } finally {
    isCurrentlySyncing = false
    lsSet(SYNC_QUEUE_KEY, remaining)
    const queueCount = remaining.length
    onStatusChange?.({ isOffline: !isOnline(), isSyncing: false, queueCount, failedCount, hasFailures: failedCount > 0 })
    broadcastSyncState({ isOffline: !isOnline(), isSyncing: false, queueCount, failedCount, hasFailures: failedCount > 0 })
    // Surface non-network failures to the UI so the user knows cloud sync did not
    // silently succeed. Network-break items are just queued for later retries.
    if (failedCount > 0) {
      broadcastSyncState({ isOffline: false, isSyncing: false, queueCount, failedCount, hasFailures: true })
    }
  }

  return { synced: syncedCount, remaining: remaining.length }
}

export function initSyncListener(supabase, onComplete) {
  if (typeof window === 'undefined') return () => {}

  const handleOnline = async () => {
    broadcastSyncState({ isOffline: false, isSyncing: true, queueCount: getSyncQueue().length })
    try {
      const res = await flushSyncQueue(supabase, (status) => {
        broadcastSyncState(status)
      })
      if (res.synced > 0) {
        onComplete?.(res)
      }
    } catch (e) {
      console.warn('Sync on online error:', e)
    }
  }

  const handleOffline = () => {
    broadcastSyncState({ isOffline: true, isSyncing: false, queueCount: getSyncQueue().length })
  }

  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)

  // Trigger flush immediately if online and pending items exist
  if (isOnline() && getSyncQueue().length > 0) {
    handleOnline()
  }

  return () => {
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
  }
}

import { supabase } from '../supabase'
import { isMissingColumnError, lsGet, lsSet } from './shared'

// Metadata transaksi dulu hidup di localStorage per-perangkat
// (arshif_tx_split_*, arshif_tx_storage_*, arshif_receipt_cache_*) sehingga
// tidak pernah ikut sinkron. Sekarang tersimpan di kolom DB
// (transactions.split / storage_provider / receipt_cache) dan key lama
// dimigrasikan sekali lalu dibersihkan.
const TX_META_MIGRATED_KEY = (uid) => `arshif_tx_meta_migrated_${uid}`
const txMetaMigrations = new Map()

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

export function readLegacyReceiptCache(receiptUrl, txId) {
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

export function clearLegacyTxMetaKeys(id, receiptUrl) {
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
export async function migrateLegacyTxMeta(uid) {
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

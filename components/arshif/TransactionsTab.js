'use client'
import { useMemo, useState, useRef, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Search, Receipt, MoreVertical, Download, Upload, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useApp } from './context'
import { Segmented, Card, EmptyState, ErrorBoundary } from './ui'
import SwipeTransactionRow from './SwipeTransactionRow'
import { applyTxToBalances } from '@/lib/ledger'

const LOCALE_BY_LANG = { en: 'en-GB', tr: 'tr-TR', ms: 'ms-MY', id: 'id-ID' }

// Safe date -> yyyy-mm-dd key. Never throws on null/invalid input.
function dayKey(d) {
  if (!d) return 'unknown'
  try {
    const x = typeof d === 'string' || typeof d === 'number' ? new Date(d) : d
    if (isNaN(x.getTime())) return 'unknown'
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
  } catch {
    return 'unknown'
  }
}

export function safeFormatDate(d, locale = 'en-GB', options = { weekday: 'short', day: 'numeric', month: 'short' }) {
  if (!d) return '-'
  try {
    const x = typeof d === 'string' || typeof d === 'number' ? new Date(d) : d
    if (isNaN(x.getTime())) return '-'
    return x.toLocaleDateString(locale, options)
  } catch {
    return '-'
  }
}

function TransactionsContent() {
  const { t, transactions = [], open, fmt, home, convertToHome, lang, store, refresh, accounts = [], rates, hideBalance, deleteTransaction } = useApp()
  const [filter, setFilter] = useState('all')
  const [q, setQ] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [openRowId, setOpenRowId] = useState(null)
  const [deletingTx, setDeletingTx] = useState(null)

  const handleEdit = (tx) => {
    open?.('addTx', { ...tx, editId: tx?.id })
  }

  const handleDelete = (tx) => {
    setDeletingTx(tx)
  }

  const confirmDelete = async () => {
    if (!deletingTx?.id) return
    const target = deletingTx
    setDeletingTx(null) // Close confirmation modal immediately
    try {
      if (deleteTransaction) {
        await deleteTransaction(target)
      } else {
        await applyTxToBalances(store, accounts, target, -1, rates)
        await store?.deleteTransaction?.(target.id)
        if (refresh) await refresh()
      }
      toast.success(t('deleted'))
    } catch {
      toast.error(t('error'))
    }
  }

  const list = Array.isArray(transactions) ? transactions : []

  const groups = useMemo(() => {
    const filtered = (list || [])
      .filter((tx) => filter === 'all' || tx?.type === filter)
      .filter((tx) => {
        if (!q) return true
        const s = `${tx?.note || ''} ${tx?.description || ''} ${tx?.merchant || ''} ${tx?.category || ''} ${tx?.amount ?? ''}`.toLowerCase()
        return s.includes(q.toLowerCase())
      })
    const map = new Map()
    ;(filtered || []).forEach((tx) => {
      const k = dayKey(tx?.date || tx?.transaction_date || tx?.created_at)
      if (!map.has(k)) map.set(k, [])
      map.get(k).push(tx)
    })
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1))
  }, [list, filter, q])

  const today = dayKey(new Date())
  const yesterday = dayKey(new Date(Date.now() - 86400000))

  // Safe label - never crashes on null / invalid dates.
  const labelFor = (k) => {
    if (!k || k === 'unknown') return t('recent') !== 'recent' ? t('recent') : 'Recent'
    if (k === today) return t('today')
    if (k === yesterday) return t('yesterday')
    return safeFormatDate(k, LOCALE_BY_LANG[lang] || 'en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
  }

  // Safe multi-currency net: if conversion isn't ready, fall back to raw amount.
  const safeToHome = (amount, currency) => {
    const raw = Number(amount) || 0
    if (typeof convertToHome !== 'function') return raw
    try {
      const v = convertToHome(raw, currency)
      return typeof v === 'number' && !isNaN(v) ? v : raw
    } catch {
      return raw
    }
  }

  const safeFmt = (amount, code) => {
    try {
      return typeof fmt === 'function' ? fmt(amount, code) : String(amount ?? '')
    } catch {
      return String(amount ?? '')
    }
  }

  // Render bertahap: cuma render jendela awal, tambah otomatis saat scroll
  // Ratusan baris sekaligus = ratusan GPU layer + swipe listener = scroll jank di HP.
  const PAGE = 60
  const [visibleCount, setVisibleCount] = useState(PAGE)
  const sentinelRef = useRef(null)

  const groupMeta = useMemo(() => {
    const m = new Map()
    for (const [k, dayList] of groups) {
      const net = (dayList || []).reduce((s, tx) => {
        const v = safeToHome(tx?.amount, tx?.currency)
        return tx?.type === 'expense' ? s - v : tx?.type === 'income' ? s + v : s
      }, 0)
      m.set(k, { dayList: dayList || [], net })
    }
    return m
  }, [groups])

  const flat = useMemo(() => {
    const out = []
    for (const [k] of groups) {
      out.push({ t: 'h', k })
      for (const tx of groupMeta.get(k).dayList) out.push({ t: 'r', k, tx })
    }
    return out
  }, [groups, groupMeta])

  useEffect(() => { setVisibleCount(PAGE) }, [groups])

  useEffect(() => {
    const el = sentinelRef.current
    if (!el || visibleCount >= flat.length) return
    const io = new IntersectionObserver(
      (es) => { if (es[0]?.isIntersecting) setVisibleCount((c) => Math.min(c + PAGE, flat.length)) },
      { rootMargin: '800px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [flat.length, visibleCount])

  // Bangun kembali struktur grup dari irisan yang dirender
  const rendered = []
  {
    let cur = null
    for (const it of flat.slice(0, visibleCount)) {
      if (it.t === 'h') { cur = { k: it.k, rows: [] }; rendered.push(cur) }
      else if (cur) cur.rows.push(it.tx)
    }
  }

  return (
    <div className="px-5 pb-28">
      <div className="flex items-center justify-between pt-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-zinc-950 dark:text-white">{t('transactions')}</h1>
        <div className="relative">
          <button type="button" onClick={() => setMenuOpen((v) => !v)} className="h-9 w-9 rounded-full flex items-center justify-center text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 active:bg-zinc-200 transition" aria-label="menu" data-testid="tx-menu"><MoreVertical size={20} /></button>
          {menuOpen ? (
            <>
              <div className="fixed inset-0 z-[45]" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-11 z-[46] w-52 rounded-2xl bg-white dark:bg-[#1c1c1e] border border-zinc-200 dark:border-white/10 shadow-xl overflow-hidden py-1">
                <button type="button" onClick={() => { setMenuOpen(false); open?.('exportTx') }} className="w-full flex items-center gap-3 px-4 py-3 text-left text-[15px] font-semibold text-zinc-950 dark:text-white hover:bg-zinc-100 dark:hover:bg-white/5" data-testid="tx-menu-export"><Download size={17} strokeWidth={1.75} /> {t('export_transactions')}</button>
                <button type="button" onClick={() => { setMenuOpen(false); open?.('importTx') }} className="w-full flex items-center gap-3 px-4 py-3 text-left text-[15px] font-semibold text-zinc-950 dark:text-white hover:bg-zinc-100 dark:hover:bg-white/5" data-testid="tx-menu-import"><Upload size={17} strokeWidth={1.75} /> {t('import_transactions')}</button>
              </div>
            </>
          ) : null}
        </div>
      </div>
      <div className="w-full py-2 box-border">
        <div className="relative flex items-center w-full">
          <Search className="absolute left-3.5 text-muted-foreground pointer-events-none shrink-0" size={16} />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('search')}
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl text-base bg-muted/40 border border-border/40 text-foreground placeholder-muted-foreground outline-none focus:border-border transition-colors"
            data-testid="tx-search"
          />
        </div>
      </div>
      <Segmented
        className="mt-3"
        size="sm"
        value={filter}
        onChange={setFilter}
        options={[{ id: 'all', label: t('all') }, { id: 'expense', label: t('expense') }, { id: 'income', label: t('income_tab') }, { id: 'transfer', label: t('transfer') }]}
      />

      {groups.length === 0 ? (
        <Card className="mt-4"><EmptyState icon={Receipt} title={t('no_transactions')} subtitle={t('no_transactions_sub')} /></Card>
      ) : (
        <>
          {rendered.map(({ k, rows }) => {
            const net = groupMeta.get(k)?.net || 0
            return (
              <div key={k} className="mt-5">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex justify-between items-center mb-2 px-1">
                  <span>{labelFor(k)}</span>
                  <span className="tabular-nums">
                    {hideBalance ? '••••••' : `${net < 0 ? '-' : '+'}${safeFmt(Math.abs(net), home)}`}
                  </span>
                </div>
                <div className="rounded-2xl border border-border/40 bg-card overflow-hidden divide-y divide-border/30 mb-4 touch-pan-y shadow-xs">
                  <AnimatePresence>
                    {rows.map((tx, i) => (
                      <motion.div
                        key={tx?.id ?? `${k}-${i}`}
                        initial={false}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.18 }}
                      >
                        <SwipeTransactionRow
                          transaction={tx}
                          isGrouped
                          isOpen={openRowId === tx?.id}
                          onOpenChange={(v) => setOpenRowId(v ? tx?.id : null)}
                          onOpenDetail={() => open?.('txDetail', tx)}
                          onEdit={handleEdit}
                          onDelete={handleDelete}
                        />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            )
          })}
          <div ref={sentinelRef} className="h-2" aria-hidden="true" />
        </>
      )}

      {/* Delete Confirmation Dialog */}
      {deletingTx && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-[#121214] border border-zinc-200 dark:border-white/10 p-6 shadow-2xl text-center space-y-4">
            <div className="h-14 w-14 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 mx-auto flex items-center justify-center">
              <Trash2 size={28} />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-950 dark:text-white">
                {t('clear_confirm_title')}
              </h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-2 leading-relaxed">
                {deletingTx?.merchant || deletingTx?.note || deletingTx?.description ? `"${deletingTx.merchant || deletingTx.note || deletingTx.description}" - ` : ''}{t('clear_confirm_body')}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setDeletingTx(null)}
                className="w-full rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-bold py-2.5 text-sm transition-all active:scale-95 cursor-pointer"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="w-full rounded-xl bg-rose-600 text-white font-bold py-2.5 text-sm transition-all active:scale-95 cursor-pointer hover:bg-rose-700"
              >
                {t('delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function TransactionsTab() {
  const { t } = useApp()
  const fallback = (
    <div className="px-5 pb-28">
      <h1 className="text-2xl font-extrabold tracking-tight pt-6">{t ? t('transactions') : 'Transactions'}</h1>
      <Card className="mt-6">
        <EmptyState icon={Receipt} title={t ? t('no_transactions') : 'No transactions yet'} subtitle={t ? t('no_transactions_sub') : ''} />
      </Card>
    </div>
  )
  return (
    <ErrorBoundary fallback={fallback}>
      <TransactionsContent />
    </ErrorBoundary>
  )
}

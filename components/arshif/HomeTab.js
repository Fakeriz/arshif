'use client'
import { useState, useCallback, useEffect, useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Bell, Eye, EyeOff, Receipt, Plus, ChevronRight, Trash2, WifiOff, RefreshCw } from 'lucide-react'
import { DocumentOutline, ReceiptOutline, Profile2userOutline, ChartPieOutline } from './ReiconIcons'
import { toast } from 'sonner'
import { useApp } from './context'
import { Avatar, Card, SectionLabel, EmptyState } from './ui'
import SwipeTransactionRow from './SwipeTransactionRow'
import { BankCard, FocalAccountCard } from './BankCard'
import AccountDeck from './AccountDeck'
import { edgeAccent } from '@/lib/accountDeck'
import { cn } from '@/lib/utils'
import { applyTxToBalances } from '@/lib/ledger'
import { deriveNotifications } from '@/lib/notifications'
import { supabase } from '@/lib/supabase'
import { APP_VERSION } from '@/lib/version'

export function safeFormatDate(d, locale = 'en-GB', options = { weekday: 'short', day: 'numeric', month: 'short' }) {
  if (!d) return '—'
  try {
    const x = typeof d === 'string' || typeof d === 'number' ? new Date(d) : d
    if (isNaN(x.getTime())) return '—'
    return x.toLocaleDateString(locale, options)
  } catch {
    return '—'
  }
}

function Header() {
  const {
    t,
    profile,
    open,
    isGuest,
    bills = [],
    budgets = [],
    goals = [],
    transactions = [],
    home = 'USD',
    rates = {},
    fmt,
  } = useApp()
  const first = (profile?.full_name || '').trim().split(' ')[0]

  const [hasUnreadAnnouncements, setHasUnreadAnnouncements] = useState(false)
  const [isOffline, setIsOffline] = useState(() => (typeof navigator !== 'undefined' ? !navigator.onLine : false))
  const [isSyncing, setIsSyncing] = useState(false)

  useEffect(() => {
    const updateOnline = () => {
      setIsOffline(typeof navigator !== 'undefined' ? !navigator.onLine : false)
    }
    const handleSyncState = (e) => {
      if (e?.detail) {
        if (e.detail.isOffline !== undefined) setIsOffline(e.detail.isOffline)
        if (e.detail.isSyncing !== undefined) setIsSyncing(e.detail.isSyncing)
        // Surface cloud-sync failures to the user so they know not all data
        // made it to the server (catches schema / RLS errors that were
        // previously swallowed with only a console.warn).
        if (e.detail.hasFailures === true && e.detail.failedCount > 0) {
          toast.error(
            e.detail.failedCount === 1
              ? '1 item gagal disinkron ke cloud, coba lagi nanti'
              : `${e.detail.failedCount} item gagal disinkron ke cloud, coba lagi nanti`
          )
        }
      }
    }
    window.addEventListener('online', updateOnline)
    window.addEventListener('offline', updateOnline)
    window.addEventListener('arshif_sync_state', handleSyncState)
    return () => {
      window.removeEventListener('online', updateOnline)
      window.removeEventListener('offline', updateOnline)
      window.removeEventListener('arshif_sync_state', handleSyncState)
    }
  }, [])

  useEffect(() => {
    try {
      const stored = localStorage.getItem('arshif_app_version')
      if (stored !== APP_VERSION) {
        localStorage.setItem('arshif_app_version', APP_VERSION)
        toast(`Arshif diperbarui ke ${APP_VERSION}`)
      }
    } catch {}
  }, [])

  const checkUnreadAnnouncements = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('announcements')
        .select('id')
        .eq('is_active', true)
      if (!error && Array.isArray(data) && data.length > 0) {
        let readIds = []
        try {
          readIds = JSON.parse(localStorage.getItem('read_announcements') || '[]')
        } catch {}
        const unread = (data || []).some((a) => !(readIds || []).includes(a?.id))
        setHasUnreadAnnouncements(unread)
      } else {
        setHasUnreadAnnouncements(false)
      }
    } catch {
      setHasUnreadAnnouncements(false)
    }
  }, [])

  useEffect(() => {
    checkUnreadAnnouncements()
    const handleReadUpdated = () => checkUnreadAnnouncements()
    window.addEventListener('read_announcements_updated', handleReadUpdated)
    window.addEventListener('storage', handleReadUpdated)
    return () => {
      window.removeEventListener('read_announcements_updated', handleReadUpdated)
      window.removeEventListener('storage', handleReadUpdated)
    }
  }, [checkUnreadAnnouncements])

  const { hasUrgent } = useMemo(() => {
    return deriveNotifications({
      bills,
      budgets,
      goals,
      transactions,
      home,
      rates,
      fmt,
      t,
    })
  }, [bills, budgets, goals, transactions, home, rates, fmt, t])

  const hasBadge = hasUrgent || hasUnreadAnnouncements

  return (
    <div className="flex items-center justify-between pt-2">
      <div className="flex items-center gap-3">
        <Avatar profile={profile} onClick={() => open('profile')} data-testid="avatar" />
        <div>
          <div className="flex items-center gap-2">
            <p className="text-lg font-bold leading-tight text-zinc-950 dark:text-white" data-testid="greeting">{t('hi')}, {first || t('user')}</p>
            {isOffline ? (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-white/10 shrink-0"
                data-testid="offline-badge"
              >
                <WifiOff size={13} strokeWidth={2} />
                <span>{t('offline_mode')}</span>
              </span>
            ) : isSyncing ? (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-white/10 shrink-0"
                data-testid="syncing-badge"
              >
                <RefreshCw size={13} strokeWidth={2} className="animate-spin" />
                <span>Syncing...</span>
              </span>
            ) : null}
          </div>
          {isGuest ? <p className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mt-0.5">{t('guest_mode')}</p> : null}
        </div>
      </div>
      <button
        type="button"
        onClick={() => open('notifications')}
        className="h-10 w-10 rounded-full bg-white border border-border/70 text-foreground dark:bg-[#121214] dark:border-white/10 dark:text-white flex items-center justify-center transition-colors relative shadow-xs"
        aria-label="notifications"
      >
        <Bell size={18} />
        {hasBadge && (
          <span
            className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-[#121214]"
            data-testid="notification-dot"
          />
        )}
      </button>
    </div>
  )
}

/**
 * Total balance card for the Home deck.
 * Small caption above a large tabular amount, monochrome depth, and a
 * 32px eye toggle target.
 */
export function TotalBalanceCard() {
  const { t, fmt, home, stats, hideBalance, setHideBalance } = useApp()

  const mask = (v) => (hideBalance ? '\u2022\u2022\u2022\u2022\u2022\u2022' : v)

  // formatMoney selalu "<simbol> <digit>" (minus opsional di depan),
  // mis. "RM 1,121.32" -> simbol "RM", nominal "1,121.32".
  const raw = String(fmt(stats?.totalBalance || 0, home))
  const m = !hideBalance && raw.match(/^(-?)([^\d\s]+)\s+(.+)$/)
  const balCcy = m ? m[2] : null
  const balMain = m ? `${m[1]}${m[3]}` : raw

  return (
    <div
      className="h-full w-full rounded-[19px] p-5 sm:p-6 relative overflow-hidden flex flex-col justify-between select-none text-[#090A0D] border border-black/10 bg-gradient-to-br from-[#FF5F6D] to-[#FF9966]"
      data-testid="balance-card"
    >
      {/* Depth: sheen diagonal + hairline highlight atas — cahaya radial dihapus agar tidak melebihi dose cap glow (R-13) */}
      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.03] to-white/[0.07] pointer-events-none" />
      <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent pointer-events-none" />

      {/* Group Saldo: Ditarik ke TENGAH-KIRI kartu secara vertikal (my-auto) */}
      <div className="relative z-10 flex flex-col gap-1 my-auto text-left">
        {/* Baris Label & Toggle Eye Murni */}
        <div className="flex items-center gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#090A0D]/60 select-none">
            {t('balance')}
          </p>
          <button
            type="button"
            onClick={() => setHideBalance(!hideBalance)}
            className="text-[#090A0D]/60 hover:text-[#090A0D] rounded-full transition-colors cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#090A0D]/60 p-0 bg-transparent border-0 flex items-center justify-center"
            aria-label="toggle balance"
          >
            {hideBalance ? <EyeOff size={13} strokeWidth={1.75} /> : <Eye size={13} strokeWidth={1.75} />}
          </button>
        </div>

        {/* Baris Angka Nominal (Tetap rapat 4px di bawah SALDO) */}
        <p className="flex items-baseline gap-1.5 tabular-nums leading-none m-0" data-testid="total-balance">
          {balCcy && (
            <span className="text-base sm:text-lg font-bold text-[#090A0D]/70 shrink-0 select-none">
              {balCcy}
            </span>
          )}
          <span className="text-[32px] sm:text-4xl font-extrabold tracking-tight text-[#090A0D] select-text truncate">
            {mask(balMain)}
          </span>
        </p>
      </div>

      {/* Income & Spending */}
      <div className="grid grid-cols-2 gap-2 relative z-10 mt-2.5">
        <div className="rounded-xl bg-black/[0.07] border border-black/10 px-2.5 py-2">
          <div className="text-[#090A0D]/60 text-[9px] font-semibold uppercase tracking-[0.12em]">
            {t('income')}
          </div>
          <p className="font-bold text-[11px] tabular-nums text-[#090A0D]/90 mt-0.5 truncate">
            {mask(fmt(stats?.income || 0, home))}
          </p>
        </div>
        <div className="rounded-xl bg-black/[0.07] border border-black/10 px-2.5 py-2">
          <div className="text-[#090A0D]/60 text-[9px] font-semibold uppercase tracking-[0.12em]">
            {t('spending')}
          </div>
          <p className="font-bold text-[11px] tabular-nums text-[#090A0D]/90 mt-0.5 truncate">
            {mask(fmt(stats?.spending || 0, home))}
          </p>
        </div>
      </div>
    </div>
  )
}

function BalanceCarousel() {
  const { t, fmt, home, stats, accounts = [], hideBalance, setHideBalance, open, convertToHome } = useApp()
  const [idx, setIdx] = useState(0)
  const totalSlides = 1 + accounts.length + 1 // [Total, ...accounts, Add]

  // Clamp posisi aktif bila jumlah kartu berubah (mis. akun dihapus)
  useEffect(() => {
    setIdx((i) => Math.max(0, Math.min(i, totalSlides - 1)))
  }, [totalSlides])

  const goTo = useCallback((i) => setIdx(Math.max(0, Math.min(i, totalSlides - 1))), [totalSlides])

  // Slide di-memo agar identitas stabil. AccountDeck menyinkronkan berbasis ID,
  // bukan identitas array — re-render parent tidak me-reset posisi kartu.
  const slides = useMemo(
    () => [
      {
        id: 'total',
        label: t('total_balance'),
        accent: '#8B929E',
        node: <TotalBalanceCard />,
      },
      // Kartu akun: motif fisik BankCard
      ...(accounts || []).map((a) => ({
        id: `account-${a.id}`,
        label: a.name,
        accent: edgeAccent(a.theme),
        node: (
          <FocalAccountCard
            name={a.name}
            balance={a.balance}
            currency={a.currency}
            theme={a.theme}
            logo={a.logo}
            type={a.type}
            id={a.id}
            fmt={fmt}
            hideBalance={hideBalance}
            approxHome={a.currency !== home ? fmt(convertToHome(a.balance, a.currency), home) : null}
            className="h-full w-full"
          />
        ),
      })),
      // Tambah akun
      {
        id: 'add',
        label: t('new_account'),
        accent: '#8B929E',
        node: (
          <button
            type="button"
            onClick={() => open('newAccount')}
            className="w-full h-full rounded-[19px] border-2 border-dashed border-border/80 bg-card flex flex-col items-center justify-center text-muted-foreground gap-3 hover:border-zinc-950 dark:hover:border-white hover:text-foreground transition-all active:scale-[0.99] group"
            data-testid="add-account-card"
          >
            <div className="h-12 w-12 rounded-full bg-zinc-100 text-zinc-900 dark:bg-white/10 dark:text-white flex items-center justify-center group-hover:scale-105 group-hover:bg-[#0c0c0e] group-hover:text-white dark:group-hover:bg-white dark:group-hover:text-[#0c0c0e] transition-all">
              <Plus size={22} strokeWidth={2.2} />
            </div>
            <span className="text-sm font-bold text-foreground group-hover:text-foreground transition-colors">{t('new_account')}</span>
          </button>
        ),
      },
    ],
    [t, fmt, home, stats, accounts, hideBalance, setHideBalance, open, convertToHome]
  )

  return (
    <div className="mt-1 w-full max-w-[390px] sm:max-w-[420px] mx-auto">
      <AccountDeck
        slides={slides}
        index={idx}
        onIndexChange={setIdx}
        regionLabel={t('accounts')}
      />

      {/* Indikator halaman: deck yang menggeser kartu, jadi tiap dot hanya perlu
          satu kontrol. Hit area 44x44px dengan visual tetap kecil, dan
          aria-current menandai posisi aktif. */}
      <div className="flex flex-wrap justify-center items-center mt-1">
        {slides.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => goTo(i)}
            aria-label={`${s.label} (${i + 1} dari ${slides.length})`}
            aria-current={i === idx ? 'true' : undefined}
            className="group h-11 w-11 shrink-0 rounded-full border-0 bg-transparent p-0 flex items-center justify-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
          >
            <span
              className={cn(
                'block rounded-full transition-all duration-300',
                i === idx
                  ? 'h-1.5 w-6 bg-[#E23D4C] dark:bg-gradient-to-r dark:from-[#FF5F6D] dark:to-[#FF9966]'
                  : 'h-1.5 w-1.5 bg-muted-foreground/40 group-hover:bg-muted-foreground/70'
              )}
            />
          </button>
        ))}
      </div>
    </div>
  )
}

export function QuickGrid() {
  const { t, open, bills = [], transactions = [] } = useApp()

  // Hierarki + info sekilas: badge dihitung dengan logika yang sama seperti
  // BillsTrackerSheet ("belum dibayar bulan ini").
  const now = new Date()
  const mKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const today = now.getDate()
  const unpaidBills = (bills || []).filter((b) => !((b?.paid_months || {})[mKey]))
  const overdueBills = unpaidBills.filter((b) => (Number(b?.due_day) || 1) < today)
  const receiptCount = (transactions || []).filter((tx) => Boolean(tx?.receipt_url)).length

  const items = [
    {
      id: 'receipts',
      label: t('receipts'),
      icon: ReceiptOutline,
      onClick: () => open('receiptGallery'),
      badge: receiptCount,
      tone: 'quiet',
    },
    { id: 'split', label: t('bill_split'), icon: Profile2userOutline, onClick: () => open('split'), tone: 'idle' },
    {
      id: 'bills',
      label: t('bills'),
      icon: DocumentOutline,
      onClick: () => open('bills'),
      badge: unpaidBills.length,
      // Tile yang menuntut perhatian dapat aksen: overdue (rose) > due (amber).
      tone: overdueBills.length > 0 ? 'overdue' : unpaidBills.length > 0 ? 'due' : 'idle',
    },
    { id: 'analytics', label: t('analytics'), icon: ChartPieOutline, onClick: () => open('analytics'), tone: 'idle' },
  ]
  return (
    <div className="grid grid-cols-4 gap-3 mt-4">
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          onClick={it.onClick}
          data-testid={`quick-${it.id}`}
          aria-label={it.badge > 0 ? `${it.label} (${it.badge})` : it.label}
          className="flex flex-col items-center gap-2 group"
        >
          <div
            className={cn(
              'relative h-14 w-14 rounded-2xl border flex items-center justify-center transition active:scale-95 shadow-xs',
              it.tone === 'overdue' && 'bg-rose-500/10 border-rose-500/60 text-rose-500 dark:text-rose-400',
              it.tone === 'due' && 'bg-amber-500/10 border-amber-500/60 text-amber-600 dark:text-amber-400',
              (it.tone === 'idle' || it.tone === 'quiet') &&
                'bg-white border-border/70 text-foreground dark:bg-[#121214] dark:border-white/10 dark:text-white group-hover:border-foreground/40'
            )}
          >
            {/* Ikon Reicon: fill/stroke bawaan dari reicon.dev, tidak perlu strokeWidth */}
            <it.icon size={24} />
            {it.badge > 0 && (
              <span
                className={cn(
                  'absolute -top-1.5 -right-1.5 h-5 min-w-5 px-1 rounded-full text-[10px] font-bold tabular-nums flex items-center justify-center shadow',
                  it.tone === 'overdue' && 'bg-rose-500 text-white',
                  it.tone === 'due' && 'bg-amber-400 text-zinc-950',
                  it.tone === 'quiet' && 'bg-zinc-500/30 text-zinc-100'
                )}
              >
                {it.badge}
              </span>
            )}
          </div>
          <span
            className={cn(
              'text-[11px] font-semibold transition-colors',
              it.tone === 'idle' || it.tone === 'quiet'
                ? 'text-muted-foreground group-hover:text-foreground'
                : 'text-foreground'
            )}
          >
            {it.label}
          </span>
        </button>
      ))}
    </div>
  )
}

export default function HomeTab() {
  const { t, transactions = [], setTab, open, isGuest, store, refresh, accounts = [], rates, deleteTransaction, hideBalance } = useApp()
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
    setDeletingTx(null) // Close modal immediately
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

  const recent = (transactions || []).slice(0, 6)
  return (
    // overflow-x-clip: sudut kartu yang miring saat drag boleh melukis ke area
    // padding, tapi tidak boleh membuat halaman bisa scroll horizontal.
    <div className="px-5 pb-28 overflow-x-clip">
      <Header />
      {isGuest ? (
        <div className="mt-4 rounded-xl bg-zinc-100 border border-zinc-200 dark:bg-zinc-900 dark:border-white/10 px-3 py-2 text-[11px] text-zinc-600 dark:text-zinc-400">{t('demo_banner')}</div>
      ) : null}
      <BalanceCarousel />
      <QuickGrid />

      {/* Jarak atas antar section mt-6, jarak bawah ke card mb-2.5 (persis seperti Target Tabungan) */}
      <div className="flex items-center justify-between mt-6 mb-2.5">
        <SectionLabel>{t('recent_transactions')}</SectionLabel>
        <button 
          type="button" 
          onClick={() => setTab('transactions')} 
          className="text-xs font-semibold flex items-center gap-0.5 text-zinc-950 dark:text-white hover:opacity-80 transition-opacity"
        >
          {t('see_all')} <ChevronRight size={14} />
        </button>
      </div>

      {recent.length === 0 ? (
        <Card className="px-4 py-8">
          <EmptyState icon={Receipt} title={t('no_transactions')} subtitle={t('no_transactions_sub')} />
        </Card>
      ) : (
        <div className="rounded-2xl border border-border/40 bg-card overflow-hidden divide-y divide-border/30 mb-4 touch-pan-y shadow-xs">
          <AnimatePresence mode="popLayout">
            {(recent || []).map((tx) => (
              <motion.div
                key={tx?.id || Math.random()}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ type: "spring", stiffness: 350, damping: 30, mass: 0.8 }}
                className="transform-gpu will-change-transform"
              >
                <SwipeTransactionRow
                  transaction={tx}
                  isGrouped
                  isOpen={openRowId === tx?.id}
                  onOpenChange={(v) => setOpenRowId(v ? tx?.id : null)}
                  onOpenDetail={() => open('txDetail', tx)}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  hideBalance={hideBalance}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deletingTx && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-[#1c1c1e] border border-zinc-200 dark:border-white/10 p-6 shadow-2xl text-center space-y-4">
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


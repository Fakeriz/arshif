'use client'
import { useState, useEffect } from 'react'
import { motion, useAnimation } from 'framer-motion'
import { Pencil, Trash2, ArrowLeftRight } from 'lucide-react'
import { useApp } from './context'
import { CategoryIcon } from './ui'
import { getCurrency } from '@/lib/currencies'
import { cn } from '@/lib/utils'

// Safe time/date formatting — never throws on null/invalid values.
const safeTime = (dateStr, locale) => {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    return isNaN(d.getTime()) ? '' : d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

const safeDay = (dateStr) => {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    return isNaN(d.getTime()) ? 'Recent' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
  } catch {
    return 'Recent'
  }
}

export default function SwipeTransactionRow({
  transaction,
  tx: propTx,
  isOpen,
  onOpenChange,
  onOpenDetail,
  onClick,
  onEdit,
  onDelete,
  showDate = false,
  isGrouped = false,
  hideBalance: propHideBalance,
}) {
  const tx = transaction || propTx
  const { t, fmt, accounts, home, lang, convertToHome, hideBalance: contextHideBalance } = useApp()
  const isHidden = propHideBalance !== undefined ? propHideBalance : contextHideBalance

  const [internalOpen, setInternalOpen] = useState(false)
  const controls = useAnimation()
  const ACTION_WIDTH = 110

  const SPRING_CONFIG = { type: 'spring', stiffness: 350, damping: 30, mass: 0.8 }

  useEffect(() => {
    if (isOpen !== undefined) {
      setInternalOpen(isOpen)
      controls.start({
        x: isOpen ? -ACTION_WIDTH : 0,
        transition: SPRING_CONFIG,
      })
    }
  }, [isOpen, controls])

  if (!tx) return null

  const handleDragEnd = async (_, info) => {
    if (info.offset.x < -40 || info.velocity.x < -250) {
      await controls.start({ x: -ACTION_WIDTH, transition: SPRING_CONFIG })
      setInternalOpen(true)
      onOpenChange?.(true)
    } else {
      await controls.start({ x: 0, transition: SPRING_CONFIG })
      setInternalOpen(false)
      onOpenChange?.(false)
    }
  }

  const closeSwipe = () => {
    controls.start({ x: 0, transition: SPRING_CONFIG })
    setInternalOpen(false)
    onOpenChange?.(false)
  }

  const handleCardClick = () => {
    if (internalOpen) {
      closeSwipe()
      return
    }
    if (typeof onClick === 'function') {
      onClick(tx)
    } else if (typeof onOpenDetail === 'function') {
      onOpenDetail(tx)
    }
  }

  const accList = Array.isArray(accounts) ? accounts : []
  const isExpense = tx?.type === 'expense'
  const isTransfer = tx?.type === 'transfer'
  const acc = accList.find((a) => a?.id === tx?.account_id)
  const toAcc = accList.find((a) => a?.id === tx?.to_account_id)
  const title = tx?.merchant || tx?.note || tx?.description || (t ? t(`cat_${tx?.category || 'other'}`) : (tx?.category || 'Other'))
  const foreign = tx?.currency && tx?.currency !== home

  let homeAmount = null
  try {
    homeAmount = typeof convertToHome === 'function' ? convertToHome(tx?.amount, tx?.currency) : tx?.converted_amount
  } catch { homeAmount = null }
  const showHomeApprox = foreign && typeof homeAmount === 'number' && !isNaN(homeAmount)

  const locale = lang === 'en' ? 'en-US' : lang === 'tr' ? 'tr-TR' : lang === 'ms' ? 'ms-MY' : 'id-ID'
  const timeStr = safeTime(tx?.date || tx?.transaction_date, locale)
  const dateStr = showDate ? safeDay(tx?.date || tx?.transaction_date) : ''

  const safeFmt = (amount, code) => {
    try { return typeof fmt === 'function' ? fmt(amount, code) : String(amount ?? '') } catch { return String(amount ?? '') }
  }

  const sub = [
    isTransfer ? `${acc?.name || '?'} → ${toAcc?.name || '?'}` : acc?.name,
    dateStr || timeStr,
  ].filter(Boolean).join(' · ')

  return (
    <div
      className={cn(
        'relative overflow-hidden select-none touch-pan-y',
        isGrouped ? 'my-0' : 'rounded-2xl my-1.5'
      )}
      data-testid="tx-swipe-row"
    >
      {/* Lapisan Belakang (Background Actions - Z-0) */}
      <div className="absolute inset-y-0 right-0 flex items-center justify-end pr-3 gap-2 w-full z-0 pointer-events-auto">
        <button
          type="button"
          onClick={() => {
            closeSwipe()
            onEdit?.(tx)
          }}
          className="w-9 h-9 rounded-xl bg-muted/70 text-foreground flex items-center justify-center active:scale-90 transition-transform shadow-xs cursor-pointer"
          aria-label="edit transaction"
          data-testid="tx-swipe-edit"
        >
          <Pencil size={16} strokeWidth={2} />
        </button>
        <button
          type="button"
          onClick={() => {
            closeSwipe()
            onDelete?.(tx)
          }}
          className="w-9 h-9 rounded-xl bg-rose-500 text-white flex items-center justify-center active:scale-90 transition-transform shadow-xs cursor-pointer"
          aria-label="delete transaction"
          data-testid="tx-swipe-delete"
        >
          <Trash2 size={16} strokeWidth={2} />
        </button>
      </div>

      {/* Lapisan Depan (Foreground Motion Card - Z-10) */}
      <motion.div
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: -110, right: 0 }}
        dragElastic={0.12}
        onDragEnd={handleDragEnd}
        animate={controls}
        onClick={handleCardClick}
        className={cn(
          'relative z-10 bg-card p-3.5 flex items-center justify-between w-full cursor-pointer transition-colors transform-gpu will-change-transform',
          isGrouped
            ? 'rounded-none border-0'
            : 'border border-border/40 rounded-2xl shadow-xs'
        )}
      >
        {/* Sisi Kiri: Ikon squircle kategori rounded-2xl + Nama transaksi tebal + Subteks "Kategori · Akun · Waktu" */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {isTransfer ? (
            <div className="w-11 h-11 rounded-2xl bg-foreground text-background flex items-center justify-center shrink-0">
              <ArrowLeftRight size={18} strokeWidth={2} />
            </div>
          ) : (
            <div className="w-11 h-11 rounded-2xl bg-foreground text-background flex items-center justify-center shrink-0">
              <CategoryIcon id={tx?.category} size={18} />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate text-foreground">{title}</p>
            <p className="text-xs text-muted-foreground truncate mt-0.5">{sub}</p>
          </div>
        </div>

        {/* Sisi Kanan: Nominal angka tebal + Subteks konversi sekunder */}
        <div className="text-right shrink-0 ml-3">
          <p className={cn('text-sm font-bold tabular-nums', isTransfer ? 'text-muted-foreground' : 'text-foreground')}>
            {isHidden 
              ? '••••••' 
              : `${isExpense ? '-' : isTransfer ? '' : '+'}${safeFmt(tx?.amount, tx?.currency)}`}
          </p>
          {showHomeApprox ? (
            <span className="inline-block mt-0.5 text-[10px] font-semibold rounded-md bg-muted/60 dark:bg-zinc-800 px-1.5 py-0.5 text-muted-foreground tabular-nums">
              {isHidden ? '••••••' : `≈ ${safeFmt(homeAmount, home)}`}
            </span>
          ) : null}
        </div>
      </motion.div>
    </div>
  )
}


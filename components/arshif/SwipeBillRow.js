'use client'
import { useState } from 'react'
import { motion, useAnimation } from 'framer-motion'
import { Pencil, Trash2, Check } from 'lucide-react'
import { CategoryIcon } from './ui'
import { cn } from '@/lib/utils'

export default function SwipeBillRow({
  bill,
  isPaid,
  isMirror,
  home,
  fmt,
  t,
  onToggle,
  onEdit,
  onDelete,
  onShowSyncedAlert,
}) {
  const [isOpen, setIsOpen] = useState(false)
  const controls = useAnimation()
  const ACTION_WIDTH = 110

  const handleDragEnd = async (_, info) => {
    if (info.offset.x < -40 || info.velocity.x < -250) {
      await controls.start({ x: -ACTION_WIDTH, transition: { type: 'spring', stiffness: 400, damping: 32 } })
      setIsOpen(true)
    } else {
      await controls.start({ x: 0, transition: { type: 'spring', stiffness: 400, damping: 32 } })
      setIsOpen(false)
    }
  }

  const closeSwipe = () => {
    controls.start({ x: 0, transition: { type: 'spring', stiffness: 400, damping: 32 } })
    setIsOpen(false)
  }

  const handleCardClick = () => {
    if (isOpen) {
      closeSwipe()
      return
    }
    if (isMirror) {
      onShowSyncedAlert?.(bill)
    }
  }

  const catId = bill.category?.startsWith('cat_')
    ? bill.category.replace('cat_', '')
    : bill.category || 'bills'

  return (
    <div className="relative overflow-hidden rounded-2xl select-none my-2 touch-pan-y" data-testid="bill-swipe-row">
      {/* Background Layer: Absolute right positioned under the card */}
      <div className="absolute inset-y-0 right-0 flex items-center justify-end pr-3 gap-2 w-full z-0 pointer-events-auto">
        <button
          type="button"
          onClick={() => {
            closeSwipe()
            if (isMirror) {
              onShowSyncedAlert?.(bill)
            } else {
              onEdit?.(bill)
            }
          }}
          className="w-9 h-9 rounded-xl bg-zinc-200 dark:bg-zinc-800 text-foreground flex items-center justify-center shadow-xs active:scale-90 transition-transform cursor-pointer"
          aria-label={t('aria_edit_bill')}
          data-testid="bill-swipe-edit"
        >
          <Pencil size={17} strokeWidth={2} />
        </button>
        <button
          type="button"
          onClick={() => {
            closeSwipe()
            if (isMirror) {
              onShowSyncedAlert?.(bill)
            } else {
              onDelete?.(bill)
            }
          }}
          className="w-9 h-9 rounded-xl bg-rose-500 text-white flex items-center justify-center shadow-xs active:scale-90 transition-transform cursor-pointer"
          aria-label={t('aria_delete_bill')}
          data-testid="bill-swipe-delete"
        >
          <Trash2 size={17} strokeWidth={2} />
        </button>
      </div>

      {/* Foreground Motion Card: Solid background & higher z-index (z-10) to completely hide actions when resting */}
      <motion.div
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: -110, right: 0 }}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        animate={controls}
        onClick={handleCardClick}
        className={cn(
          'relative z-10 w-full bg-white dark:bg-[#18181b] border border-border/40 dark:border-white/10 rounded-2xl p-4 flex items-center justify-between shadow-xs transition-colors',
          isPaid && 'bg-zinc-50 dark:bg-[#141416]',
          isMirror && 'hover:border-emerald-500/40 cursor-pointer'
        )}
      >
        {/* Sisi Kiri: Lingkaran centang hijau + Ikon squircle kategori + Judul tagihan + Subteks tanggal tempo */}
        <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
          {/* Lingkaran centang hijau */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onToggle?.(bill)
            }}
            className={cn(
              'h-7 w-7 rounded-full border-2 flex items-center justify-center shrink-0 transition-all active:scale-90 cursor-pointer',
              isPaid
                ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm'
                : 'border-zinc-300 dark:border-zinc-700 hover:border-emerald-500 text-transparent'
            )}
            aria-label="toggle bill paid"
            data-testid="bill-toggle"
          >
            {isPaid ? <Check size={16} strokeWidth={3} /> : null}
          </button>

          {/* Ikon squircle kategori */}
          <div className="h-10 w-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 flex items-center justify-center shrink-0">
            <CategoryIcon id={catId} size={18} />
          </div>

          {/* Judul tagihan + Subteks tanggal tempo */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className={cn(
                  'text-sm font-bold truncate block',
                  isPaid ? 'line-through text-zinc-400 dark:text-zinc-500' : 'text-zinc-950 dark:text-white'
                )}
              >
                {bill.title}
              </span>
              {isMirror && (
                <span className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                  {t('synced_badge')}
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">
              {t('due_on_day', { day: bill.due_day || 1 })}
            </p>
          </div>
        </div>

        {/* Sisi Kanan: HANYA berisi teks nominal saldo tebal, TANPA tombol edit/hapus di baris yang sama */}
        <div className="text-right shrink-0">
          <span
            className={cn(
              'text-sm font-bold text-foreground tabular-nums tracking-tight block',
              isPaid ? 'text-zinc-400 dark:text-zinc-500' : 'text-zinc-950 dark:text-white'
            )}
          >
            {fmt(bill.amount, bill.currency || home)}
          </span>
        </div>
      </motion.div>
    </div>
  )
}

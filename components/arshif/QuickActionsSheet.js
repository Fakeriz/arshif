'use client'

import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Pencil, Camera, Flag, Mic } from 'lucide-react'
import { useHaptic } from '@/hooks/useHaptic'
import { useApp } from './context'

export default function QuickActionsSheet({ open, onClose, onSelectAction }) {
  const { t, open: openSheet, setTab, isAiAllowed } = useApp() || {}
  const haptic = useHaptic()

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (open) {
      window.dispatchEvent(new CustomEvent('arshif-sheet-toggle', { detail: { open: true } }))
      document.body?.setAttribute?.('data-arshif-sheet-open', 'true')
      document.body.style.overflow = 'hidden'
    } else {
      window.dispatchEvent(new CustomEvent('arshif-sheet-toggle', { detail: { open: false } }))
      document.body?.removeAttribute?.('data-arshif-sheet-open')
      document.body.style.overflow = ''
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('arshif-sheet-toggle', { detail: { open: false } }))
        document.body?.removeAttribute?.('data-arshif-sheet-open')
        document.body.style.overflow = ''
      }
    }
  }, [open])

  const items = [
    {
      id: 'addTx',
      title: t?.('add_transaction') || 'Add Transaction',
      subtitle: t?.('add_tx_sub') || 'Income, expense, or transfer',
      icon: Pencil,
      badge: null,
      testId: 'qa-addTx',
    },
    {
      id: 'scanReceipt',
      title: t?.('scan_receipt') || 'Scan Receipt',
      subtitle: t?.('scan_receipt_sub') || 'Instant AI-powered OCR capture',
      icon: Camera,
      badge: 'AI',
      testId: 'qa-scanReceipt',
    },
    {
      id: 'savings',
      title: t?.('add_to_savings') || 'Add to Savings',
      subtitle: t?.('add_to_savings_sub') || 'Allocate funds to your goals',
      icon: Flag,
      badge: null,
      testId: 'qa-savings',
    },
    {
      id: 'voiceLog',
      title: t?.('voice_log') || 'Voice Log',
      subtitle: t?.('voice_log_sub') || 'Just speak your expenses naturally',
      icon: Mic,
      badge: 'AI',
      testId: 'qa-voiceLog',
    },
  ]

  const handleSelect = (actionId) => {
    haptic?.buttonPress?.()
    onClose?.()

    if (onSelectAction) {
      onSelectAction(actionId)
    } else {
      // Default routing fallback
      setTimeout(() => {
        if (actionId === 'addTx') {
          openSheet?.('addTx')
        } else if (actionId === 'scanReceipt') {
          if (!isAiAllowed) {
            openSheet?.('aiPremium')
          } else {
            openSheet?.('scan')
          }
        } else if (actionId === 'savings') {
          setTab?.('goals')
        } else if (actionId === 'voiceLog') {
          if (!isAiAllowed) {
            openSheet?.('aiPremium')
          } else {
            openSheet?.('voice')
          }
        }
      }, 120)
    }
  }

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 pointer-events-auto">
          {/* Dark overlay backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => {
              haptic?.buttonPress?.()
              onClose?.()
            }}
            className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-xs cursor-pointer"
            aria-hidden="true"
          />

          {/* Bottom Sheet Container with Drag Gesture */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{
              type: 'spring',
              stiffness: 350,
              damping: 30,
              mass: 0.8,
            }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(e, info) => {
              if (info.offset.y > 80 || info.velocity.y > 400) onClose?.()
            }}
            className="relative w-full max-w-md rounded-t-[28px] sm:rounded-3xl bg-white dark:bg-[#0c0c0e] border-t sm:border border-zinc-200/80 dark:border-white/10 p-5 pt-3 pb-8 sm:pb-6 shadow-2xl z-10 select-none max-h-[90dvh] overflow-y-auto no-scrollbar touch-pan-y transform-gpu will-change-transform"
          >
            {/* Bar penarik sentuh di atas tengah: touch-none cursor-grab active:cursor-grabbing */}
            <div className="w-12 h-1.5 rounded-full bg-zinc-300 dark:bg-zinc-700/80 mx-auto mb-4 touch-none cursor-grab active:cursor-grabbing" />

            {/* Baris judul */}
            <div className="flex items-center justify-between mb-4 px-1">
              <h2 className="text-xl font-bold text-zinc-950 dark:text-white tracking-tight">
                {t?.('quick_actions') || 'Quick Actions'}
              </h2>
              <button
                type="button"
                onClick={() => {
                  haptic?.buttonPress?.()
                  onClose?.()
                }}
                className="text-sm font-semibold text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors cursor-pointer px-1 py-0.5"
                data-testid="qa-cancel"
              >
                {t?.('cancel') || 'Cancel'}
              </button>
            </div>

            {/* Grid 2x2 Kompak (Rata Kiri, Bukan Tombol Sentral) */}
            <div className="grid grid-cols-2 gap-3">
              {items.map((item) => {
                const Icon = item.icon
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelect(item.id)}
                    data-testid={item.testId}
                    className="flex flex-col items-start text-left p-4 rounded-2xl bg-zinc-50 dark:bg-[#141416] border border-zinc-200/80 dark:border-white/5 active:scale-[0.97] transition-all cursor-pointer group"
                  >
                    {/* Header item: Squircle icon + optional badge */}
                    <div className="w-full flex items-start justify-between mb-3">
                      <div className="w-10 h-10 rounded-xl bg-zinc-200/70 dark:bg-zinc-800/80 text-foreground flex items-center justify-center shrink-0 transition-colors group-hover:bg-zinc-300/80 dark:group-hover:bg-zinc-700/80">
                        <Icon size={20} strokeWidth={2} className="text-zinc-900 dark:text-white" />
                      </div>
                      {item.badge && (
                        <span className="text-[10px] font-extrabold tracking-wider uppercase px-1.5 py-0.5 rounded-md bg-zinc-200/80 dark:bg-white/10 text-zinc-800 dark:text-zinc-200">
                          {item.badge}
                        </span>
                      )}
                    </div>

                    {/* Title & subtitle */}
                    <span className="font-bold text-sm text-zinc-950 dark:text-white leading-snug">
                      {item.title}
                    </span>
                    <span className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 leading-normal">
                      {item.subtitle}
                    </span>
                  </button>
                )
              })}
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  )
}

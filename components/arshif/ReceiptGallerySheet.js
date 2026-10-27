'use client'

import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ReceiptText,
  Scan,
  Search,
  Cloud,
  Link2,
  FolderPlus,
  X,
  Eye,
  ExternalLink,
  ChevronRight,
  Image as ImageIcon,
  FileText,
} from 'lucide-react'
import { useApp } from './context'
import { useHaptic } from '@/hooks/useHaptic'
import { cn } from '@/lib/utils'
import { getDriveThumbnailUrl } from './ReceiptPreviewWithDrive'

function ThumbnailImage({ url, merchant }) {
  const [hasError, setHasError] = useState(false)
  const thumbUrl = useMemo(() => getDriveThumbnailUrl(url, 200, merchant), [url, merchant])
  const isPdf = typeof url === 'string' && (url.toLowerCase().endsWith('.pdf') || url.includes('application/pdf'))

  if (isPdf) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center text-zinc-500 dark:text-zinc-400">
        <FileText size={20} strokeWidth={1.8} />
        <span className="text-[9px] font-bold uppercase tracking-wider mt-0.5">PDF</span>
      </div>
    )
  }

  if (hasError || !url) {
    return (
      <div className="w-full h-full flex items-center justify-center text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-800">
        <ImageIcon size={22} strokeWidth={1.8} />
      </div>
    )
  }

  return (
    <img
      src={thumbUrl}
      alt={merchant ? `Receipt for ${merchant}` : 'Receipt thumbnail'}
      className="w-full h-full object-cover"
      referrerPolicy="no-referrer"
      crossOrigin="anonymous"
      loading="lazy"
      onError={() => setHasError(true)}
    />
  )
}

function formatDateGroup(dateStr) {
  if (!dateStr) return 'Recent'
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return 'Recent'
    return d.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    })
  } catch {
    return 'Recent'
  }
}

export default function ReceiptGallerySheet({ open, onClose, onOpenScanner }) {
  const { t, transactions = [], fmt, home, open: openSheet } = useApp() || {}
  const haptic = useHaptic()

  const [activeFolder, setActiveFolder] = useState('all') // 'all' | 'unfiled' | custom
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [previewImage, setPreviewImage] = useState(null)

  // Listen to sheet toggle for BottomNav auto-hiding
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

  // Filter only transactions with receipt_url
  const receiptTxs = useMemo(() => {
    return (transactions || []).filter((tx) => Boolean(tx?.receipt_url))
  }, [transactions])

  // Filter based on folder and search query
  const filteredTxs = useMemo(() => {
    return receiptTxs.filter((tx) => {
      // Folder filter
      if (activeFolder === 'unfiled') {
        // If transaction has no custom tag or folder
        if (tx.folder) return false
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const merchant = (tx.merchant || '').toLowerCase()
        const note = (tx.note || '').toLowerCase()
        const category = (tx.category || '').toLowerCase()
        const receiptNo = (tx.receipt_number || '').toLowerCase()
        if (
          !merchant.includes(q) &&
          !note.includes(q) &&
          !category.includes(q) &&
          !receiptNo.includes(q)
        ) {
          return false
        }
      }

      return true
    })
  }, [receiptTxs, activeFolder, searchQuery])

  // Group transactions by date
  const groupedTxs = useMemo(() => {
    const groups = {}
    filteredTxs.forEach((tx) => {
      const dateKey = formatDateGroup(tx.date || tx.transaction_date || tx.created_at)
      if (!groups[dateKey]) {
        groups[dateKey] = []
      }
      groups[dateKey].push(tx)
    })

    return Object.entries(groups).map(([dateLabel, txList]) => ({
      dateLabel,
      txList,
    }))
  }, [filteredTxs])

  const handleScanAction = () => {
    haptic?.buttonPress?.()
    onClose?.()
    if (onOpenScanner) {
      onOpenScanner()
    } else {
      setTimeout(() => {
        openSheet?.('scanReceipt') || openSheet?.('scan')
      }, 120)
    }
  }

  const handleCardClick = (tx) => {
    haptic?.buttonPress?.()
    onClose?.()
    setTimeout(() => {
      openSheet?.('txDetail', tx)
    }, 120)
  }

  const handleNewFolder = () => {
    haptic?.buttonPress?.()
    setActiveFolder('unfiled')
  }

  const handleOpenCloudBackup = () => {
    haptic?.buttonPress?.()
    openSheet?.('cloudBackup')
  }

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center pointer-events-auto">
          {/* Backdrop Overlay */}
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

          {/* Full Bottom Sheet Container with Drag Gesture */}
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
            className="relative w-full max-w-md h-[92vh] rounded-t-[32px] bg-white dark:bg-[#0c0c0e] border-t border-zinc-200/80 dark:border-white/10 shadow-2xl z-10 flex flex-col overflow-hidden select-none transform-gpu will-change-transform"
          >
            {/* Top Touch Handle: touch-none cursor-grab active:cursor-grabbing */}
            <div className="pt-3 pb-1 shrink-0 touch-none cursor-grab active:cursor-grabbing">
              <div className="w-12 h-1.5 rounded-full bg-zinc-300 dark:bg-zinc-700/80 mx-auto" />
            </div>

            {/* Header: Cancel (left) | Title + summary (center) | Cloud/Search (right) */}
            <header className="px-5 py-3 flex items-center justify-between shrink-0 border-b border-zinc-100 dark:border-white/5">
              {/* Left: Cancel button */}
              <button
                type="button"
                onClick={() => {
                  haptic?.buttonPress?.()
                  onClose?.()
                }}
                className="text-sm font-semibold text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white transition-colors cursor-pointer px-1 py-1"
                data-testid="gallery-cancel"
              >
                {t?.('cancel') || 'Cancel'}
              </button>

              {/* Center: Title + item count */}
              <div className="text-center px-2">
                <h2 className="text-base font-bold text-zinc-950 dark:text-white tracking-tight leading-tight">
                  {t?.('receipts') || 'Receipts'}
                </h2>
                <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 tabular-nums">
                  {receiptTxs.length} {receiptTxs.length === 1 ? 'item' : 'items'}
                </p>
              </div>

              {/* Right: Cloud backup & Search toggle */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowSearch(!showSearch)}
                  aria-label={t('aria_search_receipts')}
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer',
                    showSearch
                      ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950'
                      : 'text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  )}
                  data-testid="gallery-search-toggle"
                >
                  <Search size={16} strokeWidth={2} />
                </button>
                <button
                  type="button"
                  onClick={handleOpenCloudBackup}
                  aria-label={t('aria_cloud_receipt_backup')}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                  data-testid="gallery-cloud-btn"
                >
                  <Cloud size={16} strokeWidth={2} />
                </button>
              </div>
            </header>

            {/* Optional Collapsible Search Bar */}
            {showSearch ? (
              <div className="px-5 pt-3 pb-1 shrink-0 animate-in fade-in duration-150">
                <div className="relative flex items-center">
                  <Search size={15} className="absolute left-3.5 text-zinc-400 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari merchant, catatan, atau kategori..."
                    className="w-full h-10 pl-9 pr-8 rounded-xl bg-zinc-100 dark:bg-[#18181b] border border-zinc-200/80 dark:border-white/10 text-xs text-zinc-950 dark:text-white placeholder:text-zinc-400 outline-none focus:border-zinc-400 dark:focus:border-white/20 transition-all"
                    autoFocus
                  />
                  {searchQuery ? (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                    >
                      <X size={14} />
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}

            {/* Filter / Folder Bar: Tab pill horizontal */}
            <div className="px-5 py-3 flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
              {/* Tab: All */}
              <button
                type="button"
                onClick={() => {
                  haptic?.buttonPress?.()
                  setActiveFolder('all')
                }}
                className={cn(
                  'rounded-full px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer shrink-0',
                  activeFolder === 'all'
                    ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 shadow-xs'
                    : 'text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white border border-transparent'
                )}
                data-testid="folder-all"
              >
                All ({receiptTxs.length})
              </button>

              {/* Tab: Unfiled (border transparan) */}
              <button
                type="button"
                onClick={() => {
                  haptic?.buttonPress?.()
                  setActiveFolder('unfiled')
                }}
                className={cn(
                  'rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer shrink-0',
                  activeFolder === 'unfiled'
                    ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 shadow-xs'
                    : 'text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white border border-transparent'
                )}
                data-testid="folder-unfiled"
              >
                Unfiled
              </button>

              {/* Tab: New folder (border dashed) */}
              <button
                type="button"
                onClick={handleNewFolder}
                className="rounded-full px-3 py-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:border-zinc-500 dark:hover:border-zinc-400 border border-dashed border-zinc-300 dark:border-zinc-700 flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                data-testid="folder-new"
              >
                <FolderPlus size={13} strokeWidth={2} />
                <span>{t('new_folder')}</span>
              </button>
            </div>

            {/* Content Area: Scrollable */}
            <div className="flex-1 overflow-y-auto px-5 pb-8 overscroll-contain">
              {receiptTxs.length === 0 ? (
                /* 3. Empty State Interaktif (Jika Struk Kosong) */
                <div className="h-full min-h-[380px] flex flex-col items-center justify-center text-center px-4">
                  {/* Soft gray circular container with ReceiptText icon */}
                  <div className="w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-800/80 flex items-center justify-center text-zinc-400 dark:text-zinc-500 mb-4 shadow-xs">
                    <ReceiptText size={32} strokeWidth={1.5} />
                  </div>

                  {/* Title & Subtext */}
                  <h3 className="text-xl font-bold text-zinc-950 dark:text-white tracking-tight mb-2">
                    {t('no_receipts_title')}
                  </h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center max-w-[280px] mb-6 leading-relaxed">
                    {t('no_receipts_sub')}
                  </p>

                  {/* Action Button: Solid contrast black/white with Scan icon */}
                  <button
                    type="button"
                    onClick={handleScanAction}
                    className="flex items-center gap-2 px-6 py-3.5 rounded-full bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 font-bold text-sm shadow-lg shadow-black/10 active:scale-95 transition-all cursor-pointer"
                    data-testid="gallery-empty-scan-btn"
                  >
                    <Scan size={18} strokeWidth={2.2} />
                    <span>{t('scan_receipt_btn')}</span>
                  </button>
                </div>
              ) : filteredTxs.length === 0 ? (
                /* Empty state when search query or filter has no results */
                <div className="min-h-[260px] flex flex-col items-center justify-center text-center px-4">
                  <Search size={28} className="text-zinc-400 mb-3" />
                  <p className="font-bold text-sm text-zinc-950 dark:text-white">
                    No matching receipts found
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                    Try searching with another keyword or reset the filter.
                  </p>
                </div>
              ) : (
                /* 4. Daftar Populated: Grouped by date */
                <div className="space-y-6 pt-1">
                  {groupedTxs.map((group) => (
                    <div key={group.dateLabel} className="space-y-2.5">
                      {/* Date header */}
                      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 px-1">
                        {group.dateLabel}
                      </p>

                      {/* Cards list */}
                      <div className="space-y-2">
                        {group.txList.map((tx) => {
                          const merchantName =
                            tx.merchant ||
                            tx.note ||
                            tx.description ||
                            t?.(`cat_${tx.category || 'other'}`) ||
                            'RECEIPT'

                          return (
                            <div
                              key={tx.id}
                              onClick={() => handleCardClick(tx)}
                              className="flex items-center gap-3.5 p-3 rounded-2xl bg-zinc-50 dark:bg-[#141416] border border-zinc-200/80 dark:border-white/5 active:scale-[0.98] transition-all cursor-pointer group hover:border-zinc-300 dark:hover:border-white/10"
                              data-testid={`receipt-card-${tx.id}`}
                            >
                              {/* Left: Thumbnail image (52px x 52px) */}
                              <div
                                onClick={(e) => {
                                  e.stopPropagation()
                                  haptic?.buttonPress?.()
                                  setPreviewImage(getDriveThumbnailUrl(tx.receipt_url, 1200, merchantName))
                                }}
                                className="w-[52px] h-[52px] rounded-xl overflow-hidden shrink-0 bg-zinc-200/80 dark:bg-zinc-800/80 flex items-center justify-center relative cursor-zoom-in group/thumb"
                                title={t('click_to_enlarge') || 'Click to enlarge'}
                              >
                                <ThumbnailImage url={tx.receipt_url} merchant={merchantName} />
                                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center transition-opacity text-white">
                                  <Eye size={16} strokeWidth={2} />
                                </div>
                              </div>

                              {/* Center: Link2 icon, Merchant text (bold & uppercase), Category */}
                              <div className="flex-1 min-w-0 text-left">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <Link2 size={13} className="text-zinc-400 shrink-0" />
                                  <span className="font-bold text-sm text-zinc-950 dark:text-white uppercase truncate">
                                    {merchantName}
                                  </span>
                                </div>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate mt-0.5 font-medium">
                                  {t?.(`cat_${tx.category || 'other'}`) || tx.category || 'General'}
                                </p>
                              </div>

                              {/* Right: Nominal amount */}
                              <div className="text-right shrink-0">
                                <span
                                  className={cn(
                                    'text-sm font-bold tabular-nums',
                                    tx.type === 'income'
                                      ? 'text-emerald-500 dark:text-emerald-400'
                                      : 'text-red-500 dark:text-red-400'
                                  )}
                                >
                                  {tx.type === 'income' ? '+' : '-'}
                                  {fmt?.(tx.amount, tx.currency || home)}
                                </span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>

          {/* Fullscreen Image Preview Lightbox */}
          {previewImage ? (
            <div
              className="fixed inset-0 z-[80] bg-black/95 flex items-center justify-center p-4 cursor-pointer"
              onClick={() => setPreviewImage(null)}
            >
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                aria-label={t('aria_close_image_preview')}
                className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
              <img
                src={previewImage}
                alt="Receipt preview"
                referrerPolicy="no-referrer"
                crossOrigin="anonymous"
                className="max-h-[85vh] max-w-full object-contain rounded-xl select-none"
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </AnimatePresence>
  )
}

'use client'
import { useApp } from './context'
import { CategoryBadge } from './ui'
import { getCurrency } from '@/lib/currencies'
import { cn } from '@/lib/utils'
import { ArrowLeftRight } from 'lucide-react'

// Pembersih otomatis kata awalan seperti "Beli", "Bayar", "Jajan", dll.
function formatCleanTitle(tx, fallback) {
  // 1. Jika ada nama merchant asli yang bukan kata kerja, pakai nama merchant
  if (tx?.merchant && !/^(beli|jajan|bayar|pesan|order|topup|tarik)\b/i.test(tx.merchant.trim())) {
    return tx.merchant.trim()
  }

  // 2. Ambil dari nama items (jika multi-item) atau note/description
  let raw =
    (Array.isArray(tx?.items) && tx.items.length > 0 ? tx.items.map((i) => i.name).join(' & ') : '') ||
    tx?.note ||
    tx?.description ||
    fallback ||
    'Transaksi'

  // 3. Pangkas kata awalan "beli", "jajan", "bayar", "pesan"
  const cleaned = raw.replace(/^(beli|jajan|bayar|pesan|order|belanja)\s+/i, '').trim()

  return cleaned ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : fallback || 'Transaksi'
}

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

export default function TransactionRow({ tx, onClick, showDate = false, hideBalance: propHideBalance }) {
  const { t, fmt, accounts, home, lang, convertToHome, hideBalance: contextHideBalance } = useApp()
  const isHidden = propHideBalance !== undefined ? propHideBalance : contextHideBalance
  if (!tx) return null

  const accList = Array.isArray(accounts) ? accounts : []
  const isExpense = tx?.type === 'expense'
  const isTransfer = tx?.type === 'transfer'
  const acc = accList.find((a) => a?.id === tx?.account_id)
  const toAcc = accList.find((a) => a?.id === tx?.to_account_id)
  
  // Ambil judul bersih tanpa repetisi kata "Beli"
  const categoryFallback = t ? t(`cat_${tx?.category || 'other'}`) : (tx?.category || 'Other')
  const title = formatCleanTitle(tx, categoryFallback)

  const foreign = tx?.currency && tx?.currency !== home

  // Guard conversion — only show ≈ home amount when we actually have a number.
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
    <button type="button" onClick={onClick} className="w-full flex items-center gap-3 py-3 text-left active:opacity-70 transition" data-testid="transaction-row">
      {isTransfer ? (
        <div className="h-11 w-11 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white flex items-center justify-center shrink-0"><ArrowLeftRight size={18} /></div>
      ) : (
        <CategoryBadge id={tx?.category} className={cn(!isExpense && 'bg-zinc-100 text-zinc-950 dark:bg-zinc-800 dark:text-white')} />
      )}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-[15px] truncate text-zinc-950 dark:text-white">{title}</p>
        <p className="text-xs text-zinc-600 dark:text-zinc-400 truncate mt-0.5">{sub}</p>
      </div>
      <div className="text-right shrink-0">
        <p className={cn('font-bold text-[15px] tabular-nums', isTransfer ? 'text-zinc-600 dark:text-zinc-400' : 'text-zinc-950 dark:text-white')}>
          {isHidden ? '••••••' : `${isExpense ? '-' : isTransfer ? '' : '+'}${safeFmt(tx?.amount, tx?.currency)}`}
        </p>
        {showHomeApprox ? (
          <span className="inline-block mt-0.5 text-[10px] font-semibold rounded-md bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 text-zinc-600 dark:text-zinc-400 tabular-nums">
            {isHidden ? '••••••' : `≈ ${safeFmt(homeAmount, home)}`}
          </span>
        ) : null}
      </div>
    </button>
  )
}
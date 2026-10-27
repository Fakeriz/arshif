'use client'

import { Loader2 } from 'lucide-react'

export function QuotaBadge({ quota, loading }) {
  if (loading) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border border-zinc-200/80 dark:border-white/10 shrink-0">
        <Loader2 size={10} className="animate-spin" />
        <span>Memuat...</span>
      </span>
    )
  }
  if (!quota) return null
  const isUnlimited = !!quota.is_unlimited
  return (
    <span
      data-testid="ai-quota-badge"
      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-200/80 dark:border-white/10 shrink-0"
    >
      {isUnlimited ? 'Unlimited' : `Sisa Kuota: ${quota.remaining} / ${quota.total}`}
    </span>
  )
}

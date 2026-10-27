'use client'
import { useMemo, useState, useEffect } from 'react'
import { Search, Check } from 'lucide-react'
import { useApp } from './context'
import { Sheet, TextInput } from './ui'
import { CURRENCIES } from '@/lib/currencies'
import { cn } from '@/lib/utils'

const POPULAR = ['IDR', 'MYR', 'TRY', 'USD', 'EUR', 'SGD', 'GBP', 'JPY', 'THB', 'PHP', 'VND', 'SAR', 'AED']

export default function CurrencySheet({ open, onClose, value, onSelect, zIndex = 60, title }) {
  const { t } = useApp()
  const [q, setQ] = useState('')
  useEffect(() => { if (open) setQ('') }, [open])

  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    const base = s
      ? CURRENCIES.filter((c) => c.code.toLowerCase().includes(s) || c.name.toLowerCase().includes(s) || c.symbol.toLowerCase().includes(s))
      : [...POPULAR.map((code) => CURRENCIES.find((c) => c.code === code)).filter(Boolean), ...CURRENCIES.filter((c) => !POPULAR.includes(c.code))]
    return base
  }, [q])

  return (
    <Sheet open={open} onClose={onClose} title={title || t('select_currency')} full zIndex={zIndex} noPadding>
      <div className="w-full px-4 py-2 sticky top-0 bg-background z-10 box-border">
        <div className="relative flex items-center w-full">
          <Search className="absolute left-3.5 text-muted-foreground pointer-events-none shrink-0" size={16} />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('search_currency')}
            autoFocus
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl text-sm bg-muted/40 border border-border/40 text-foreground placeholder-muted-foreground outline-none focus:border-border transition-colors"
            data-testid="currency-search"
          />
        </div>
      </div>
      <div className="px-3 pb-10">
        {list.map((c) => {
          const active = c.code === value
          return (
            <button
              key={c.code}
              type="button"
              onClick={() => { onSelect?.(c.code); onClose?.() }}
              className={cn('w-full flex items-center gap-3 rounded-xl px-3 py-3 text-left active:bg-zinc-100 dark:active:bg-zinc-800 transition', active && 'bg-zinc-100 dark:bg-zinc-800')}
              data-testid={`currency-${c.code}`}
            >
              <div className="flex-1 min-w-0">
                <p className="font-bold text-[15px] text-zinc-950 dark:text-white">{c.code} <span className="text-zinc-600 dark:text-zinc-400 font-medium text-sm">· {c.name}</span></p>
              </div>
              <span className="text-sm text-zinc-600 dark:text-zinc-400 font-semibold w-10 text-right">{c.symbol}</span>
              <span className="w-5 text-zinc-950 dark:text-white">{active ? <Check size={18} strokeWidth={2.5} /> : null}</span>
            </button>
          )
        })}
      </div>
    </Sheet>
  )
}

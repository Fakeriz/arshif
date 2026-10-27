'use client'
import { useMemo, useState } from 'react'
import { HeartPulse, Info, PiggyBank, Scale, Shield, Target, X } from 'lucide-react'
import { useApp } from './context'
import { Sheet } from './ui'
import { signedAccountBalance } from '@/lib/ledger'
import { cn } from '@/lib/utils'

const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, isFinite(v) && !isNaN(v) ? v : 0))

// Safe monthly aggregation of transactions converted to home currency.
function useHealthData() {
  const { transactions = [], accounts = [], home, convertToHome } = useApp()
  return useMemo(() => {
    const toHome = (amt, cur) => {
      const raw = Number(amt) || 0
      try { const v = convertToHome ? convertToHome(raw, cur || home) : raw; return isFinite(v) && !isNaN(v) ? v : raw } catch { return raw }
    }
    const now = new Date()
    const inMonth = (transactions || []).filter((tx) => {
      const d = new Date(tx?.date || tx?.created_at || 0)
      return !isNaN(d.getTime()) && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })
    const income = inMonth.filter((t) => t?.type === 'income').reduce((s, t) => s + toHome(t?.amount, t?.currency), 0)
    const expense = inMonth.filter((t) => t?.type === 'expense').reduce((s, t) => s + toHome(t?.amount, t?.currency), 0)
    const obligations = inMonth
      .filter((t) => t?.type === 'expense' && ['bills', 'housing'].includes(t?.category))
      .reduce((s, t) => s + toHome(t?.amount, t?.currency), 0)
    const cash = (accounts || []).reduce((s, a) => s + toHome(signedAccountBalance(a), a?.currency), 0)

    // 1) Savings rate: leftover income (>20% = full score)
    const savingsRate = income > 0 ? (income - expense) / income : 0
    const savingsScore = income > 0 ? clamp((savingsRate / 0.2) * 100) : 0

    // 2) Debt / obligations ratio vs income (<30% = safe)
    const debtRatio = income > 0 ? obligations / income : (obligations > 0 ? 1 : 0)
    const debtScore = income > 0 ? clamp(100 - Math.max(0, (debtRatio - 0.3)) / 0.3 * 100) : (obligations > 0 ? 0 : 60)

    // 3) Emergency fund: cash covering months of expenses (6 months = full)
    const months = expense > 0 ? cash / expense : (cash > 0 ? 6 : 0)
    const emergencyScore = clamp((months / 6) * 100)

    // 4) Budget discipline: spending kept under income (<=70% ideal)
    const expenseRatio = income > 0 ? expense / income : (expense > 0 ? 1.5 : 0)
    const budgetScore = income > 0 ? clamp(100 - Math.max(0, (expenseRatio - 0.7)) / 0.5 * 100) : (expense > 0 ? 0 : 60)

    const total = Math.round(savingsScore * 0.3 + debtScore * 0.25 + emergencyScore * 0.25 + budgetScore * 0.2)

    return {
      income, expense, cash, savingsRate, debtRatio, months, expenseRatio,
      savingsScore, debtScore, emergencyScore, budgetScore, total,
      hasData: (transactions || []).length > 0,
    }
  }, [transactions, accounts, home, convertToHome])
}

function Gauge({ score }) {
  const R = 54
  const C = 2 * Math.PI * R
  const offset = C * (1 - clamp(score) / 100)
  return (
    <div className="relative h-44 w-44 mx-auto">
      <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
        <circle cx="64" cy="64" r={R} fill="none" strokeWidth="10" className="text-zinc-200 dark:text-white/10" stroke="currentColor" />
        <circle cx="64" cy="64" r={R} fill="none" strokeWidth="10" strokeLinecap="round" className="text-foreground transition-[stroke-dashoffset] duration-700" stroke="currentColor" strokeDasharray={C} strokeDashoffset={offset} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-5xl font-extrabold tabular-nums leading-none">{clamp(score)}</span>
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground mt-1">/ 100</span>
      </div>
    </div>
  )
}

function statusBadge(score, t) {
  if (score >= 66) return { label: t('hs_status_good'), cls: 'bg-foreground text-background' }
  if (score >= 40) return { label: t('hs_status_fair'), cls: 'bg-zinc-200 text-zinc-800 dark:bg-white/10 dark:text-zinc-200' }
  return { label: t('hs_status_attention'), cls: 'border border-border/70 text-muted-foreground' }
}

function MetricCard({ icon: Icon, title, desc, score, t }) {
  const b = statusBadge(score, t)
  return (
    <div className="rounded-2xl bg-zinc-100 border border-zinc-200/60 dark:bg-[#141416] dark:border-white/5 p-4">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl bg-background flex items-center justify-center text-foreground shrink-0"><Icon size={17} strokeWidth={1.5} /></div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[15px] leading-tight">{title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
        </div>
        <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold', b.cls)}>{b.label}</span>
      </div>
      <div className="mt-3 h-2 rounded-full bg-zinc-200 dark:bg-white/10 overflow-hidden">
        <div className="h-full rounded-full bg-foreground transition-all duration-700" style={{ width: `${clamp(score)}%` }} />
      </div>
    </div>
  )
}

export default function HealthScoreSheet({ open, onClose }) {
  const { t } = useApp()
  const d = useHealthData()
  const [help, setHelp] = useState(false)
  const b = statusBadge(d.total, t)

  const pct = (v) => `${Math.round(clamp((v || 0) * 100, 0, 999))}%`
  const savingsDesc = `${t('hs_savings_rate_sub')} · ${pct(d.savingsRate)}`
  const debtDesc = `${t('hs_debt_ratio_sub')} · ${pct(d.debtRatio)}`
  const emergencyDesc = `${t('hs_emergency_sub')} · ${(Math.round((d.months || 0) * 10) / 10).toFixed(1)} ${t('hs_months')}`
  const budgetDesc = `${t('hs_budget_sub')} · ${pct(d.expenseRatio)}`

  // Suggestions: surface the weakest areas first.
  const tips = useMemo(() => {
    const arr = [
      { k: 'savingsScore', tip: t('hs_tip_save') },
      { k: 'debtScore', tip: t('hs_tip_debt') },
      { k: 'emergencyScore', tip: t('hs_tip_emergency') },
      { k: 'budgetScore', tip: t('hs_tip_budget') },
    ].sort((a, z) => (d[a.k] || 0) - (d[z.k] || 0))
    const weak = arr.filter((x) => (d[x.k] || 0) < 75).slice(0, 3)
    return (weak.length ? weak : arr.slice(0, 2)).map((x) => x.tip)
  }, [d, t])

  return (
    <Sheet open={open} onClose={onClose} full title={t('hs_title')}
      right={<button type="button" onClick={() => setHelp((v) => !v)} className="py-1 px-1 text-muted-foreground" aria-label="info" data-testid="hs-info"><Info size={19} strokeWidth={1.75} /></button>}>

      {help ? (
        <div className="mt-1 rounded-2xl bg-zinc-100 border border-zinc-200/60 dark:bg-[#141416] dark:border-white/5 p-4 relative">
          <button type="button" onClick={() => setHelp(false)} className="absolute right-3 top-3 text-muted-foreground"><X size={16} /></button>
          <p className="font-semibold text-[15px] flex items-center gap-2"><HeartPulse size={16} strokeWidth={1.75} /> {t('hs_help_title')}</p>
          <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{t('hs_help_body')}</p>
        </div>
      ) : null}

      <div className="mt-2 flex flex-col items-center">
        <Gauge score={d.total} />
        <span className={cn('mt-3 rounded-full px-4 py-1.5 text-sm font-semibold', b.cls)} data-testid="hs-status">{b.label}</span>
        {!d.hasData ? <p className="text-xs text-muted-foreground mt-2 text-center px-6">{t('hs_empty')}</p> : null}
      </div>

      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mt-7 mb-2 px-1">{t('hs_breakdown')}</p>
      <div className="space-y-2.5">
        <MetricCard icon={PiggyBank} title={t('hs_savings_rate')} desc={savingsDesc} score={d.savingsScore} t={t} />
        <MetricCard icon={Scale} title={t('hs_debt_ratio')} desc={debtDesc} score={d.debtScore} t={t} />
        <MetricCard icon={Shield} title={t('hs_emergency_fund')} desc={emergencyDesc} score={d.emergencyScore} t={t} />
        <MetricCard icon={Target} title={t('hs_budget_discipline')} desc={budgetDesc} score={d.budgetScore} t={t} />
      </div>

      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mt-7 mb-2 px-1">{t('hs_tips_title')}</p>
      <div className="rounded-2xl bg-foreground text-background p-4 space-y-3">
        {(tips || []).map((tip, i) => (
          <div key={i} className="flex items-start gap-3">
            <span className="h-6 w-6 rounded-full bg-background/15 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">{i + 1}</span>
            <p className="text-sm leading-relaxed opacity-90">{tip}</p>
          </div>
        ))}
      </div>
      <div className="h-6" />
    </Sheet>
  )
}

'use client'
import { useMemo, useState, useEffect } from 'react'
import { Share2, ChevronLeft, ChevronRight, PieChart as PieIcon, Download } from 'lucide-react'
import { toast } from 'sonner'
import { useApp } from './context'
import { Sheet, CategoryBadge } from './ui'
import { safeConvert } from '@/lib/rates'
import { signedAccountBalance } from '@/lib/ledger'
import { cn } from '@/lib/utils'

export default function AnalyticsSheet({ open, onClose }) {
  const { t, home, fmt, transactions = [], accounts = [], rates, store } = useApp()

  const [period, setPeriod] = useState('Month') // 'Week' | 'Month' | 'Quarter' | 'Year'
  const [cursorDate, setCursorDate] = useState(() => new Date())
  const [selectedAcc, setSelectedAcc] = useState('all')
  const [subscriptions, setSubscriptions] = useState([])
  const [debts, setDebts] = useState([])
  const toHome = (amount, currency) => safeConvert(amount, currency || home, home, rates) ?? 0

  useEffect(() => {
    if (open) {
      if (store?.listSubscriptions) store.listSubscriptions().then((res) => setSubscriptions(res || [])).catch(() => {})
      if (store?.listDebts) store.listDebts().then((res) => setDebts(res || [])).catch(() => {})
    }
  }, [open, store])

  const fixedMonthlyCosts = useMemo(() => {
    const subTotal = (subscriptions || []).reduce((sum, s) => {
      const rawAmt = Number(s?.amount) || 0
      let m = rawAmt
      if (s.cycle === 'weekly') m = rawAmt * (52 / 12)
      else if (s.cycle === '3_months') m = rawAmt / 3
      else if (s.cycle === '6_months') m = rawAmt / 6
      else if (s.cycle === 'yearly') m = rawAmt / 12
      return sum + toHome(m, s?.currency)
    }, 0)

    const debtTotal = (debts || []).reduce((sum, d) => {
      const amt = Number(d?.installment_amount || d?.monthly_payment || d?.amount) || 0
      return sum + toHome(amt, d?.currency)
    }, 0)

    return { subTotal, debtTotal, total: subTotal + debtTotal }
  }, [subscriptions, debts, home, rates])

  // Date range based on selected period and cursorDate
  const range = useMemo(() => {
    const y = cursorDate.getFullYear()
    const m = cursorDate.getMonth()
    const d = cursorDate.getDate()

    if (period === 'Week') {
      const day = cursorDate.getDay()
      const diff = d - day + (day === 0 ? -6 : 1) // Monday start
      const start = new Date(y, m, diff, 0, 0, 0, 0)
      const end = new Date(start)
      end.setDate(start.getDate() + 6)
      end.setHours(23, 59, 59, 999)
      return { start, end }
    }

    if (period === 'Quarter') {
      const q = Math.floor(m / 3)
      const start = new Date(y, q * 3, 1, 0, 0, 0, 0)
      const end = new Date(y, (q + 1) * 3, 0, 23, 59, 59, 999)
      return { start, end }
    }

    if (period === 'Year') {
      const start = new Date(y, 0, 1, 0, 0, 0, 0)
      const end = new Date(y, 11, 31, 23, 59, 59, 999)
      return { start, end }
    }

    // Default: Month
    const start = new Date(y, m, 1, 0, 0, 0, 0)
    const end = new Date(y, m + 1, 0, 23, 59, 59, 999)
    return { start, end }
  }, [cursorDate, period])

  // Formatted period title for the < September 2026 > navigation bar
  const periodLabel = useMemo(() => {
    if (period === 'Week') {
      const s = range.start.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
      const e = range.end.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
      return `${s} – ${e}`
    }
    if (period === 'Quarter') {
      const q = Math.floor(cursorDate.getMonth() / 3) + 1
      return `Q${q} ${cursorDate.getFullYear()}`
    }
    if (period === 'Year') {
      return `${cursorDate.getFullYear()}`
    }
    return cursorDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  }, [cursorDate, period, range])

  const handlePrev = () => {
    const next = new Date(cursorDate)
    if (period === 'Week') next.setDate(next.getDate() - 7)
    else if (period === 'Quarter') next.setMonth(next.getMonth() - 3)
    else if (period === 'Year') next.setFullYear(next.getFullYear() - 1)
    else next.setMonth(next.getMonth() - 1)
    setCursorDate(next)
  }

  const handleNext = () => {
    const next = new Date(cursorDate)
    if (period === 'Week') next.setDate(next.getDate() + 7)
    else if (period === 'Quarter') next.setMonth(next.getMonth() + 3)
    else if (period === 'Year') next.setFullYear(next.getFullYear() + 1)
    else next.setMonth(next.getMonth() + 1)
    setCursorDate(next)
  }

  // All-time cash position
  const allTimeCash = useMemo(() => {
    if ((accounts || []).length > 0) {
      if (selectedAcc === 'all') {
        return (accounts || []).reduce((acc, a) => acc + toHome(signedAccountBalance(a), a?.currency), 0)
      }
      const target = (accounts || []).find((a) => a?.id === selectedAcc)
      return toHome(signedAccountBalance(target), target?.currency)
    }
    return (transactions || []).reduce((sum, tx) => {
      const amt = toHome(tx?.amount ?? 0, tx?.currency)
      return tx?.type === 'income' ? sum + amt : tx?.type === 'expense' ? sum - amt : sum
    }, 0)
  }, [accounts, selectedAcc, home, rates, transactions])

  // Transactions filtered by period and account
  const filteredTxs = useMemo(() => {
    return (transactions || []).filter((tx) => {
      if (selectedAcc !== 'all' && tx?.account_id !== selectedAcc) return false
      const d = new Date(tx?.date || tx?.created_at || 0)
      if (isNaN(d.getTime())) return false
      return d >= range.start && d <= range.end
    })
  }, [transactions, selectedAcc, range])

  // Financial calculations
  const periodIncome = useMemo(() => {
    return filteredTxs
      .filter((tx) => tx?.type === 'income')
      .reduce((sum, tx) => sum + toHome(tx?.amount ?? 0, tx?.currency), 0)
  }, [filteredTxs, home, rates])

  const periodExpense = useMemo(() => {
    return filteredTxs
      .filter((tx) => tx?.type === 'expense')
      .reduce((sum, tx) => sum + toHome(tx?.amount ?? 0, tx?.currency), 0)
  }, [filteredTxs, home, rates])

  const net = periodIncome - periodExpense
  const entryCount = filteredTxs.length

  const openingBal = allTimeCash - periodIncome + periodExpense

  const avgPerDay = useMemo(() => {
    const now = new Date()
    let days = Math.max(1, Math.round((range.end - range.start) / (1000 * 60 * 60 * 24)))
    if (now >= range.start && now <= range.end) {
      days = Math.max(1, Math.round((now - range.start) / (1000 * 60 * 60 * 24)) + 1)
    }
    return periodExpense > 0 ? periodExpense / days : 0
  }, [periodExpense, range])

  const topDayLabel = useMemo(() => {
    const expenseByDay = {}
    filteredTxs.forEach((tx) => {
      if (tx?.type === 'expense') {
        const dayKey = (tx?.date || '').slice(0, 10)
        if (dayKey) {
          expenseByDay[dayKey] = (expenseByDay[dayKey] || 0) + toHome(tx?.amount ?? 0, tx?.currency)
        }
      }
    })
    const sorted = Object.entries(expenseByDay).sort((a, b) => b[1] - a[1])
    if (!sorted.length || sorted[0][1] === 0) return '-'
    const d = new Date(sorted[0][0])
    return isNaN(d.getTime()) ? '-' : d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })
  }, [filteredTxs, home, rates])

  // Trend line chart points calculation with Finsight Sky Blue accent
  const trendData = useMemo(() => {
    const buckets = []
    const start = new Date(range.start)
    const end = new Date(range.end)
    const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))
    const stepDays = totalDays > 31 ? 30 : totalDays > 14 ? 3 : 1

    for (let t = new Date(start); t <= end; t.setDate(t.getDate() + stepDays)) {
      const bStart = new Date(t)
      bStart.setHours(0, 0, 0, 0)
      const bEnd = new Date(t)
      bEnd.setDate(bEnd.getDate() + stepDays)
      bEnd.setHours(23, 59, 59, 999)

      const bucketSum = filteredTxs.reduce((sum, tx) => {
        if (tx?.type !== 'expense') return sum
        const d = new Date(tx.date || tx.transaction_date)
        if (d >= bStart && d <= bEnd) {
          return sum + toHome(tx.amount || 0, tx.currency)
        }
        return sum
      }, 0)

      buckets.push({
        label: bStart.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
        value: bucketSum,
      })
    }

    if (buckets.length < 2) {
      buckets.push({ label: t('period_now') || 'Now', value: periodExpense })
    }

    const maxVal = Math.max(1, ...buckets.map((b) => b.value))
    const width = 320
    const height = 90
    const paddingX = 14
    const paddingY = 14
    const usableW = width - paddingX * 2
    const usableH = height - paddingY * 2

    const points = buckets.map((b, i) => {
      const x = paddingX + (i / Math.max(1, buckets.length - 1)) * usableW
      const y = height - paddingY - (b.value / maxVal) * usableH
      return { x, y, value: b.value, label: b.label }
    })

    let path = `M ${points[0].x} ${points[0].y}`
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i]
      const p1 = points[i + 1]
      const cp1x = p0.x + (p1.x - p0.x) / 2
      const cp1y = p0.y
      const cp2x = p0.x + (p1.x - p0.x) / 2
      const cp2y = p1.y
      path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p1.x} ${p1.y}`
    }

    const areaPath = `${path} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`

    let peak = points[0]
    points.forEach((p) => {
      if (p.value > peak.value) peak = p
    })

    return { points, path, areaPath, peak, width, height }
  }, [filteredTxs, range, home, rates, periodExpense])

  const catRows = useMemo(() => {
    const byCat = {}
    filteredTxs.forEach((tx) => {
      if (tx?.type === 'expense' && tx?.category) {
        byCat[tx.category] = (byCat[tx.category] || 0) + toHome(tx?.amount ?? 0, tx?.currency)
      }
    })
    return Object.entries(byCat).sort((a, b) => b[1] - a[1])
  }, [filteredTxs, home, rates])

  const handleShare = async () => {
    const text = `Arshif Report (${periodLabel})\nCash: ${fmt(allTimeCash, home)}\nIncome: +${fmt(periodIncome, home)}\nExpense: -${fmt(periodExpense, home)}\nNet: ${fmt(net, home)}`
    try {
      if (typeof navigator !== 'undefined' && navigator?.share) {
        await navigator.share({
          title: `Arshif Report - ${periodLabel}`,
          text
        })
      } else if (typeof navigator !== 'undefined' && navigator?.clipboard) {
        await navigator.clipboard.writeText(text)
        toast.success('Ringkasan laporan disalin ke clipboard!')
      } else {
        toast.info('Laporan siap diekspor')
      }
    } catch (err) {
      if (err?.name !== 'AbortError') {
        toast.info('Ringkasan laporan siap')
      }
    }
  }

  const handleExportCsv = () => {
    if (!filteredTxs || filteredTxs.length === 0) {
      toast.info('Tidak ada transaksi pada periode ini untuk diekspor')
      return
    }
    const headers = ['Date', 'Type', 'Category', 'Amount', 'Currency', 'Note/Merchant']
    const rows = filteredTxs.map((tx) => [
      tx.date || tx.transaction_date || '',
      tx.type || 'expense',
      tx.category || '',
      tx.amount || 0,
      tx.currency || home,
      `"${(tx.merchant || tx.note || '').replace(/"/g, '""')}"`
    ])
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `arshif_report_${period.toLowerCase()}_${periodLabel.replace(/\s+/g, '_')}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('Laporan CSV berhasil diunduh')
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      full
      title=""
      left={
        <button
          type="button"
          onClick={onClose}
          className="text-sm font-semibold text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white transition-colors"
        >
          {t('cancel') || 'Batal'}
        </button>
      }
    >
      <div className="pt-1 pb-10">
        {/* Header Halaman */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">{t('analytics_reports')}</h1>
            <p className="text-xs text-muted-foreground mt-0.5">{t('analytics_reports_sub')}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="rounded-full bg-muted/60 border border-border/50 px-3 py-1 text-xs font-semibold text-foreground">
              Personal
            </span>
            <button
              type="button"
              onClick={handleExportCsv}
              className="h-8 w-8 rounded-full bg-muted/60 border border-border/50 flex items-center justify-center text-foreground hover:bg-muted active:scale-95 transition-all cursor-pointer"
              title="Ekspor CSV"
              aria-label="Ekspor CSV"
            >
              <Download size={14} />
            </button>
            <button
              type="button"
              onClick={handleShare}
              className="h-8 w-8 rounded-full bg-muted/60 border border-border/50 flex items-center justify-center text-foreground hover:bg-muted active:scale-95 transition-all cursor-pointer"
              aria-label="Bagikan laporan"
            >
              <Share2 size={14} />
            </button>
          </div>
        </div>

        {/* Filter Periode Waktu (Pill Bar Atas) */}
        <div className="flex bg-muted/40 border border-border/40 rounded-2xl p-1 gap-1 mb-4">
          {[
            { id: 'Week', label: t('period_week') || 'Week' },
            { id: 'Month', label: t('period_month') || 'Month' },
            { id: 'Quarter', label: t('period_quarter') || 'Quarter' },
            { id: 'Year', label: t('period_year') || 'Year' },
          ].map((p) => {
            const active = period === p.id
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeriod(p.id)}
                className={cn(
                  'flex-1 py-2 text-xs transition-all rounded-xl text-center cursor-pointer',
                  active
                    ? 'bg-foreground text-background font-bold shadow-sm'
                    : 'text-muted-foreground hover:text-foreground font-semibold'
                )}
              >
                {p.label}
              </button>
            )
          })}
        </div>

        {/* Selector Bulan & Periode (< September 2026 >) */}
        <div className="flex items-center justify-between px-2 mb-3">
          <button
            type="button"
            onClick={handlePrev}
            className="h-9 w-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors cursor-pointer"
            aria-label="Periode sebelumnya"
          >
            <ChevronLeft size={20} />
          </button>
          <p className="font-bold text-[15px] text-foreground tracking-tight select-none">
            {periodLabel}
          </p>
          <button
            type="button"
            onClick={handleNext}
            className="h-9 w-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors cursor-pointer"
            aria-label="Periode berikutnya"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Filter Akun (Pills horizontal) */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-3 mb-4">
          <button
            type="button"
            onClick={() => setSelectedAcc('all')}
            className={cn(
              'shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer',
              selectedAcc === 'all'
                ? 'bg-foreground text-background font-bold shadow-sm'
                : 'bg-muted/40 border border-border/40 text-muted-foreground hover:text-foreground'
            )}
          >
            All accounts
          </button>
          {(accounts || []).map((acc) => (
            <button
              key={acc?.id}
              type="button"
              onClick={() => setSelectedAcc(acc?.id)}
              className={cn(
                'shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer',
                selectedAcc === acc?.id
                  ? 'bg-foreground text-background font-bold shadow-sm'
                  : 'bg-muted/40 border border-border/40 text-muted-foreground hover:text-foreground'
              )}
            >
              {acc?.name || 'Account'}
            </button>
          ))}
        </div>

        {/* Kartu Finansial Utama (ALL-TIME CASH POSITION) */}
        <div className="rounded-3xl bg-muted/30 border border-border/40 p-5 space-y-1 mb-4">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            ALL-TIME CASH POSITION
          </p>
          <p className="text-3xl font-extrabold tracking-tight text-foreground tabular-nums">
            {fmt(allTimeCash, home)}
          </p>
          <p className="text-xs text-muted-foreground font-medium pt-0.5 tabular-nums">
            Opening {fmt(openingBal, home)} + In {fmt(periodIncome, home)} - Out {fmt(periodExpense, home)}
          </p>
        </div>

        {/* Grid Metrik Finansial (2 Baris x 3 Kolom) */}
        <div className="grid grid-cols-3 gap-2.5 mb-5">
          {/* Baris 1: Income, Expense, Net */}
          <div className="rounded-2xl bg-muted/20 border border-border/40 p-3 flex flex-col justify-between min-h-[64px]">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider truncate">Income</p>
            <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums truncate">
              +{fmt(periodIncome, home)}
            </p>
          </div>
          <div className="rounded-2xl bg-muted/20 border border-border/40 p-3 flex flex-col justify-between min-h-[64px]">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider truncate">Expense</p>
            <p className="text-sm font-bold text-rose-600 dark:text-rose-400 tabular-nums truncate">
              -{fmt(periodExpense, home)}
            </p>
          </div>
          <div className="rounded-2xl bg-muted/20 border border-border/40 p-3 flex flex-col justify-between min-h-[64px]">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider truncate">Net</p>
            <p className={cn('text-sm font-bold tabular-nums truncate', net >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
              {net >= 0 ? '+' : ''}{fmt(net, home)}
            </p>
          </div>

          {/* Baris 2: Entries, Avg / day, Top day */}
          <div className="rounded-2xl bg-muted/20 border border-border/40 p-3 flex flex-col justify-between min-h-[64px]">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider truncate">Entries</p>
            <p className="text-sm font-bold text-foreground tabular-nums truncate">{entryCount}</p>
          </div>
          <div className="rounded-2xl bg-muted/20 border border-border/40 p-3 flex flex-col justify-between min-h-[64px]">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider truncate">Avg / day</p>
            <p className="text-sm font-bold text-foreground tabular-nums truncate">{fmt(avgPerDay, home)}</p>
          </div>
          <div className="rounded-2xl bg-muted/20 border border-border/40 p-3 flex flex-col justify-between min-h-[64px]">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider truncate">{t('analytics_top_day')}</p>
            <p className="text-sm font-bold text-foreground tabular-nums truncate">{topDayLabel}</p>
          </div>
        </div>

        {/* Section SPENDING PACE & FIXED COMMITMENTS */}
        <div className="mb-5">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 px-1">
            SPENDING PACE &amp; FIXED COMMITMENTS
          </p>
          <div className="rounded-3xl bg-muted/30 border border-border/40 p-5 space-y-3">
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                SPENT SO FAR
              </p>
              <p className="text-2xl font-extrabold text-foreground tabular-nums mt-0.5">
                {fmt(periodExpense, home)}
              </p>
              <div className="pt-2 flex items-center justify-between text-xs text-muted-foreground font-medium">
                <span>Rata-rata: {fmt(avgPerDay, home)} / hari</span>
                <span>{entryCount} transaksi</span>
              </div>
            </div>

            {/* Finsight Sky Blue Trend Micro-Accent */}
            <div className="pt-2">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                <span>{t('spending_trajectory')}</span>
                {trendData?.peak?.value > 0 && (
                  <span className="text-[#6A92FC] tabular-nums lowercase font-semibold">
                    peak ~ {fmt(trendData.peak.value, home)}
                  </span>
                )}
              </div>
              <div className="w-full relative overflow-hidden rounded-xl bg-background/50 border border-border/30 p-2">
                <svg viewBox={`0 0 ${trendData.width} ${trendData.height}`} className="w-full h-20 overflow-visible">
                  <defs>
                    <linearGradient id="skyBlueTrendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6A92FC" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#6A92FC" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d={trendData.areaPath} fill="url(#skyBlueTrendGrad)" />
                  <path d={trendData.path} fill="none" stroke="#6A92FC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  {trendData?.peak?.value > 0 && (
                    <g>
                      <circle cx={trendData.peak.x} cy={trendData.peak.y} r="5" fill="#6A92FC" fillOpacity="0.25" />
                      <circle cx={trendData.peak.x} cy={trendData.peak.y} r="3" fill="#6A92FC" stroke="#ffffff" strokeWidth="1.5" />
                    </g>
                  )}
                </svg>
                <div className="flex justify-between items-center text-[9.5px] font-medium text-muted-foreground px-1 pt-1">
                  <span>{trendData.points[0]?.label || ''}</span>
                  <span>{trendData.points[trendData.points.length - 1]?.label || ''}</span>
                </div>
              </div>
            </div>

            {/* Fixed Obligations from Goals (Subscriptions & Loans/BNPL) */}
            {fixedMonthlyCosts.total > 0 && (
              <div className="pt-3 border-t border-border/30 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">{t('analytics_fixed_monthly')}</span>
                  <span className="text-xs font-bold tabular-nums text-foreground">
                    ~{fmt(fixedMonthlyCosts.total, home)}/mo
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Subscriptions: {fmt(fixedMonthlyCosts.subTotal, home)}/mo</span>
                  <span>Loans &amp; BNPL: {fmt(fixedMonthlyCosts.debtTotal, home)}/mo</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* TOP CATEGORIES breakdown */}
        {catRows.length > 0 ? (
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 px-1">
              TOP CATEGORIES
            </p>
            <div className="space-y-4 rounded-3xl bg-muted/20 border border-border/40 p-4">
              {catRows.map(([cat, val]) => {
                const pct = Math.round((val / Math.max(1, periodExpense)) * 100)
                return (
                  <div key={cat} className="flex items-center gap-3.5">
                    {/* 1. Ikon Badge Kategori Squircle Presisi di Sumbu Vertikal */}
                    <div className="shrink-0 flex items-center justify-center">
                      <CategoryBadge id={cat} size="sm" />
                    </div>

                    {/* 2. Kolom Informasi: Baris 1 (Teks & Angka), Baris 2 (Progress Bar) */}
                    <div className="flex-1 min-w-0 flex flex-col justify-center gap-1.5">
                      {/* Baris Atas: Nama Kategori (kiri) + Nominal & % (kanan) */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-sm text-foreground truncate">
                          {t(`cat_${cat}`) || cat}
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-sm font-bold tabular-nums text-foreground">
                            {fmt(val, home)}
                          </span>
                          <span className="text-xs font-semibold tabular-nums text-muted-foreground w-9 text-right">
                            {pct}%
                          </span>
                        </div>
                      </div>

                      {/* Baris Bawah: Bar Progres Ramping Menyatu di Bawah Teks */}
                      <div className="h-1.5 w-full rounded-full bg-muted/60 overflow-hidden">
                        <div
                          className="h-full bg-foreground rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : null}
      </div>
    </Sheet>
  )
}

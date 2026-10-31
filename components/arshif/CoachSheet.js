'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Copy, Send, Sparkles, SquarePen, Wallet, TrendingUp, Target, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { useApp } from './context'
import { Sheet, DotsLoader } from './ui'
import CoachMarkdown from './CoachMarkdown'
import { safeConvert } from '@/lib/rates'
import { signedAccountBalance } from '@/lib/ledger'
import { cn } from '@/lib/utils'

const GREETINGS = {
  id: 'Halo! Saya AI Financial Coach Arshif kamu. Tanya apa saja soal keuanganmu - aku sudah membaca saldo, anggaran, dan targetmu.',
  ms: 'Hai! Saya AI Financial Coach Arshif anda. Tanya apa sahaja tentang kewangan anda - saya sudah baca baki, belanjawan dan matlamat anda.',
  en: "Hi! I'm your Arshif AI Financial Coach. Ask me anything about your money - I've already read your balance, budgets and goals.",
  tr: 'Merhaba! Ben Arshif AI Finans Koçunuz. Paranızla ilgili her şeyi sorun - bakiyenizi, bütçelerinizi ve hedeflerinizi okudum.',
}

export default function CoachSheet({ open, onClose }) {
  const { t, home, lang, transactions = [], accounts = [], goals = [], budgets = [], rates, fmt, session, isAiAllowed, open: openSheet, store } = useApp()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [debts, setDebts] = useState([])
  const [subscriptions, setSubscriptions] = useState([])
  const scrollRef = useRef(null)

  // Riwayat chat tersimpan per-user di localStorage (maks 40 pesan terakhir)
  const uid = session?.user?.id || 'guest'
  const chatKey = `arshif:coach-chat:${uid}`
  const MAX_SAVED = 40

  const loadHistory = () => {
    try {
      const raw = localStorage.getItem(chatKey)
      if (!raw) return null
      const arr = JSON.parse(raw)
      if (!Array.isArray(arr) || !arr.length) return null
      const clean = arr.filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      return clean.length ? clean.slice(-MAX_SAVED) : null
    } catch { return null }
  }

  const startNewChat = () => {
    const g = [{ role: 'assistant', content: GREETINGS[lang] || GREETINGS.en }]
    setMessages(g)
    try { localStorage.setItem(chatKey, JSON.stringify(g)) } catch {}
  }

  // Muat hutang & langganan saat sheet dibuka (buat konteks coach)
  useEffect(() => {
    if (!open || !store) return
    let alive = true
    const load = async (fn, setter) => {
      try {
        if (typeof fn === 'function') {
          const rows = await fn()
          if (alive) setter(Array.isArray(rows) ? rows : [])
        }
      } catch {
        if (alive) setter([])
      }
    }
    load(store.listDebts, setDebts)
    load(store.listSubscriptions, setSubscriptions)
    return () => { alive = false }
  }, [open, store])

  const context = useMemo(() => {
    const now = new Date()
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const txMonth = (tx) => (tx?.date || tx?.transaction_date || tx?.created_at || '').slice(0, 7)
    const inMonth = transactions.filter((tx) => txMonth(tx) === monthKey)
    const sum = (type) => inMonth.filter((tx) => tx.type === type).reduce((s, tx) => s + (safeConvert(tx.amount, tx.currency, home, rates) ?? 0), 0)
    const byCat = {}
    inMonth.filter((tx) => tx.type === 'expense').forEach((tx) => { byCat[tx.category] = (byCat[tx.category] || 0) + (safeConvert(tx.amount, tx.currency, home, rates) ?? 0) })
    const totalBalance = accounts.reduce((s, a) => s + (safeConvert(signedAccountBalance(a), a.currency, home, rates) ?? 0), 0)
    const monthIncome = sum('income')
    const monthSpending = sum('expense')

    const trend = []
    for (let i = 2; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const monthTx = transactions.filter((tx) => txMonth(tx) === key)
      trend.push({
        month: key,
        income: Math.round(monthTx.filter((tx) => tx.type === 'income').reduce((s, tx) => s + (safeConvert(tx.amount, tx.currency, home, rates) ?? 0), 0)),
        spending: Math.round(monthTx.filter((tx) => tx.type === 'expense').reduce((s, tx) => s + (safeConvert(tx.amount, tx.currency, home, rates) ?? 0), 0)),
      })
    }

    const budgetProgress = (budgets || [])
      .map((b) => {
        const limitHome = safeConvert(Number(b?.limit_amount) || 0, b?.currency || home, home, rates) ?? (Number(b?.limit_amount) || 0)
        if (limitHome <= 0) return null
        const dStart = b?.from_date ? new Date(b.from_date) : null
        const dEnd = b?.to_date ? new Date(b.to_date + 'T23:59:59.999') : null
        const spent = (transactions || [])
          .filter((tx) => {
            if (tx?.type !== 'expense' || tx?.category !== b?.category) return false
            if (dStart && dEnd) {
              const txDate = new Date(tx?.date || tx?.transaction_date || tx?.created_at || 0)
              if (isNaN(txDate.getTime())) return false
              return txDate >= dStart && txDate <= dEnd
            }
            return txMonth(tx) === monthKey
          })
          .reduce((s, tx) => s + (safeConvert(tx?.amount || 0, tx?.currency || home, home, rates) ?? 0), 0)
        return {
          category: b.category,
          limit: Math.round(limitHome),
          spent: Math.round(spent),
          pct: Math.round((spent / limitHome) * 100),
        }
      })
      .filter(Boolean)
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 6)

    const debtMonthly = (debts || []).reduce((s, d) => s + (safeConvert(Number(d?.installment_amount || d?.monthly_payment || d?.amount) || 0, d?.currency || home, home, rates) ?? 0), 0)
    const subMonthly = (subscriptions || []).reduce((s, sub) => {
      const rawAmt = Number(sub?.amount) || 0
      let monthlyAmt = rawAmt
      if (sub.cycle === 'weekly') monthlyAmt = rawAmt * (52 / 12)
      else if (sub.cycle === '3_months') monthlyAmt = rawAmt / 3
      else if (sub.cycle === '6_months') monthlyAmt = rawAmt / 6
      else if (sub.cycle === 'yearly') monthlyAmt = rawAmt / 12
      return s + (safeConvert(monthlyAmt, sub?.currency || home, home, rates) ?? 0)
    }, 0)

    const goalProjection = (goals || []).map((g) => {
      const targetHome = safeConvert(Number(g?.target_amount) || 0, g?.currency || home, home, rates) ?? (Number(g?.target_amount) || 0)
      const savedHome = safeConvert(Number(g?.saved_amount) || 0, g?.currency || home, home, rates) ?? (Number(g?.saved_amount) || 0)
      const remaining = Math.max(0, targetHome - savedHome)
      let monthsLeft = null
      let requiredMonthly = null
      let status = 'no_deadline'
      if (g?.deadline) {
        const dl = new Date(g.deadline)
        monthsLeft = Math.max(0, (dl.getFullYear() - now.getFullYear()) * 12 + (dl.getMonth() - now.getMonth()))
        if (monthsLeft > 0 && remaining > 0) requiredMonthly = Math.round(remaining / monthsLeft)
        const monthlyTarget = safeConvert(Number(g?.monthly_target) || 0, g?.currency || home, home, rates) ?? (Number(g?.monthly_target) || 0)
        if (remaining <= 0) status = 'completed'
        else if (monthsLeft <= 0) status = 'overdue'
        else if (monthlyTarget > 0 && monthlyTarget >= requiredMonthly) status = 'on_track'
        else status = 'behind'
      } else if (remaining <= 0) {
        status = 'completed'
      }
      return {
        name: g?.name,
        saved: Math.round(savedHome),
        target: Math.round(targetHome),
        deadline: g?.deadline || null,
        monthsLeft,
        requiredMonthly,
        status,
      }
    })

    return {
      homeCurrency: home,
      totalBalance: Math.round(totalBalance),
      monthIncome: Math.round(monthIncome),
      monthSpending: Math.round(monthSpending),
      savingsRate: monthIncome > 0 ? Math.round(((monthIncome - monthSpending) / monthIncome) * 100) : null,
      topCategories: Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([c, v]) => ({ category: c, amount: Math.round(v) })),
      accounts: accounts.map((a) => ({ name: a.name, balance: Math.round(safeConvert(signedAccountBalance(a), a.currency, home, rates) ?? 0) })),
      trend,
      budgets: budgetProgress,
      debts: { count: (debts || []).length, monthlyTotal: Math.round(debtMonthly) },
      subscriptions: { count: (subscriptions || []).length, monthlyTotal: Math.round(subMonthly) },
      goals: goalProjection,
    }
  }, [transactions, accounts, goals, budgets, debts, subscriptions, home, rates])

  // Saran pertanyaan: kontekstual dari data user - pakai key i18n + var
  const starters = useMemo(() => {
    const list = []
    const hot = context.budgets.find((b) => b.pct >= 80)
    if (hot) list.push({ key: 'coach_q_budget', vars: { category: hot.category, pct: hot.pct } })
    const behind = context.goals.find((g) => g.status === 'behind' || g.status === 'overdue')
    if (behind) list.push({ key: 'coach_q_goal', vars: { name: behind.name } })
    if (context.savingsRate !== null && context.savingsRate < 20) list.push({ key: 'coach_q_savings', vars: {} })
    list.push({ key: 'coach_q_analyze', vars: {} })
    list.push({ key: 'coach_q_save', vars: {} })
    return list.slice(0, 4)
  }, [context])

  useEffect(() => {
    if (open) {
      if (!isAiAllowed) {
        onClose?.()
        openSheet?.('aiPremium')
        return
      }
      setMessages(loadHistory() || [{ role: 'assistant', content: GREETINGS[lang] || GREETINGS.en }])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isAiAllowed])

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }) }, [messages, busy])

  useEffect(() => {
    if (!open || !messages.length) return
    try { localStorage.setItem(chatKey, JSON.stringify(messages.slice(-MAX_SAVED))) } catch {}
  }, [messages, open, chatKey])

  const send = async (text) => {
    if (!isAiAllowed) {
      onClose?.()
      openSheet?.('aiPremium')
      return
    }
    const content = (typeof text === 'string' ? text : t(text.key, text.vars)).trim()
    if (!content || busy) return
    const next = [...messages, { role: 'user', content }]
    setMessages(next)
    setInput('')
    setBusy(true)
    try {
      const headers = { 'Content-Type': 'application/json' }
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }
      const res = await fetch('/api/ai/coach', {
        method: 'POST',
        headers,
        body: JSON.stringify({ messages: next, language: lang, context }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 403 || data?.code === 'AI_PREMIUM_REQUIRED') {
          onClose?.()
          openSheet?.('aiPremium')
          return
        }
        if (res.status === 429 || data?.code === 'AI_QUOTA_EXCEEDED') {
          const msg = t('coach_quota_exhausted')
          toast.error(msg)
          setMessages((m) => [...m, { role: 'assistant', content: `⚠️ ${msg}` }])
          return
        }
        throw new Error(data?.error || t('coach_error'))
      }

      setMessages((m) => [...m, { role: 'assistant', content: data.reply || t('coach_error') }])
    } catch (e) {
      setMessages((m) => [...m, { role: 'assistant', content: `⚠️ ${e?.message || t('coach_error')}` }])
    } finally { setBusy(false) }
  }

  const copyLast = async () => {
    const last = [...messages].reverse().find((m) => m.role === 'assistant' && m.content)
    if (!last) return
    try {
      await navigator.clipboard.writeText(last.content)
      toast.success(t('coach_copied'))
    } catch {}
  }

  // Snapshot ringkas bulan ini (chips atas area chat)
  const chips = useMemo(() => [
    { icon: Wallet, label: t('total_balance'), value: fmt(context.totalBalance, home), alert: false },
    { icon: TrendingUp, label: t('spending'), value: fmt(context.monthSpending, home), alert: context.savingsRate !== null && context.savingsRate < 0 },
    { icon: Target, label: t('coach_chip_savings'), value: context.savingsRate === null ? '-' : `${context.savingsRate}%`, alert: context.savingsRate !== null && context.savingsRate < 10 },
  ], [context, fmt, home, t])

  return (
    <Sheet
      open={open}
      onClose={onClose}
      full
      noPadding
      title={
        <span className="flex items-center justify-center gap-2">
          <video src="/coach-avatar-anim.mp4" autoPlay muted loop playsInline className="h-7 w-7 rounded-full object-cover" />
          <span className="text-base font-extrabold tracking-tight">{t('ai_coach')}</span>
          <span className="text-[9px] font-bold tracking-wider text-emerald-500 bg-emerald-500/10 rounded-full px-1.5 py-0.5">{t('coach_new')}</span>
        </span>
      }
      right={
        <div className="flex items-center gap-1">
          <button type="button" onClick={copyLast} title={t('coach_copied')} aria-label={t('coach_copied')} className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground">
            <Copy size={17} />
          </button>
          <button type="button" onClick={startNewChat} title={t('coach_new_chat')} aria-label={t('coach_new_chat')} className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground">
            <SquarePen size={18} />
          </button>
        </div>
      }
    >
      <div className="flex flex-col h-full">
        {/* Ringkasan bulan ini */}
        <div className="px-3 pt-2.5 pb-1.5">
          <p className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase mb-2 px-1">{t('coach_summary')}</p>
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
            {chips.map((c, i) => (
              <div key={i} className={cn('shrink-0 flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs', c.alert ? 'border-amber-500/40 bg-amber-500/10' : 'border-border/40 bg-muted/40')}>
                <c.icon size={13} className={c.alert ? 'text-amber-500' : 'text-muted-foreground'} />
                <span className="text-muted-foreground">{c.label}</span>
                <span className={cn('font-bold tabular-nums', c.alert ? 'text-amber-500' : 'text-foreground')}>{c.value}</span>
              </div>
            ))}
          </div>
          {context.budgets[0]?.pct >= 80 ? (
            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-amber-500 px-1">
              <AlertTriangle size={12} />
              {t('coach_alert_budget', { category: context.budgets[0].category, pct: context.budgets[0].pct })}
            </div>
          ) : null}
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto no-scrollbar px-4 py-3 space-y-3">
          {messages.map((m, i) => m.role === 'user' ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-br-md bg-foreground text-background px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap">{m.content}</div>
            </div>
          ) : (
            <div key={i} className="flex items-start gap-2.5">
              <img src="/coach-avatar.webp" alt="" className="mt-0.5 h-[34px] w-[34px] flex-none rounded-full object-cover ring-1 ring-foreground/10" />
              <div className="max-w-[85%] rounded-2xl rounded-bl-md border border-border/50 bg-card px-4 py-2.5 text-sm leading-relaxed shadow-xs">
                <CoachMarkdown text={m.content} />
              </div>
            </div>
          ))}
          {busy ? (
            <div className="flex items-start gap-2.5">
              <img src="/coach-avatar.webp" alt="" className="mt-0.5 h-[34px] w-[34px] flex-none rounded-full object-cover ring-1 ring-foreground/10" />
              <div className="rounded-2xl rounded-bl-md border border-border/50 bg-card px-4 py-3.5 shadow-xs"><DotsLoader size="sm" /></div>
            </div>
          ) : null}
          {messages.length <= 1 ? (
            <div className="flex flex-wrap gap-2 pt-2">
              {starters.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => send(s)}
                  className="rounded-xl border border-border/60 bg-card px-3 py-2 text-xs font-medium text-foreground flex items-center gap-1.5 shadow-xs active:scale-[0.98] transition-transform"
                >
                  <Sparkles size={12} className="text-emerald-500" />
                  {t(s.key, s.vars)}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div className="border-t border-border/40 p-3 safe-bottom flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder={t('coach_input_ph')}
            className="flex-1 rounded-xl bg-muted px-4 py-3 text-base outline-none text-foreground placeholder:text-muted-foreground/60"
            data-testid="coach-input"
          />
          <button
            type="button"
            onClick={() => send()}
            disabled={busy || !input.trim()}
            className="h-11 w-11 rounded-xl bg-foreground text-background flex items-center justify-center disabled:opacity-40 active:scale-95 transition-transform"
            data-testid="coach-send"
            aria-label={t('coach_input_ph')}
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </Sheet>
  )
}

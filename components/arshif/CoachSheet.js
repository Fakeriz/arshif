'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Send, Sparkles, SquarePen } from 'lucide-react'
import { toast } from 'sonner'
import { useApp } from './context'
import { Sheet, DotsLoader } from './ui'
import CoachMarkdown from './CoachMarkdown'
import { safeConvert } from '@/lib/rates'
import { signedAccountBalance } from '@/lib/ledger'

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

  const greetingFor = (l) => l === 'id'
    ? 'Halo! Saya AI Financial Coach kamu. Tanya apa saja soal keuanganmu.'
    : l === 'ms'
      ? 'Hai! Saya AI Financial Coach anda. Tanya apa sahaja tentang kewangan anda.'
      : l === 'tr'
        ? 'Merhaba! Ben AI Finans Koçunuzum. Finansınız hakkında her şeyi sorun.'
        : "Hi! I'm your AI Financial Coach. Ask me anything about your money."

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
    const g = [{ role: 'assistant', content: greetingFor(lang) }]
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
    // Saldo akun dikonversi ke mata uang home agar konsisten dengan totalBalance
    const totalBalance = accounts.reduce((s, a) => s + (safeConvert(signedAccountBalance(a), a.currency, home, rates) ?? 0), 0)
    const monthIncome = sum('income')
    const monthSpending = sum('expense')

    // Tren 3 bulan terakhir (income vs spending)
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

    // Progres anggaran: limit dikonversi ke home currency agar sebanding dengan spent
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

    // Beban hutang & langganan per bulan (dinormalkan ke 1 bulan, konversi ke home)
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

    // Proyeksi tiap goal: sisa bulan, kebutuhan per bulan, status on_track/behind
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

  // Saran pertanyaan: statis + kontekstual dari data user
  const starters = useMemo(() => {
    const list = []
    const pick = (l) => l
    if (context.budgets.some((b) => b.pct >= 80)) {
      const worst = context.budgets.find((b) => b.pct >= 80)
      list.push(pick(lang === 'id' ? `Kenapa anggaran ${worst.category} aku sudah ${worst.pct}%?` : lang === 'ms' ? `Kenapa belanja ${worst.category} saya sudah ${worst.pct}%?` : lang === 'tr' ? `${worst.category} bütçem neden %${worst.pct} oldu?` : `Why is my ${worst.category} budget already at ${worst.pct}%?`))
    }
    const behind = context.goals.find((g) => g.status === 'behind' || g.status === 'overdue')
    if (behind) {
      list.push(pick(lang === 'id' ? `Bagaimana aku mengejar target "${behind.name}"?` : lang === 'ms' ? `Macam mana nak kejar matlamat "${behind.name}"?` : lang === 'tr' ? `"${behind.name}" hedefimi nasıl yakalarım?` : `How do I catch up on my "${behind.name}" goal?`))
    }
    if (context.savingsRate !== null && context.savingsRate < 20) {
      list.push(pick(lang === 'id' ? 'Rasio tabunganku rendah, apa yang harus dipotong?' : lang === 'ms' ? 'Kadar simpanan saya rendah, apa perlu dipotong?' : lang === 'tr' ? 'Tasarruf oranım düşük, neyi kısmalıyım?' : 'My savings rate is low - what should I cut?'))
    }
    list.push(
      lang === 'id' ? 'Analisa pengeluaranku bulan ini' : lang === 'ms' ? 'Analisa perbelanjaan saya bulan ini' : lang === 'tr' ? 'Bu ayki harcamalarımı analiz et' : 'Analyze my spending this month',
      lang === 'id' ? 'Bagaimana cara menabung lebih banyak?' : lang === 'ms' ? 'Bagaimana nak menabung lebih?' : lang === 'tr' ? 'Nasıl daha fazla biriktirebilirim?' : 'How can I save more?',
    )
    return list.slice(0, 4)
  }, [context, lang])

  useEffect(() => {
    if (open) {
      if (!isAiAllowed) {
        onClose?.()
        openSheet?.('aiPremium')
        return
      }
      setMessages(loadHistory() || [{ role: 'assistant', content: greetingFor(lang) }])
    }
  }, [open, lang, isAiAllowed, onClose, openSheet])

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
    const content = (text ?? input).trim()
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
        body: JSON.stringify({ messages: next.filter((m) => m.role !== 'system'), language: lang, context }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 403 || data?.code === 'AI_PREMIUM_REQUIRED') {
          onClose?.()
          openSheet?.('aiPremium')
          return
        }
        if (res.status === 429 || data?.code === 'AI_QUOTA_EXCEEDED') {
          toast.error(data?.error || 'Kuota AI harian Anda telah habis.')
          setMessages((m) => [...m, { role: 'assistant', content: `⚠️ ${data?.error || 'Kuota AI harian Anda telah habis.'}` }])
          return
        }
        throw new Error(data?.error || t('error'))
      }

      setMessages((m) => [...m, { role: 'assistant', content: data.reply }])
    } catch (e) {
      setMessages((m) => [...m, { role: 'assistant', content: `⚠️ ${e?.message || t('error')}` }])
    } finally { setBusy(false) }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      full
      noPadding
      title={<span className="flex items-center justify-center gap-2"><video src="/coach-avatar-anim.mp4" autoPlay muted loop playsInline className="h-7 w-7 rounded-full object-cover" /> {t('ai_coach')}</span>}
      right={<button type="button" onClick={startNewChat} title={t('coach_new_chat')} aria-label={t('coach_new_chat')} className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"><SquarePen size={18} /></button>}
    >
      <div className="flex flex-col h-full">
        <div className="px-3 py-2 bg-muted/50 text-[11px] text-muted-foreground text-center">
          {fmt(context.totalBalance, home)} · {t('spending')}: {fmt(context.monthSpending, home)}
        </div>
        <div ref={scrollRef} className="flex-1 overflow-y-auto no-scrollbar px-4 py-4 space-y-3">
          {messages.map((m, i) => m.role === 'user' ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[82%] rounded-2xl rounded-br-md bg-foreground text-background px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap">{m.content}</div>
            </div>
          ) : (
            <div key={i} className="flex items-start gap-2.5">
              <img src="/coach-avatar.webp" alt="" className="mt-0.5 h-[34px] w-[34px] flex-none rounded-full object-cover ring-1 ring-foreground/10" />
              <div className="max-w-[80%] rounded-2xl rounded-bl-md border border-border/50 bg-card px-4 py-2.5 text-sm leading-relaxed"><CoachMarkdown text={m.content} /></div>
            </div>
          ))}
          {busy ? (
            <div className="flex items-start gap-2.5">
              <img src="/coach-avatar.webp" alt="" className="mt-0.5 h-[34px] w-[34px] flex-none rounded-full object-cover ring-1 ring-foreground/10" />
              <div className="rounded-2xl rounded-bl-md border border-border/50 bg-card px-4 py-3.5"><DotsLoader size="sm" /></div>
            </div>
          ) : null}
          {messages.length <= 1 ? (
            <div className="flex flex-wrap gap-2 pt-2">
              {starters.map((s) => <button key={s} type="button" onClick={() => send(s)} className="rounded-xl border border-border/60 bg-card px-3 py-2 text-xs font-medium flex items-center gap-1.5"><Sparkles size={12} /> {s}</button>)}
            </div>
          ) : null}
        </div>
        <div className="border-t border-border/40 p-3 safe-bottom flex gap-2">
          <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="..." className="flex-1 rounded-xl bg-muted px-4 py-3 text-base outline-none" data-testid="coach-input" />
          <button type="button" onClick={() => send()} disabled={busy || !input.trim()} className="h-11 w-11 rounded-xl bg-foreground text-background flex items-center justify-center disabled:opacity-40" data-testid="coach-send"><Send size={18} /></button>
        </div>
      </div>
    </Sheet>
  )
}

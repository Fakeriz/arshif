'use client'
import { useEffect, useState, useMemo, useRef } from 'react'
import {
  Flag, Target, Plane, Home as HomeIcon, Car, Gem, GraduationCap, ShieldCheck, TrendingUp,
  Heart, Gift, Sparkles, Plus, Trash2, Repeat, HelpCircle, Camera, Calendar,
  CreditCard, X, ChevronRight, Info, Landmark, Check
} from 'lucide-react'
import { toast } from 'sonner'
import { useApp } from './context'
import { Card, EmptyState, Sheet, SheetTextButton, Field, TextInput, PrimaryButton, CategoryIcon } from './ui'
import SubscriptionSheet from './SubscriptionSheet'
import SetBudgetModal from '@/components/goals/SetBudgetModal'
import NewSavingsGoalModal, { resolveSavingsGoalIcon } from '@/components/goals/NewSavingsGoalModal'
import LoansSection from '@/components/goals/LoansSection'
import { CATEGORIES } from '@/lib/categories'
import { getCurrency } from '@/lib/currencies'
import { safeConvert } from '@/lib/rates'
import { cn } from '@/lib/utils'
import { sanitizeAmount } from '@/lib/amount'

const goalIcon = (id) => resolveSavingsGoalIcon(id) || Flag

const EXPENSE_CATEGORIES = CATEGORIES.filter((c) => c.types?.includes('expense'))

function formatCycle(cycle) {
  if (!cycle) return 'Monthly'
  if (cycle === 'weekly') return 'Weekly'
  if (cycle === 'monthly') return 'Monthly'
  if (cycle === '3_months') return '3 Months'
  if (cycle === '6_months') return '6 Months'
  if (cycle === 'yearly') return 'Yearly'
  return cycle.charAt(0).toUpperCase() + cycle.slice(1)
}

export function isLoanOrDebt(item) {
  if (!item) return false
  const type = String(item?.type || '').toLowerCase()
  if (['loan', 'debt', 'bnpl', 'postpaid', 'installment', 'cicilan', 'pinjaman'].includes(type)) return true
  if (item?.debt_type != null || item?.debt_mode != null || Boolean(item?.is_debt)) return true
  if (item?.tenure != null || item?.tenure_months != null || item?.tenor_months != null || item?.remaining_tenor != null) return true
  if (item?.interest != null || item?.interest_rate != null) return true
  if (item?.installment_amount != null || item?.monthly_installment != null || item?.total_loan_amount != null) return true
  return false
}

export default function GoalsTab() {
  const { t, goals = [], transactions = [], accounts = [], fmt, home, rates, store, refresh, open: openSheet } = useApp()

  // 1. Subscriptions State
  const [subscriptions, setSubscriptions] = useState([])
  const [subSheetOpen, setSubSheetOpen] = useState(false)
  const [selectedSub, setSelectedSub] = useState(null)

  // 2. Budgets State
  const [budgets, setBudgets] = useState([])
  const [budgetModalOpen, setBudgetModalOpen] = useState(false)
  const [editingBudget, setEditingBudget] = useState(null)
  const [showBudgetHelp, setShowBudgetHelp] = useState(false)

  // 3. Savings Goals State
  const [creatingGoal, setCreatingGoal] = useState(false)
  const [funding, setFunding] = useState(null)
  const [fund, setFund] = useState('')

  // 4. Loans & BNPL State
  const [loans, setLoans] = useState([])

  // Load all data
  const loadData = async () => {
    try {
      if (store?.listSubscriptions) {
        const subs = await store.listSubscriptions()
        setSubscriptions(Array.isArray(subs) ? subs : [])
      }
    } catch {
      setSubscriptions([])
    }

    try {
      if (store?.listBudgets) {
        const b = await store.listBudgets()
        setBudgets(Array.isArray(b) ? b : [])
      }
    } catch {
      setBudgets([])
    }

    try {
      // 1. Ambil data goals yang berstatus pinjaman/cicilan/tenure/interest
      const loanGoalsFromApp = (goals || []).filter((g) => isLoanOrDebt(g))

      let debtsFromStore = []
      if (store?.listDebts) {
        const d = await store.listDebts()
        debtsFromStore = Array.isArray(d) ? d : []
      }

      // Gabungkan unik berdasarkan ID agar tidak dobel
      const combined = [...loanGoalsFromApp]
      const existingIds = new Set(loanGoalsFromApp.map((x) => x?.id).filter(Boolean))
      for (const d of debtsFromStore) {
        if (d?.id) {
          if (!existingIds.has(d.id)) {
            combined.push(d)
            existingIds.add(d.id)
          }
        } else {
          combined.push(d)
        }
      }
      setLoans(combined)
    } catch {
      setLoans([])
    }
  }

  useEffect(() => {
    loadData()
  }, [goals]) // <-- Masukkan 'goals' agar otomatis me-refresh saat ada data baru tersimpan

  // 1. Subscriptions Accumulation
  const monthlySubTotal = useMemo(() => {
    if (!subscriptions || subscriptions.length === 0) return 0
    return subscriptions.reduce((sum, s) => {
      const rawAmt = Number(s?.amount) || 0
      let monthlyAmt = rawAmt
      if (s.cycle === 'weekly') monthlyAmt = rawAmt * (52 / 12)
      else if (s.cycle === '3_months') monthlyAmt = rawAmt / 3
      else if (s.cycle === '6_months') monthlyAmt = rawAmt / 6
      else if (s.cycle === 'yearly') monthlyAmt = rawAmt / 12
      const inHome = safeConvert(monthlyAmt, s?.currency || home, home, rates) ?? 0
      return sum + inHome
    }, 0)
  }, [subscriptions, home, rates])

  // 2. Budgets Calculation with current month transactions
  const now = new Date()
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const daysLeft = Math.max(1, daysInMonth - now.getDate() + 1)

  const budgetsWithSpending = useMemo(() => {
    return (budgets || []).map((b) => {
      const catId = b?.category
      const dStart = b?.from_date ? new Date(b.from_date) : null
      const dEnd = b?.to_date ? new Date(b.to_date + 'T23:59:59.999') : null

      const spent = (transactions || [])
        .filter((tx) => {
          if (tx?.type !== 'expense') return false
          if (tx?.category !== catId) return false
          if (dStart && dEnd) {
            const txDate = new Date(tx?.date || tx?.transaction_date || tx?.created_at || 0)
            if (isNaN(txDate.getTime())) return false
            return txDate >= dStart && txDate <= dEnd
          }
          const d = (tx?.date || tx?.transaction_date || '').slice(0, 7)
          return d === currentMonthKey
        })
        .reduce((sum, tx) => sum + (safeConvert(tx?.amount || 0, tx?.currency || home, home, rates) ?? 0), 0)

      const limit = Number(b?.limit_amount) || 0
      const remaining = Math.max(0, limit - spent)
      const pct = limit > 0 ? Math.min(100, Math.round((spent / limit) * 100)) : 0
      const dailyRemaining = remaining / daysLeft
      return { ...b, spent, limit, remaining, pct, dailyRemaining }
    })
  }, [budgets, transactions, currentMonthKey, home, rates, daysLeft])

  const totalBudgetsLimit = useMemo(() => {
    return (budgets || []).reduce((sum, b) => sum + (Number(b?.limit_amount) || 0), 0)
  }, [budgets])

  // 3. Savings Goals: Strictly isolate pure savings items (never render loans, debts, or installments)
  const savingsGoals = useMemo(() => {
    return (goals || []).filter((g) => {
      if (!g) return false
      if (isLoanOrDebt(g)) return false
      const type = String(g?.type || '').toLowerCase()
      return !type || type === 'savings' || type === 'saving' || type === 'goal'
    })
  }, [goals])

  // 2. Baru kemudian hitung totalSaved menggunakan savingsGoals di bawahnya
  const totalSaved = useMemo(() => {
    return savingsGoals.reduce((sum, g) => {
      const amt = Number(g?.saved_amount) || 0
      return sum + (safeConvert(amt, g?.currency || home, home, rates) ?? 0)
    }, 0)
  }, [savingsGoals, home, rates])

  // 4. Loans Total Installments
  const totalLoanInstallment = useMemo(() => {
    return (loans || []).reduce((sum, l) => {
      const amt = Number(l?.installment_amount || l?.monthly_payment || l?.amount) || 0
      return sum + (safeConvert(amt, l?.currency || home, home, rates) ?? 0)
    }, 0)
  }, [loans, home, rates])

  // Currency-adaptive BNPL Subtitle
  const bnplSubtitle = useMemo(() => {
    if (home === 'IDR') return 'SPayLater, Kredivo, GoPay Later, Cicilan'
    if (home === 'MYR') return 'Atome, Grab PayLater, SPayLater'
    if (home === 'TRY') return 'Taksit, Papara, Kredi'
    return 'PayLater, Installments, Loans'
  }, [home])

  // Handlers for Subscriptions
  const openNewSub = () => {
    setSelectedSub(null)
    setSubSheetOpen(true)
  }

  const openEditSub = (sub) => {
    setSelectedSub(sub)
    setSubSheetOpen(true)
  }

  // Handlers for Budgets
  const openNewBudget = () => {
    setEditingBudget(null)
    setBudgetModalOpen(true)
  }

  const openEditBudget = (b) => {
    setEditingBudget(b)
    setBudgetModalOpen(true)
  }

  // Handlers for Savings Goals
  const openNewGoalModal = () => {
    setCreatingGoal(true)
  }

  const addFunds = async () => {
    if (!funding || !Number(fund)) return
    try {
      await store.updateGoal(funding.id, {
        saved_amount: (Number(funding.saved_amount) || 0) + Number(fund),
      })
      setFunding(null)
      setFund('')
      await refresh()
      toast.success(t('saved_msg') || 'Dana ditambahkan')
    } catch (e) {
      toast.error(e?.message || t('error'))
    }
  }

  const removeGoal = async (g) => {
    try {
      await store.deleteGoal(g.id)
      await refresh()
      toast.success(t('deleted') || 'Target dihapus')
    } catch (e) {
      toast.error(e?.message || t('error'))
    }
  }

  const FundingIcon = funding ? goalIcon(funding.icon) : Flag

  return (
    <div className="px-5 pb-28">
      {/* Sticky Top Header */}
      <div className="sticky top-0 z-30 pt-6 pb-2 bg-background/95 backdrop-blur-md">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {t('goals') || 'Goals'}
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5 font-medium">
          Plan, save, and clear debt
        </p>
      </div>

      {/* Subscriptions */}
      <div className="mt-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            SUBSCRIPTIONS
          </span>
          <div className="flex items-center">
            <span className="text-xs text-muted-foreground mr-3 font-medium">
              {fmt(monthlySubTotal, home)}/mo
            </span>
            <button
              type="button"
              onClick={openNewSub}
              className="w-7 h-7 rounded-full bg-foreground text-background flex items-center justify-center hover:opacity-90 active:scale-95 transition-all shadow-xs cursor-pointer"
              aria-label={t('aria_add_subscription')}
              data-testid="new-subscription"
            >
              <Plus size={15} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {subscriptions.length === 0 ? (
          <button
            type="button"
            onClick={openNewSub}
            className="w-full min-h-[90px] rounded-2xl border border-dashed border-border/80 bg-white dark:bg-[#121214] py-7 px-4 text-center text-sm font-medium text-muted-foreground hover:border-foreground/40 hover:text-foreground transition-all cursor-pointer flex items-center justify-center shadow-xs"
          >
            + Add your first subscription
          </button>
        ) : (
          <div className="space-y-2.5">
            {subscriptions.map((sub) => {
              const cycleDisplay = formatCycle(sub.cycle)
              const dateDisplay = sub.next_billing_date || (sub.due_day ? `Day ${sub.due_day}` : '')
              return (
                <div
                  key={sub.id}
                  onClick={() => openEditSub(sub)}
                  className="rounded-2xl border border-border/40 bg-card p-4 flex items-center justify-between hover:bg-muted/20 transition-all cursor-pointer shadow-xs"
                  data-testid={`subscription-card-${sub.id}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-xl overflow-hidden object-cover bg-muted flex items-center justify-center shrink-0 border border-border/20">
                      {sub.cover_url ? (
                        <img
                          src={sub.cover_url}
                          alt={sub.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-sm font-bold uppercase text-foreground">
                          {sub.name ? sub.name.slice(0, 2) : <Repeat size={18} />}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 text-left">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {sub.name}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {cycleDisplay}{dateDisplay ? ` · ${dateDisplay}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className="text-sm font-bold text-foreground">
                      {fmt(sub.amount, sub.currency || home)}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* 2. SECTION: MONTHLY BUDGETS */}
      {/* ============================================================ */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              MONTHLY BUDGETS
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setShowBudgetHelp(true)
              }}
              className="text-muted-foreground hover:text-foreground p-0.5 rounded-full transition-colors"
              aria-label={t('aria_how_budgets_work')}
            >
              <HelpCircle className="cursor-pointer" size={15} />
            </button>
          </div>
          <div className="flex items-center">
            <span className="text-xs text-muted-foreground mr-3 font-medium">
              {fmt(totalBudgetsLimit, home)}/mo
            </span>
            <button
              type="button"
              onClick={openNewBudget}
              className="w-7 h-7 rounded-full bg-foreground text-background flex items-center justify-center hover:opacity-90 active:scale-95 transition-all shadow-xs cursor-pointer"
              aria-label={t('aria_set_budget')}
              data-testid="new-budget"
            >
              <Plus size={15} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {budgetsWithSpending.length === 0 ? (
          <button
            type="button"
            onClick={openNewBudget}
            className="w-full min-h-[90px] rounded-2xl border border-dashed border-border/80 bg-white dark:bg-[#121214] py-7 px-4 text-center text-sm font-medium text-muted-foreground hover:border-foreground/40 hover:text-foreground transition-all cursor-pointer flex items-center justify-center shadow-xs"
          >
            + Set your first budget limit
          </button>
        ) : (
          <div className="space-y-2.5">
            {budgetsWithSpending.map((b) => {
              const catObj = EXPENSE_CATEGORIES.find((c) => c.id === b.category)
              const catName = t(`cat_${b.category}`) || catObj?.name || b.category
              return (
                <div
                  key={b.id}
                  onClick={() => openEditBudget(b)}
                  className="rounded-2xl border border-border/40 bg-card p-4 hover:bg-muted/20 transition-all cursor-pointer shadow-xs space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-muted/60 text-foreground flex items-center justify-center shrink-0 border border-border/20">
                        <CategoryIcon id={b.category} size={18} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {catName}
                          {b.subcategory && !b.subcategory.startsWith('All of') ? ` · ${b.subcategory}` : ''}
                        </p>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {fmt(b.remaining, home)} left of {fmt(b.limit, home)} · ≈ {fmt(b.dailyRemaining, home)}/day
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs font-bold tabular-nums text-foreground">
                        {b.pct}%
                      </span>
                    </div>
                  </div>

                  {/* Horizontal Progress Bar */}
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-300',
                        b.pct >= 100 ? 'bg-rose-500' : 'bg-foreground'
                      )}
                      style={{ width: `${Math.min(100, b.pct)}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Savings goals */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            {t('savings_goals') || 'SAVINGS GOALS'}
          </span>
          <div className="flex items-center">
            <span className="text-xs text-muted-foreground mr-3 font-medium">
              {fmt(totalSaved, home)}
            </span>
            <button
              type="button"
              onClick={openNewGoalModal}
              className="w-7 h-7 rounded-full bg-foreground text-background flex items-center justify-center hover:opacity-90 active:scale-95 transition-all shadow-xs cursor-pointer"
              aria-label={t('new_goal')}
              data-testid="new-goal"
            >
              <Plus size={15} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {savingsGoals.length === 0 ? (
          <button
            type="button"
            onClick={openNewGoalModal}
            className="w-full min-h-[90px] rounded-2xl border border-dashed border-border/80 bg-white dark:bg-[#121214] py-7 px-4 text-center text-sm font-medium text-muted-foreground hover:border-foreground/40 hover:text-foreground transition-all cursor-pointer flex items-center justify-center shadow-xs"
          >
            + Add a savings goal
          </button>
        ) : (
          <div className="space-y-3">
            {savingsGoals.map((g) => {
              const targetVal = Number(g?.target_amount) || 1
              const savedVal = Number(g?.saved_amount) || 0
              const pct = Math.min(100, Math.round((savedVal / targetVal) * 100))
              const GIcon = goalIcon(g?.icon)
              return (
                <div key={g.id} className="rounded-2xl border border-border/40 bg-card p-4 shadow-xs space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {g?.cover_url ? (
                        <div className="w-12 h-12 rounded-xl overflow-hidden object-cover bg-muted shrink-0 border border-border/20">
                          <img src={g.cover_url} alt={g.name} className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-muted/60 text-foreground flex items-center justify-center shrink-0 border border-border/20">
                          <GIcon size={20} strokeWidth={1.75} />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-bold truncate text-foreground">{g?.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {fmt(savedVal, g?.currency || home)} of {fmt(targetVal, g?.currency || home)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-sm font-bold tabular-nums text-foreground">{pct}%</span>
                    </div>
                  </div>

                  {/* Horizontal Progress Bar */}
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-foreground rounded-full transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setFunding(g)}
                      className="flex-1 rounded-xl bg-foreground text-background text-xs font-bold py-2.5 transition-opacity hover:opacity-90 active:scale-[0.99] cursor-pointer shadow-xs"
                    >
                      {t('add_funds') || '+ Add funds'}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeGoal(g)}
                      className="h-9 w-9 rounded-xl bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
                      aria-label={t('aria_delete_goal')}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* 4. SECTION: LOANS & BNPL */}
      {/* ============================================================ */}
      <div className="mt-8">
        <LoansSection
          loans={loans}
          home={home}
          accounts={accounts}
          rates={rates}
          store={store}
          fmt={fmt}
          t={t}
          onRefresh={async () => {
            await loadData()
            await refresh?.()
          }}
        />
      </div>
      {/* ============================================================ */}
      {/* MODALS & SHEETS */}
      {/* ============================================================ */}

      {/* 1. Subscription Detail / Edit Bottom Sheet */}
      <SubscriptionSheet
        open={subSheetOpen}
        onClose={() => setSubSheetOpen(false)}
        subscription={selectedSub}
        onSaved={async () => {
          await loadData()
          await refresh()
        }}
        onDeleted={async () => {
          await loadData()
          await refresh()
        }}
      />

      {/* 2. Set / Edit Budget Modal */}
      <SetBudgetModal
        open={budgetModalOpen}
        onClose={() => setBudgetModalOpen(false)}
        budget={editingBudget}
        onSaved={async () => {
          await loadData()
          await refresh?.()
        }}
        onDeleted={async () => {
          await loadData()
          await refresh?.()
        }}
        onManageCategories={() => {
          if (typeof openSheet === 'function') {
            openSheet('catman')
          }
        }}
        transactions={transactions}
        existingBudgets={budgets}
        home={home}
        fmt={fmt}
        rates={rates}
        store={store}
        t={t}
      />

      {/* How Budgets Work Dialog */}
      {showBudgetHelp && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in"
          onClick={() => setShowBudgetHelp(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-card border border-border/40 p-6 shadow-2xl space-y-4 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-2xl bg-muted text-foreground mx-auto flex items-center justify-center">
              <HelpCircle size={24} />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">
                {t('budget_how_works_title')}
              </h3>
              <div className="text-xs text-muted-foreground mt-3 space-y-2.5 leading-relaxed text-left" dangerouslySetInnerHTML={{ __html: t('budget_how_works_desc').replace(/\n/g, '<br/>') }} />
            </div>
            <button
              type="button"
              onClick={() => setShowBudgetHelp(false)}
              className="w-full rounded-xl bg-foreground text-background font-semibold py-3 text-sm transition-all active:scale-95 cursor-pointer hover:opacity-90"
            >
              {t('budget_got_it')}
            </button>
          </div>
        </div>
      )}

      {/* 3. New Savings Goal Modal */}
      <NewSavingsGoalModal
        open={creatingGoal}
        onClose={() => setCreatingGoal(false)}
        onSaved={async () => {
          await loadData()
          await refresh?.()
        }}
        home={home}
        store={store}
        t={t}
      />

      {/* Add Funds to Goal Modal */}
      <Sheet open={!!funding} onClose={() => setFunding(null)} title={t('add_funds') || 'Add Funds'}>
        <div className="space-y-5 pt-2 pb-6">
          <div className="flex justify-center">
            <div className="h-16 w-16 rounded-2xl bg-muted text-foreground flex items-center justify-center">
              <FundingIcon size={28} strokeWidth={1.75} />
            </div>
          </div>
          <p className="text-center font-bold text-foreground text-lg">{funding?.name}</p>
          <Field label={`${t('amount')} (${getCurrency(funding?.currency || home).code})`}>
            <TextInput
              type="text"
              inputMode="decimal"
              value={fund}
              onChange={(e) => setFund(sanitizeAmount(e.target.value))}
              placeholder="0"
              autoFocus
            />
          </Field>
          <PrimaryButton onClick={addFunds} disabled={!Number(fund)}>
            {t('save')}
          </PrimaryButton>
        </div>
      </Sheet>
    </div>
  )
}
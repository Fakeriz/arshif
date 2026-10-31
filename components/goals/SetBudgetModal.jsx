'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import { Calendar, HelpCircle, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Sheet, CategoryIcon, DatePickerInput } from '@/components/arshif/ui'
import { useApp } from '@/components/arshif/context'
import { CATEGORIES } from '@/lib/categories'
import { getCurrency } from '@/lib/currencies'
import { convert } from '@/lib/rates'
import { cn, triggerHaptic } from '@/lib/utils'

const EXPENSE_CATEGORIES = CATEGORIES.filter((c) => c.types?.includes('expense'))

const SUBCATEGORIES_MAP = {
  food: ['All of Food', 'Restaurants', 'Groceries', 'Coffee & Drinks', 'Snacks', 'Delivery'],
  transport: ['All of Transport', 'Fuel', 'Toll', 'Parking', 'Public Transit', 'Maintenance'],
  shopping: ['All of Shopping', 'Clothing', 'Electronics', 'Home & Living', 'Personal Care', 'Hobbies'],
  bills: ['All of Bills', 'Electricity', 'Water', 'Internet & Phone', 'Rent & Housing', 'Insurance'],
  entertainment: ['All of Entertainment', 'Streaming & Movies', 'Games', 'Concerts & Events', 'Hobbies'],
  health: ['All of Health', 'Doctor & Clinic', 'Pharmacy & Medicine', 'Fitness & Gym', 'Dental'],
  education: ['All of Education', 'Courses & Tuition', 'Books & Materials', 'Certifications'],
  travel: ['All of Travel', 'Flights', 'Hotels & Lodging', 'Activities', 'Transit'],
  housing: ['All of Housing', 'Rent', 'Repairs & Maintenance', 'Furniture', 'Utilities'],
  personal: ['All of Personal', 'Self-Care', 'Gifts & Donations', 'Charity', 'Beauty'],
  business: ['All of Business', 'Office Supplies', 'Software & Tools', 'Marketing & Ads'],
  groceries: ['All of Groceries', 'Supermarket', 'Fresh Produce', 'Meat & Seafood', 'Beverages'],
  other: ['All of Other', 'Miscellaneous', 'Unexpected'],
}

const getQuickOptions = (currency) => {
  if (currency === 'IDR') {
    return [
      { amount: 200000, label: 'Rp 200rb' },
      { amount: 500000, label: 'Rp 500rb' },
      { amount: 1000000, label: 'Rp 1jt' },
      { amount: 2000000, label: 'Rp 2jt' },
    ]
  }
  if (currency === 'MYR') {
    return [
      { amount: 100, label: 'RM 100' },
      { amount: 300, label: 'RM 300' },
      { amount: 500, label: 'RM 500' },
      { amount: 1000, label: 'RM 1000' },
    ]
  }
  if (currency === 'TRY') {
    return [
      { amount: 500, label: '₺500' },
      { amount: 1000, label: '₺1000' },
      { amount: 2500, label: '₺2500' },
      { amount: 5000, label: '₺5000' },
    ]
  }
  return [
    { amount: 50, label: '$50' },
    { amount: 100, label: '$100' },
    { amount: 250, label: '$250' },
    { amount: 500, label: '$500' },
  ]
}

const formatDateDisplay = (dateStr) => {
  if (!dateStr) return '-'
  try {
    const [y, m, d] = dateStr.split('-').map(Number)
    const date = new Date(y, m - 1, d)
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return dateStr
  }
}

export default function SetBudgetModal({
  open,
  onClose,
  budget,
  onSaved,
  onDeleted,
  onManageCategories,
  transactions = [],
  existingBudgets = [],
  home = 'IDR',
  fmt,
  rates,
  store,
  t,
}) {
  const app = useApp()
  const openSheet = app?.open
  const [amountInput, setAmountInput] = useState('')
  const [budgetLimit, setBudgetLimit] = useState(0)
  const inputRef = useRef(null)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [repeat, setRepeat] = useState('monthly') // 'none' | 'weekly' | 'fortnightly' | 'monthly'
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]?.id || 'food')
  const [subcategory, setSubcategory] = useState('')
  const [showHelp, setShowHelp] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const currencySymbol = useMemo(() => {
    return getCurrency(home)?.symbol || home || '$'
  }, [home])

  // Initialize or reset form state when opened or budget prop changes
  useEffect(() => {
    if (!open) return

    const now = new Date()
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)

    const toYmd = (d) => {
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${y}-${m}-${day}`
    }

    if (budget) {
      const initVal = budget.limit_amount != null && budget.limit_amount !== '' ? String(budget.limit_amount) : ''
      setAmountInput(initVal)
      setBudgetLimit(Number(initVal) || 0)
      setFromDate(budget.from_date || toYmd(firstDay))
      setToDate(budget.to_date || toYmd(lastDay))
      setRepeat(budget.repeat || budget.period || 'monthly')
      setCategory(budget.category || EXPENSE_CATEGORIES[0]?.id || 'food')
      setSubcategory(budget.subcategory || '')
    } else {
      setAmountInput('')
      setBudgetLimit(0)
      setFromDate(toYmd(firstDay))
      setToDate(toYmd(lastDay))
      setRepeat('monthly')
      const defaultCat = EXPENSE_CATEGORIES[0]?.id || 'food'
      setCategory(defaultCat)
      const subs = SUBCATEGORIES_MAP[defaultCat] || []
      setSubcategory(subs[0] || '')
    }
  }, [open, budget])

  // Calculation of totalDays and daysLeft
  const totalDays = useMemo(() => {
    if (!fromDate || !toDate) return 30
    const d1 = new Date(fromDate)
    const d2 = new Date(toDate)
    const diff = Math.round((d2 - d1) / (1000 * 60 * 60 * 24)) + 1
    return Math.max(1, diff)
  }, [fromDate, toDate])

  const daysLeft = useMemo(() => {
    if (!toDate) return 0
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    const [y, m, d] = toDate.split('-').map(Number)
    const target = new Date(y, m - 1, d)
    const diff = Math.round((target - now) / (1000 * 60 * 60 * 24))
    return Math.max(0, diff)
  }, [toDate])

  // Text shown for the next repeat period.
  const nextPeriodText = useMemo(() => {
    if (repeat === 'none') {
      return 'Ends on the selected To date and does not repeat.'
    }
    if (!toDate) return 'Starts over by itself for the next period.'
    try {
      const [y, m, d] = toDate.split('-').map(Number)
      const nextStart = new Date(y, m - 1, d + 1)
      let nextEnd = new Date(nextStart)
      if (repeat === 'weekly') {
        nextEnd.setDate(nextStart.getDate() + 6)
      } else if (repeat === 'fortnightly') {
        nextEnd.setDate(nextStart.getDate() + 13)
      } else if (repeat === 'monthly') {
        nextEnd = new Date(nextStart.getFullYear(), nextStart.getMonth() + 1, 0)
      }
      const sStr = nextStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
      const eStr = nextEnd.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
      return `Starts over by itself. Next period: ${sStr} – ${eStr}.`
    } catch {
      return 'Starts over by itself for the next period.'
    }
  }, [repeat, toDate])

  // Safe currency formatting
  const safeFmt = (amt, code = home) => {
    try {
      if (typeof fmt === 'function') return fmt(amt, code)
      return `${code} ${Number(amt || 0).toLocaleString()}`
    } catch {
      return `${code} ${amt}`
    }
  }

  const handleAmountChange = (e) => {
    const raw = e.target.value.replace(/,/g, '.').replace(/[^0-9.]/g, '')
    // Cegah banyak titik desimal
    if ((raw.match(/\./g) || []).length > 1) return
    setAmountInput(raw)
    setBudgetLimit(Number(raw) || 0)
  }

  const handleSelectQuickOption = (optAmount) => {
    const str = String(optAmount)
    setAmountInput(str)
    setBudgetLimit(optAmount)
  }

  const handleManageCategories = () => {
    if (typeof onManageCategories === 'function') {
      onManageCategories()
      return
    }
    if (typeof openSheet === 'function') {
      openSheet('catman')
    }
  }

  const quickOptions = useMemo(() => getQuickOptions(home), [home])

  // Subcategories available for active category
  const availableSubcategories = useMemo(() => {
    return SUBCATEGORIES_MAP[category] || []
  }, [category])

  // Actual spent in the selected period for selected category
  const spentInPeriod = useMemo(() => {
    if (!category) return 0
    const dStart = fromDate ? new Date(fromDate) : new Date(2000, 0, 1)
    const dEnd = toDate ? new Date(toDate + 'T23:59:59.999') : new Date(2100, 0, 1)

    return (transactions || [])
      .filter((tx) => {
        if (tx?.type !== 'expense') return false
        if (tx?.category !== category) return false
        const txDate = new Date(tx?.date || tx?.transaction_date || tx?.created_at || 0)
        if (isNaN(txDate.getTime())) return false
        return txDate >= dStart && txDate <= dEnd
      })
      .reduce((sum, tx) => {
        return sum + convert(tx?.amount || 0, tx?.currency || home, home, rates)
      }, 0)
  }, [transactions, category, fromDate, toDate, home, rates])

  // All budgets accumulation summary
  const otherBudgetsTotal = useMemo(() => {
    return (existingBudgets || [])
      .filter((b) => b?.id !== budget?.id)
      .reduce((sum, b) => sum + (Number(b?.limit_amount) || 0), 0)
  }, [existingBudgets, budget])

  const totalAccumulatedLimit = otherBudgetsTotal + (budgetLimit || Number(amountInput) || 0)

  // Overall benchmark comparison target
  const overallTarget = useMemo(() => {
    if (totalAccumulatedLimit <= 0) return 0
    // IDR rounds to the next 500k; other currencies round to the next 100.
    if (home === 'IDR') {
      return Math.max(totalAccumulatedLimit, Math.ceil(totalAccumulatedLimit / 500000) * 500000 || totalAccumulatedLimit)
    }
    return Math.max(totalAccumulatedLimit, Math.ceil(totalAccumulatedLimit / 100) * 100 || totalAccumulatedLimit)
  }, [totalAccumulatedLimit, home])

  const isValid = (budgetLimit > 0) || (Number(amountInput) > 0)

  const handleSave = async () => {
    const num = budgetLimit || Number(amountInput) || 0
    if (!num || num <= 0) {
      toast.error('Masukkan pagu anggaran yang valid')
      return
    }

    setIsSaving(true)
    try {
      const payload = {
        category,
        subcategory: subcategory || null,
        limit_amount: num,
        currency: home,
        from_date: fromDate,
        to_date: toDate,
        period: repeat === 'none' ? 'custom' : repeat,
        repeat,
      }

      if (budget?.id) {
        if (store?.updateBudget) {
          await store.updateBudget(budget.id, payload)
        }
        triggerHaptic('success')
        toast.success(t?.('saved_msg') || 'Anggaran diperbarui')
      } else {
        if (store?.createBudget) {
          await store.createBudget(payload)
        }
        triggerHaptic('success')
        toast.success(t?.('saved_msg') || 'Anggaran berhasil diset')
      }

      onSaved?.()
      onClose?.()
    } catch (e) {
      toast.error(e?.message || t?.('error') || 'Gagal menyimpan anggaran')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!budget?.id) return
    triggerHaptic('warning')
    try {
      if (store?.deleteBudget) {
        await store.deleteBudget(budget.id)
      }
      toast.success(t?.('deleted') || 'Anggaran dihapus')
      onDeleted?.()
      onClose?.()
    } catch (e) {
      toast.error(e?.message || t?.('error') || 'Gagal menghapus anggaran')
    }
  }

  const categoryLabel = t?.(`cat_${category}`) || EXPENSE_CATEGORIES.find((c) => c.id === category)?.name || category

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        zIndex={70}
        title={
          <span className="inline-flex items-center justify-center gap-1.5">
            <span>{budget ? t('budget_edit') : t('budget_set')}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setShowHelp(true)
              }}
              className="p-1 rounded-full text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              aria-label={t('aria_how_budgets_work')}
            >
              <HelpCircle size={16} strokeWidth={2} />
            </button>
          </span>
        }
        left={
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-semibold text-foreground hover:opacity-80 transition-opacity cursor-pointer"
          >
            {t('cancel')}
          </button>
        }
        right={
          <button
            type="button"
            onClick={handleSave}
            disabled={!isValid || isSaving}
            className="text-sm font-bold text-foreground hover:opacity-80 transition-opacity disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
          >
            {isSaving ? '...' : 'Set'}
          </button>
        }
      >
        <div className="space-y-4 pt-1 pb-10">
          {/* Input limit & opsi cepat */}
          <div className="space-y-2">
            <label className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              {t('budget_limit_label')}
            </label>
            <div
              onClick={() => inputRef.current?.focus()}
              className="relative rounded-2xl bg-muted/40 border border-border/40 p-4 flex flex-col items-center justify-center focus-within:border-foreground/40 transition-colors cursor-text"
            >
              <div className="flex items-center justify-center gap-1.5 w-full">
                <span className="text-3xl font-extrabold text-foreground select-none shrink-0">
                  {currencySymbol || '$'}
                </span>
                <input
                  ref={inputRef}
                  type="text"
                  inputMode="decimal"
                  value={amountInput}
                  onChange={handleAmountChange}
                  placeholder="0.00"
                  className="w-full max-w-[220px] text-3xl font-extrabold text-foreground bg-transparent text-center outline-none placeholder:text-muted-foreground/30 tabular-nums"
                  autoFocus={false}
                />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                {t('budget_manual_hint')}
              </p>
            </div>

            {/* Opsi cepat */}
            <div className="pt-1">
              <div className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase mb-1.5 px-0.5">
                {t('budget_quick_options')}
              </div>
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
                {quickOptions.map((opt) => {
                  const isSelected = budgetLimit === opt.amount || Number(amountInput) === opt.amount
                  return (
                    <button
                      key={opt.amount}
                      type="button"
                      onClick={() => handleSelectQuickOption(opt.amount)}
                      className={cn(
                        'px-3.5 py-1.5 rounded-full text-xs font-semibold shrink-0 transition-all cursor-pointer border',
                        isSelected
                          ? 'bg-foreground text-background border-foreground shadow-xs'
                          : 'bg-muted/40 text-muted-foreground border-border/40 hover:text-foreground hover:bg-muted/60'
                      )}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Periode & durasi */}
          <div>
            <label className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase block mb-1.5">
              {t('budget_period_label')}
            </label>
            <div className="bg-muted/30 border border-border/40 rounded-2xl p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <DatePickerInput
                  label={t('budget_from')}
                  value={fromDate}
                  onChange={setFromDate}
                />
                <DatePickerInput
                  label={t('budget_to')}
                  value={toDate}
                  onChange={setToDate}
                />
              </div>

              {/* Baris durasi bawah */}
              <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/20">
                <span>{totalDays} days total</span>
                <span>{daysLeft} days left</span>
              </div>
            </div>
          </div>

          {/* Perulangan */}
          <div>
            <label className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase block mb-1.5">
              {t('budget_repeat_label')}
            </label>
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar p-1 bg-muted/20 border border-border/40 rounded-full">
              {[
                { id: 'none', label: "Doesn't repeat" },
                { id: 'weekly', label: 'Weekly' },
                { id: 'fortnightly', label: 'Fortnightly' },
                { id: 'monthly', label: 'Monthly' },
              ].map((r) => {
                const active = repeat === r.id
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setRepeat(r.id)}
                    className={cn(
                      'flex-1 text-center whitespace-nowrap transition-all cursor-pointer rounded-full px-4 py-2 text-xs',
                      active
                        ? 'bg-foreground text-background font-semibold shadow-xs'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/40 font-medium'
                    )}
                  >
                    {r.label}
                  </button>
                )
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-2 px-1">
              {nextPeriodText}
            </p>
          </div>

          {/* Ringkasan plafon & kategori */}
          <div>
            {/* Ringkasan akumulasi semua budget */}
            <div className="bg-muted/20 border border-border/30 rounded-2xl p-3.5 flex justify-between items-center text-xs">
                <span>{t('budget_all_budgets')}</span>
              <span className="font-bold text-foreground tabular-nums">
                {safeFmt(totalAccumulatedLimit, home)}
                {overallTarget > totalAccumulatedLimit ? ` / ${safeFmt(overallTarget, home)}` : ''}
              </span>
            </div>

            {/* Kartu kategori terpilih */}
            <div className="bg-muted/30 border border-border/40 rounded-2xl p-4 flex items-center gap-3.5 mt-3">
              <div className="w-12 h-12 rounded-2xl bg-foreground text-background flex items-center justify-center shrink-0">
                <CategoryIcon id={category} size={22} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground truncate">
                  {categoryLabel}
                  {subcategory && !subcategory.startsWith('All of') ? ` · ${subcategory}` : ''}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  Spent: {safeFmt(spentInPeriod, home)} this period
                </p>
              </div>
            </div>
          </div>

          {/* Pilih kategori & subkategori */}
          <div>
            
            <div className="flex items-center justify-between mt-5 mb-2 px-0.5">
              <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                {t('budget_choose_category')}
              </span>
              <button
                type="button"
                onClick={handleManageCategories}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors active:scale-95 cursor-pointer"
                title={t('budget_manage_categories')}
                aria-label={t('aria_manage_categories')}
              >
                <Pencil className="stroke-[2]" size={12} />
              </button>
            </div>

            
            <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar py-1">
              {EXPENSE_CATEGORIES.map((cat) => {
                const active = category === cat.id
                const catName = t?.(`cat_${cat.id}`) || cat.name || cat.id
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setCategory(cat.id)
                      const subs = SUBCATEGORIES_MAP[cat.id] || []
                      setSubcategory(subs[0] || '')
                    }}
                    className="flex flex-col items-center gap-1.5 shrink-0 group cursor-pointer"
                    title={catName}
                  >
                    <div
                      className={cn(
                        'w-12 h-12 rounded-2xl flex items-center justify-center transition-all',
                        active
                          ? 'bg-foreground text-background shadow-sm'
                          : 'bg-muted/40 border border-border/40 text-muted-foreground group-hover:text-foreground group-hover:bg-muted/60'
                      )}
                    >
                      <CategoryIcon id={cat.id} size={20} />
                    </div>
                    <span
                      className={cn(
                        'text-[10px] max-w-[56px] truncate text-center transition-colors',
                        active ? 'font-bold text-foreground' : 'text-muted-foreground group-hover:text-foreground'
                      )}
                    >
                      {catName}
                    </span>
                  </button>
                )
              })}
            </div>

            
            {availableSubcategories.length > 0 && (
              <div className="mt-4">
                <div className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase mb-2 px-0.5">
                  {t('budget_choose_subcategory')}
                </div>
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                  {availableSubcategories.map((sub) => {
                    const active = subcategory === sub
                    return (
                      <button
                        key={sub}
                        type="button"
                        onClick={() => setSubcategory(sub)}
                        className={cn(
                          'shrink-0 font-medium rounded-full px-3.5 py-1.5 text-xs transition-all cursor-pointer',
                          active
                            ? 'bg-foreground text-background font-medium shadow-xs'
                            : 'bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-muted/60 border border-border/40'
                        )}
                      >
                        {sub}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          
          {budget?.id && (
            <div className="pt-2">
              <button
                type="button"
                onClick={handleDelete}
                className="w-full py-3 rounded-2xl border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10 text-rose-500 font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Trash2 size={14} />
                <span>{t('budget_delete')}</span>
              </button>
            </div>
          )}
        </div>
      </Sheet>

      {/* Dialog "How Budgets Work" */}
      {showHelp && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-3xl bg-card border border-border/40 p-6 shadow-2xl space-y-3">
            <h3 className="font-bold text-base text-foreground">{t('budget_how_works_title')}</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {t('budget_how_works_desc')}
            </p>
            <button
              type="button"
              onClick={() => setShowHelp(false)}
              className="w-full bg-muted/70 hover:bg-muted text-foreground py-3 rounded-2xl font-semibold mt-4 text-sm transition-colors cursor-pointer"
            >
              {t('budget_got_it')}
            </button>
          </div>
        </div>
      )}
    </>
  )
}

'use client'
import { useState, useEffect, useRef } from 'react'
import {
  Camera, Calendar, ChevronDown, Banknote, Smartphone, CreditCard,
  Landmark, X, Check, Repeat
} from 'lucide-react'
import { toast } from 'sonner'
import { useApp } from './context'
import CurrencySheet from './CurrencySheet'
import { Sheet, CategoryIcon, DatePickerInput, Switch } from './ui'
import { CATEGORIES } from '@/lib/categories'
import { getCurrency } from '@/lib/currencies'
import { cn, triggerHaptic } from '@/lib/utils'

const EXPENSE_CATEGORIES = CATEGORIES.filter((c) => c.types?.includes('expense'))

const CYCLES = [
  { id: 'weekly', label: 'Weekly', i18n: 'cycle_weekly' },
  { id: 'monthly', label: 'Monthly', i18n: 'cycle_monthly' },
  { id: '3_months', label: '3 Months', i18n: 'cycle_3months' },
  { id: '6_months', label: '6 Months', i18n: 'cycle_6months' },
  { id: 'yearly', label: 'Yearly', i18n: 'cycle_yearly' },
]
// Labels localized via t() at render time: cycle_weekly, cycle_monthly, cycle_3months, cycle_6months, cycle_yearly

function formatDisplayDate(dateStr) {
  if (!dateStr) return t('sub_select_date') || 'Select date'
  try {
    const parts = dateStr.split('-').map(Number)
    if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
      const d = new Date(parts[0], parts[1] - 1, parts[2])
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    }
  } catch {}
  return dateStr
}

function getTodayIsoDate() {
  const today = new Date()
  const y = today.getFullYear()
  const m = String(today.getMonth() + 1).padStart(2, '0')
  const d = String(today.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export default function SubscriptionSheet({
  open,
  onClose,
  subscription = null,
  onSaved,
  onDeleted,
}) {
  const { home, accounts = [], store, t, fmt } = useApp()

  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState(home || 'USD')
  const [coverUrl, setCoverUrl] = useState('')
  const [cycle, setCycle] = useState('monthly')
  const [nextBillingDate, setNextBillingDate] = useState(getTodayIsoDate())
  const [showAsBill, setShowAsBill] = useState(true)
  const [autoLogExpense, setAutoLogExpense] = useState(false)
  const [accountId, setAccountId] = useState(null)
  const [paymentMethod, setPaymentMethod] = useState('card')
  const [category, setCategory] = useState(null)

  const [pickCurrency, setPickCurrency] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const fileInputRef = useRef(null)
  const dateInputRef = useRef(null)

  const isEditing = Boolean(subscription?.id)

  // Populate or reset state when sheet opens or subscription changes
  useEffect(() => {
    if (open) {
      setConfirmDelete(false)
      if (subscription) {
        setName(subscription.name || '')
        setAmount(subscription.amount !== undefined ? String(subscription.amount) : '')
        setCurrency(subscription.currency || home || 'USD')
        setCoverUrl(subscription.cover_url || '')
        setCycle(subscription.cycle || 'monthly')
        setNextBillingDate(subscription.next_billing_date || getTodayIsoDate())
        setShowAsBill(subscription.show_as_bill !== undefined ? subscription.show_as_bill : true)
        setAutoLogExpense(Boolean(subscription.auto_log_expense))
        setAccountId(subscription.account_id || null)
        setPaymentMethod(subscription.payment_method || 'card')
        setCategory(subscription.category || null)
      } else {
        setName('')
        setAmount('')
        setCurrency(home || 'USD')
        setCoverUrl('')
        setCycle('monthly')
        setNextBillingDate(getTodayIsoDate())
        setShowAsBill(true)
        setAutoLogExpense(false)
        setAccountId(accounts[0]?.id || null)
        setPaymentMethod('card')
        setCategory(null)
      }
    }
  }, [open, subscription, home, accounts])

  // Prevent background scroll when opened
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image size must be under 2MB')
      return
    }
    const reader = new FileReader()
    reader.onload = (ev) => {
      setCoverUrl(ev.target?.result || '')
    }
    reader.readAsDataURL(file)
  }

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Please enter a service name')
      return
    }
    const numAmount = Number(amount)
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error('Please enter a valid amount')
      return
    }

    setSaving(true)
    try {
      // Calculate due_day from nextBillingDate
      let dueDay = 1
      if (nextBillingDate) {
        const parts = nextBillingDate.split('-')
        if (parts.length === 3) dueDay = Math.min(31, Math.max(1, parseInt(parts[2], 10) || 1))
      }

      const payload = {
        name: name.trim(),
        amount: numAmount,
        currency,
        cover_url: coverUrl || null,
        cycle,
        next_billing_date: nextBillingDate,
        billing_date: nextBillingDate,
        due_day: dueDay,
        show_as_bill: showAsBill,
        auto_log_expense: autoLogExpense,
        account_id: accountId || null,
        payment_method: paymentMethod,
        category: category || null,
      }

      if (isEditing) {
        await store.updateSubscription(subscription.id, payload)
        triggerHaptic('success')
        toast.success(t('saved_msg') || 'Subscription updated')
      } else {
        await store.createSubscription(payload)
        triggerHaptic('success')
        toast.success(t('saved_msg') || 'Subscription added')
      }

      await onSaved?.()
      onClose?.()
    } catch (err) {
      toast.error(err?.message || 'Failed to save subscription')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!isEditing || !subscription?.id) return
    triggerHaptic('warning')
    setSaving(true)
    try {
      await store.deleteSubscription(subscription.id)
      toast.success(t('deleted') || 'Subscription deleted')
      await onDeleted?.()
      onClose?.()
    } catch (err) {
      toast.error(err?.message || 'Failed to delete subscription')
    } finally {
      setSaving(false)
    }
  }

  const qrLabel = currency === 'IDR' ? 'QRIS' : currency === 'MYR' ? 'QR / DuitNow' : 'QR'
  const paymentMethods = [
    { id: 'cash', label: 'Cash', i18n: 'pay_cash', Icon: Banknote },
    { id: 'qr', label: qrLabel, i18n: null, Icon: Smartphone },
    { id: 'card', label: 'Card', i18n: 'pay_card', Icon: CreditCard },
    { id: 'bank', label: 'Bank Transfer', i18n: 'pay_bank_transfer', Icon: Landmark },
  ]

  const currencySymbol = getCurrency(currency)?.symbol || '$'

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        zIndex={70}
        title={isEditing ? 'Edit Subscription' : 'New Subscription'}
        right={
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="text-sm font-bold text-foreground hover:opacity-80 transition-opacity cursor-pointer disabled:opacity-40"
          >
            {saving ? '...' : t('done')}
          </button>
        }
      >
        <div className="space-y-5">
          {/* Field 1 - Service Name */}
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-medium block">
              {t('sub_service_name')}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('sub_name_placeholder')}
                    className="w-full bg-muted/40 rounded-2xl p-4 text-base font-medium text-foreground outline-none border border-border/20 focus:border-foreground/30 transition-colors"
                  />
                </div>

                {/* Field 2 - Amount & Mata Uang */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      {t('amount')}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPickCurrency(true)}
                      className="inline-flex items-center gap-1 text-xs font-bold text-foreground bg-muted/50 hover:bg-muted rounded-lg px-2 py-1 transition-colors cursor-pointer"
                    >
                      <span>{currency}</span>
                      <ChevronDown size={14} className="text-muted-foreground" />
                    </button>
                  </div>
                  <div className="flex items-center bg-muted/40 rounded-2xl px-4 py-3.5 border border-border/20 focus-within:border-foreground/30 transition-colors">
                    <span className="text-sm font-semibold text-muted-foreground mr-1.5 shrink-0 select-none">
                      {currencySymbol}
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                      placeholder="0"
                      className="bg-transparent text-base font-semibold text-foreground outline-none w-full placeholder:text-muted-foreground/40"
                    />
                  </div>
                </div>

                {/* Field 3 - Cover Logo / Image (Optional) */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                    {t('sub_cover_optional')}
                  </span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                  />

                  {coverUrl ? (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="aspect-[2.3/1] w-full rounded-2xl overflow-hidden relative cursor-pointer group bg-muted border border-border/30 shadow-xs"
                    >
                      <img
                        src={coverUrl}
                        alt="Cover"
                        className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-300"
                      />
                      <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                        <div className="w-10 h-10 rounded-full bg-black/60 text-white flex items-center justify-center backdrop-blur-md shadow-md group-hover:scale-110 active:scale-95 transition-transform">
                          <Camera size={18} />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setCoverUrl('')
                        }}
                        className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-md z-10 transition-transform active:scale-95 cursor-pointer"
                        title={t('remove_cover') || 'Remove cover'}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="aspect-[2.3/1] w-full rounded-2xl overflow-hidden relative cursor-pointer group bg-muted/30 border border-dashed border-border/60 hover:border-foreground/30 flex flex-col items-center justify-center gap-2 transition-all p-4 text-center"
                    >
                      <div className="w-10 h-10 rounded-full bg-muted text-muted-foreground group-hover:text-foreground flex items-center justify-center transition-colors">
                        <Camera size={20} />
                      </div>
                      <span className="text-xs text-muted-foreground font-medium">
                        {t('sub_tap_upload')}
                      </span>
                    </div>
                  )}
                </div>

                {/* Field 4 - Billing Cycle */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                    {t('billing_cycle')}
                  </span>
                  <div className="flex bg-muted/40 p-1 rounded-2xl border border-border/20 overflow-x-auto no-scrollbar gap-1">
                    {CYCLES.map((opt) => {
                      const active = cycle === opt.id
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setCycle(opt.id)}
                          className={cn(
                            'flex-1 min-w-[70px] text-center whitespace-nowrap py-2 px-3 text-xs transition-all cursor-pointer select-none',
                            active
                              ? 'bg-card text-foreground shadow-sm font-semibold rounded-xl'
                              : 'text-muted-foreground hover:text-foreground font-medium'
                          )}
                        >
                          {opt.i18n ? t(opt.i18n) || opt.label : opt.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Field 5 - Next Billing Date */}
                <DatePickerInput
                  label={t('next_billing_date') || 'Next billing date'}
                  value={nextBillingDate}
                  onChange={setNextBillingDate}
                />

                {/* Field 6 - Dua Sakelar Toggle Hijau (iOS Green Toggles) */}
                <div className="bg-muted/30 rounded-2xl p-4 space-y-4 border border-border/30">
                  {/* Toggle 1: Show as bill */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 pr-2">
                      <p className="text-sm font-semibold text-foreground">{t('subscription_show_bill')}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {t('subscription_bill_hint')}
                      </p>
                    </div>
                    <Switch checked={showAsBill} onChange={setShowAsBill} />
                  </div>

                  <div className="border-t border-border/20" />

                  {/* Toggle 2: Auto-log expense */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 pr-2">
                      <p className="text-sm font-semibold text-foreground">{t('auto_log_expense')}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {t('sub_auto_log_desc')}
                      </p>
                    </div>
                    <Switch checked={autoLogExpense} onChange={setAutoLogExpense} />
                  </div>
                </div>

                {/* Field 7 - Account Selector */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                    {t('sub_account_label')}
                  </span>
                  <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5 py-1">
                    {accounts.map((a) => {
                      const active = accountId === a.id
                      return (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => setAccountId(a.id)}
                          className={cn(
                            'shrink-0 text-xs px-4 py-2 rounded-full transition-all cursor-pointer whitespace-nowrap',
                            active
                              ? 'bg-foreground text-background font-semibold shadow-xs'
                              : 'bg-muted/40 text-muted-foreground hover:text-foreground font-medium border border-border/30'
                          )}
                        >
                          {a.name}
                        </button>
                      )
                    })}
                    <button
                      type="button"
                      onClick={() => setAccountId(null)}
                      className={cn(
                        'shrink-0 text-xs px-4 py-2 rounded-full transition-all cursor-pointer whitespace-nowrap',
                        !accountId
                          ? 'bg-foreground text-background font-semibold shadow-xs'
                          : 'bg-muted/40 text-muted-foreground hover:text-foreground font-medium border border-border/30'
                      )}
                    >
                      {t('sub_unassigned')}
                    </button>
                  </div>
                </div>

                {/* Field 8 - Payment Method */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                    {t('sub_payment_method')}
                  </span>
                  <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5 py-1">
                    {paymentMethods.map((m) => {
                      const active = paymentMethod === m.id
                      const Icon = m.Icon
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setPaymentMethod(m.id)}
                          className={cn(
                            'shrink-0 text-xs px-4 py-2 rounded-full flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap',
                            active
                              ? 'bg-foreground text-background font-semibold shadow-xs'
                              : 'bg-muted/40 text-muted-foreground hover:text-foreground font-medium border border-border/30'
                          )}
                        >
                          <Icon size={14} />
                          <span>{m.i18n ? t(m.i18n) || m.label : m.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Field 9 - Category (Optional) */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                    {t('sub_category_optional')}
                  </span>
                  <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-5 px-5 py-1">
                    {/* None Option */}
                    <button
                      type="button"
                      onClick={() => setCategory(null)}
                      className="flex flex-col items-center gap-1 shrink-0 cursor-pointer group"
                    >
                      <div
                        className={cn(
                          'w-12 h-12 rounded-2xl flex items-center justify-center transition-all',
                          !category
                            ? 'bg-foreground text-background shadow-sm'
                            : 'bg-muted/40 text-muted-foreground hover:text-foreground border border-border/30'
                        )}
                      >
                        <X size={20} strokeWidth={2} />
                      </div>
                      <span className="text-[10px] font-medium text-muted-foreground text-center max-w-[56px] truncate">
                        {t('sub_none')}
                      </span>
                    </button>

                    {/* Categories */}
                    {EXPENSE_CATEGORIES.map((c) => {
                      const active = category === c.id
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setCategory(c.id)}
                          className="flex flex-col items-center gap-1 shrink-0 cursor-pointer group"
                        >
                          <div
                            className={cn(
                              'w-12 h-12 rounded-2xl flex items-center justify-center transition-all',
                              active
                                ? 'bg-foreground text-background shadow-sm'
                                : 'bg-muted/40 text-muted-foreground hover:text-foreground border border-border/30'
                            )}
                          >
                            <CategoryIcon id={c.id} size={20} />
                          </div>
                          <span className="text-[10px] font-medium text-muted-foreground text-center max-w-[56px] truncate">
                            {t(`cat_${c.id}`) || c.id}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="pt-3 space-y-2">
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full bg-foreground text-background font-bold py-4 rounded-2xl shadow-lg hover:opacity-95 active:scale-[0.99] transition-all text-sm cursor-pointer disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save changes'}
                  </button>

                  {isEditing && (
                    confirmDelete ? (
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={handleDelete}
                          disabled={saving}
                          className="flex-1 bg-rose-500 text-white font-semibold py-2.5 rounded-xl text-xs hover:bg-rose-600 transition-colors"
                        >
                          {t('sub_confirm_delete')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(false)}
                          className="flex-1 bg-muted text-muted-foreground font-semibold py-2.5 rounded-xl text-xs hover:text-foreground transition-colors"
                        >
                          {t('cancel')}
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(true)}
                        className="text-sm font-medium text-rose-500 hover:opacity-80 py-2 w-full text-center transition-opacity cursor-pointer block"
                      >
                        {t('sub_delete_title')}
                      </button>
                    )
                  )}
                </div>
              </div>
      </Sheet>

      <CurrencySheet
        open={pickCurrency}
        onClose={() => setPickCurrency(false)}
        value={currency}
        onSelect={(code) => setCurrency(code)}
        zIndex={70}
      />
    </>
  )
}

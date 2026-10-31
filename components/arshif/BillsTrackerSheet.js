'use client'
import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, Receipt, Info, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useApp } from './context'
import { Sheet, TextInput, Field, PrimaryButton, DatePickerInput, Switch } from './ui'
import SwipeBillRow from './SwipeBillRow'
import { CATEGORIES } from '@/lib/categories'
import { roundMoney } from '@/lib/currencies'
import { applyTxToBalances } from '@/lib/ledger'
import { convert, getRate } from '@/lib/rates'
import { cn } from '@/lib/utils'
import { sanitizeAmount } from '@/lib/amount'

const LOCALE = { en: 'en-GB', tr: 'tr-TR', ms: 'ms-MY', id: 'id-ID' }
const monthKeyOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
const EXPENSE_CATS = CATEGORIES.filter((c) => c.types?.includes('expense'))

export default function BillsTrackerSheet({ open, onClose }) {
  const {
    t,
    fmt,
    home,
    accounts = [],
    transactions = [],
    store,
    lang,
    convertToHome,
    refresh,
    user,
    session,
    addTransaction,
    deleteTransaction,
    rates,
  } = useApp()
  const [bills, setBills] = useState([])
  const [month, setMonth] = useState(new Date())
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [syncedAlert, setSyncedAlert] = useState(null)

  // Form tambah tagihan
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [dueDay, setDueDay] = useState('1')
  const [startsFrom, setStartsFrom] = useState('')
  const [endsAfter, setEndsAfter] = useState('')
  const [category, setCategory] = useState('cat_bills')
  const [accountId, setAccountId] = useState(null)
  const [autoLogExpense, setAutoLogExpense] = useState(true)
  const [saving, setSaving] = useState(false)

  // Form edit tagihan
  const [editTitle, setEditTitle] = useState('')
  const [editAmount, setEditAmount] = useState('')
  const [editDueDay, setEditDueDay] = useState('1')
  const [editStartsFrom, setEditStartsFrom] = useState('')
  const [editEndsAfter, setEditEndsAfter] = useState('')
  const [editCategory, setEditCategory] = useState('cat_bills')
  const [editAccountId, setEditAccountId] = useState(null)
  const [editAutoLog, setEditAutoLog] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)

  const load = async () => {
    try {
      const list = await store.listBills()
      setBills(Array.isArray(list) ? list : [])
    } catch {
      setBills([])
    }
    try {
      if (typeof refresh === 'function') await refresh()
    } catch {}
  }

  useEffect(() => {
    if (!open) return
    setMonth(new Date())
    setAdding(false)
    setEditing(null)
    setDeleting(null)
    setSyncedAlert(null)
    load()
  }, [open]) // eslint-disable-line

  const mKey = monthKeyOf(month)
  const monthLabel = useMemo(() => {
    try {
      return month.toLocaleDateString(LOCALE[lang] || 'en-GB', { month: 'long', year: 'numeric' })
    } catch {
      return ''
    }
  }, [month, lang])

  const rows = useMemo(() => {
    return (bills || [])
      .map((b) => ({ ...b, paid: !!(b?.paid_months || {})[mKey] }))
      .sort((a, b) => (Number(a?.due_day) || 0) - (Number(b?.due_day) || 0))
  }, [bills, mKey])

  const toHome = (b) => {
    const raw = Number(b?.amount) || 0
    try {
      const v = convertToHome ? convertToHome(raw, b?.currency || home) : raw
      return typeof v === 'number' && !isNaN(v) ? v : raw
    } catch {
      return raw
    }
  }

  const summary = useMemo(() => {
    let total = 0
    let paid = 0
    let paidCount = 0
    const totalCount = rows.length
    ;(rows || []).forEach((b) => {
      const v = toHome(b)
      total += v
      if (b.paid) {
        paid += v
        paidCount += 1
      }
    })
    const percent = totalCount > 0 ? Math.round((paidCount / totalCount) * 100) : 0
    return { total, paid, remaining: Math.max(0, total - paid), paidCount, totalCount, percent }
  }, [rows]) // eslint-disable-line

  const shiftMonth = (delta) => setMonth((d) => new Date(d.getFullYear(), d.getMonth() + delta, 1))

  const handleTogglePaid = async (b) => {
    if (!b?.id) return
    const isNowPaid = !b.paid
    const pm = { ...(b?.paid_months || {}) }
    const activeMonthKey = mKey // e.g. "2026-09"

    if (isNowPaid) {
      pm[activeMonthKey] = true
    } else {
      delete pm[activeMonthKey]
    }

    // Optimistic UI update
    setBills((list) => (list || []).map((x) => (x.id === b.id ? { ...x, paid_months: pm } : x)))

    try {
      await store.updateBill(b.id, { paid_months: pm })

      if (isNowPaid) {
        const billAmount = Math.abs(Number(b.amount) || 0)

        if (billAmount > 0) {
          const targetAccountId = b.account_id || accounts[0]?.id || null
          const cleanCategory = (b.category || 'bills').replace(/^cat_/, '')

          // Cek duplikasi: berikan penanda agar bisa dilacak & mencegah duplikasi pada bulan aktif
          const isDuplicate = (transactions || []).some((tx) => {
            if (tx.bill_id && tx.bill_id === b.id && tx.billing_month === activeMonthKey) {
              return true
            }
            if (tx.note && (tx.note.includes(b.id) || tx.note.includes(b.title || b.name)) && tx.note.includes(activeMonthKey)) {
              return true
            }
            return false
          })

          if (!isDuplicate) {
            const billTitle = b.name || b.title || 'Tagihan'
            const currentIso = new Date().toISOString()
            const txCurrency = b.currency || home || 'USD'
            const rate = getRate(txCurrency, home, rates)
            const homeAmount = roundMoney(convert(billAmount, txCurrency, home, rates), home)

            const newTransaction = {
              user_id: user?.id || session?.user?.id || null,
              account_id: targetAccountId,
              amount: billAmount,
              type: 'expense',
              currency: txCurrency,
              home_currency: home,
              home_currency_amount: homeAmount,
              rate: rate,
              category: cleanCategory,
              payment_method: b.payment_method || 'bank',
              description: `${t('bill_payment_prefix', 'Pembayaran Tagihan')}: ${billTitle}`,
              merchant: billTitle,
              transaction_date: currentIso,
              bill_id: b.id,
              billing_month: activeMonthKey,
              note: `${t('bill_payment_prefix', 'Pembayaran Tagihan')}: ${billTitle}`,
              date: currentIso,
            }

            try {
              if (typeof addTransaction === 'function') {
                await addTransaction(newTransaction)
              } else if (store?.createTransaction) {
                const created = await store.createTransaction(newTransaction)
                if (targetAccountId) {
                  try {
                    await applyTxToBalances(store, accounts, newTransaction, 1, rates)
                  } catch (balErr) {
                    // Balance write failed: remove the created transaction and
                    // restore the bill to unpaid so the ledger stays consistent.
                    console.warn('Balance apply error:', balErr)
                    try { await store.deleteTransaction(created?.id || newTransaction.id) } catch {}
                    try {
                      const revertedPm = { ...(b.paid_months || {}) }
                      delete revertedPm[activeMonthKey]
                      await store.updateBill(b.id, { paid_months: revertedPm })
                    } catch {}
                    setBills((list) => (list || []).map((x) => (x.id === b.id ? { ...x, paid_months: revertedPm } : x)))
                    toast.error(t('bill_paid_failed', 'Tagihan ditandai lunas gagal: saldo tidak dapat diperbarui'))
                    return
                  }
                }
                if (typeof refresh === 'function') await refresh()
              }
              toast.success(t('bill_paid_logged') || 'Tagihan lunas & pengeluaran dicatat')
            } catch (txErr) {
              // Marking paid failed at the transaction level: undo the paid flag
              // so the tracker does not show a payment that was never recorded.
              console.warn('Auto log bill payment transaction error:', txErr)
              try {
                const revertedPm = { ...(b.paid_months || {}) }
                delete revertedPm[activeMonthKey]
                await store.updateBill(b.id, { paid_months: revertedPm })
                setBills((list) => (list || []).map((x) => (x.id === b.id ? { ...x, paid_months: revertedPm } : x)))
              } catch (revertBillErr) {
                console.warn('Auto log bill payment revert failed:', revertBillErr)
              }
              toast.error(t('bill_paid_failed', 'Transaksi gagal dibuat, status tagihan dikembalikan'))
              return
            }
          }
        }
      } else {
        // Ketika di-uncheck (status berubah dari paid -> unpaid), cari dan revert transaksi & saldo terkait
        const linkedTx = (transactions || []).find((tx) =>
          (tx.bill_id && tx.bill_id === b.id && tx.billing_month === activeMonthKey) ||
          (tx.note && (tx.note.includes(b.id) || tx.note.includes(b.title || b.name)) && tx.note.includes(activeMonthKey))
        )
        if (linkedTx) {
          try {
            if (typeof deleteTransaction === 'function') {
              await deleteTransaction(linkedTx)
            } else if (store?.deleteTransaction) {
              await store.deleteTransaction(linkedTx.id)
              if (linkedTx.account_id) {
                try {
                  await applyTxToBalances(store, accounts, linkedTx, -1, rates)
                } catch (revertBalErr) {
                  console.warn('Balance revert error:', revertBalErr)
                  toast.error(t('bill_unpaid_failed', 'Pembayaran dibatalkan gagal: saldo tidak dapat dipulihkan'))
                }
              }
              if (typeof refresh === 'function') await refresh()
            }
          } catch (revertErr) {
            console.warn('Revert bill payment transaction error:', revertErr)
          }
        }
      }
      await load()
    } catch (e) {
      toast.error(e?.message || t('error'))
      load()
    }
  }

  const toggleBill = handleTogglePaid
  const toggle = handleTogglePaid

  const openAdd = () => {
    setTitle('')
    setAmount('')
    setDueDay('1')
    setStartsFrom('')
    setEndsAfter('')
    setCategory('cat_bills')
    setAccountId(accounts[0]?.id || null)
    setAutoLogExpense(true)
    setAdding(true)
  }

  const saveBill = async () => {
    if (!title.trim() || !Number(amount) || saving) return
    setSaving(true)
    try {
      await store.createBill({
        title: title.trim(),
        name: title.trim(),
        amount: roundMoney(Number(amount), home),
        currency: home,
        due_day: Math.min(31, Math.max(1, Number(dueDay) || 1)),
        starts_from: startsFrom || null,
        ends_after: endsAfter || null,
        category,
        account_id: accountId,
        auto_log_expense: autoLogExpense,
      })
      await load()
      setAdding(false)
      toast.success(t('saved_msg'))
    } catch (e) {
      toast.error(e?.message || t('error'))
    } finally {
      setSaving(false)
    }
  }

  const openEdit = (b) => {
    setEditing(b)
    setEditTitle(b.title || b.name || '')
    setEditAmount(String(b.amount || ''))
    setEditDueDay(String(b.due_day || '1'))
    setEditStartsFrom(b.starts_from || '')
    setEditEndsAfter(b.ends_after || '')
    setEditCategory(b.category || 'cat_bills')
    setEditAccountId(b.account_id || null)
    setEditAutoLog(!!b.auto_log_expense)
  }

  const saveEditBill = async () => {
    if (!editTitle.trim() || !Number(editAmount) || savingEdit || !editing) return
    setSavingEdit(true)
    try {
      await store.updateBill(editing.id, {
        title: editTitle.trim(),
        name: editTitle.trim(),
        amount: roundMoney(Number(editAmount), home),
        currency: editing.currency || home,
        due_day: Math.min(31, Math.max(1, Number(editDueDay) || 1)),
        starts_from: editStartsFrom || null,
        ends_after: editEndsAfter || null,
        category: editCategory,
        account_id: editAccountId,
        auto_log_expense: editAutoLog,
      })
      await load()
      setEditing(null)
      toast.success(t('saved_msg'))
    } catch (e) {
      toast.error(e?.message || t('error'))
    } finally {
      setSavingEdit(false)
    }
  }

  const requestDelete = (b) => {
    if (b.is_subscription_mirror) {
      setSyncedAlert(b)
      return
    }
    setDeleting(b)
  }

  const executeDelete = async () => {
    if (!deleting) return
    const id = deleting.id
    setBills((list) => (list || []).filter((x) => x.id !== id))
    setDeleting(null)
    try {
      await store.deleteBill(id)
      toast.success(t('deleted'))
      try { if (typeof refresh === 'function') await refresh() } catch {}
    } catch (e) {
      toast.error(e?.message || t('error'))
      load()
    }
  }

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        full
        left={
          <button
            type="button"
            onClick={onClose}
            className="text-[15px] font-semibold text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white transition-colors cursor-pointer"
          >
            {t('done')}
          </button>
        }
        title={
          <div className="leading-tight text-center">
            <div className="text-base font-bold text-zinc-950 dark:text-white">{t('bills')}</div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400 font-normal">
              {t('bills_checklist_subtitle')}
            </div>
          </div>
        }
        right={
          <button
            type="button"
            onClick={openAdd}
            className="w-9 h-9 rounded-full bg-foreground text-background flex items-center justify-center hover:opacity-90 active:scale-95 transition-all cursor-pointer shadow-xs"
            aria-label={t('add_bill') || 'Add Bill'}
            title={t('add_bill') || 'Add Bill'}
            data-testid="bills-add"
          >
            <Plus size={20} strokeWidth={2.5} />
          </button>
        }
      >
        {/* Month Selector */}
        <div className="rounded-2xl bg-zinc-100/90 dark:bg-zinc-800/60 p-3 px-4 flex items-center justify-between mt-2 border border-zinc-200/50 dark:border-white/5">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            className="h-9 w-9 rounded-full bg-white dark:bg-zinc-700/80 text-zinc-700 dark:text-zinc-200 shadow-sm flex items-center justify-center transition-all active:scale-95 hover:bg-zinc-50 cursor-pointer"
            aria-label="previous month"
            data-testid="bills-prev"
          >
            <ChevronLeft size={18} />
          </button>
          <span
            className="text-emerald-500 dark:text-emerald-400 font-bold text-base tracking-tight capitalize select-none"
            data-testid="bills-month"
          >
            {monthLabel}
          </span>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            className="h-9 w-9 rounded-full bg-white dark:bg-zinc-700/80 text-zinc-700 dark:text-zinc-200 shadow-sm flex items-center justify-center transition-all active:scale-95 hover:bg-zinc-50 cursor-pointer"
            aria-label="next month"
            data-testid="bills-next"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Monthly Summary Card */}
        <div className="mt-4 rounded-3xl bg-zinc-950 text-white p-5 border border-white/10 shadow-xl relative overflow-hidden dark:bg-[#141416]">

          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
            {t('remaining_this_month')}
          </p>
          <p
            className={cn(
              "text-2xl sm:text-3xl tabular-nums mt-0.5 tracking-tight",
              summary.remaining === 0 ? "text-emerald-500 font-extrabold" : "text-white font-extrabold"
            )}
            data-testid="bills-remaining"
          >
            {fmt(summary.remaining, home)}
          </p>

          {/* Progress Indicator */}
          <div className="mt-3">
            <div className="flex items-center justify-between text-[11px] font-medium text-zinc-400">
              <span>{t('bills_count_of', { paid: summary.paidCount, total: summary.totalCount })}</span>
              <span className="tabular-nums font-semibold text-emerald-400">{summary.percent}%</span>
            </div>
            <div className="h-1.5 sm:h-2 rounded-full bg-white/10 mt-1.5 overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                style={{ width: `${summary.percent}%` }}
              />
            </div>
          </div>

          {/* Bottom 2-column breakdown */}
          <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-white/10">
            <div className="rounded-2xl bg-white/[0.06] p-3 border border-white/5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                {t('paid_upper')}
              </p>
              <p
                className="text-emerald-400 font-bold text-sm sm:text-base tabular-nums mt-0.5 truncate"
                data-testid="bills-paid"
              >
                {fmt(summary.paid, home)}
              </p>
            </div>
            <div className="rounded-2xl bg-white/[0.06] p-3 border border-white/5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                {t('total_upper')}
              </p>
              <p
                className="text-white font-bold text-sm sm:text-base tabular-nums mt-0.5 truncate"
                data-testid="bills-total"
              >
                {fmt(summary.total, home)}
              </p>
            </div>
          </div>
        </div>

        {/* Bills List / Empty State */}
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <div className="h-16 w-16 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-3 text-zinc-400 dark:text-zinc-500">
              <Receipt size={28} />
            </div>
            <p className="font-bold text-zinc-950 dark:text-white text-base">
              {t('no_bills_title')}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-[260px] leading-relaxed">
              {t('no_bills_sub')}
            </p>
            <button
              type="button"
              onClick={openAdd}
              className="mt-4 rounded-xl bg-emerald-600 text-white font-bold px-5 py-2.5 text-sm active:scale-95 transition-all shadow-sm flex items-center gap-2 hover:bg-emerald-700 cursor-pointer"
              data-testid="bills-add-first"
            >
              <Plus size={16} />
              {t('add_bill')}
            </button>
          </div>
        ) : (
          <div className="mt-4 space-y-1">
            {rows.map((b) => (
              <SwipeBillRow
                key={b.id}
                bill={b}
                isPaid={!!b.paid}
                isMirror={!!b.is_subscription_mirror}
                home={home}
                fmt={fmt}
                t={t}
                onToggle={toggle}
                onEdit={openEdit}
                onDelete={requestDelete}
                onShowSyncedAlert={setSyncedAlert}
              />
            ))}
          </div>
        )}
        <div className="h-6" />
      </Sheet>

      {/* Synced Subscription Alert Modal */}
      {syncedAlert && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-[#1c1c1e] border border-zinc-200 dark:border-white/10 p-6 shadow-2xl text-center space-y-4">
            <div className="h-14 w-14 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
              <Info size={28} />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-950 dark:text-white">
                {t('synced_subscription_title')}
              </h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-2 leading-relaxed">
                {t('synced_subscription_desc')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSyncedAlert(null)}
              className="w-full rounded-xl bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 font-bold py-2.5 text-sm transition-all active:scale-95 cursor-pointer"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleting && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-[#1c1c1e] border border-zinc-200 dark:border-white/10 p-6 shadow-2xl text-center space-y-4">
            <div className="h-14 w-14 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 mx-auto flex items-center justify-center">
              <Trash2 size={28} />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-950 dark:text-white">
                {t('clear_confirm_title')}
              </h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-2 leading-relaxed">
                {deleting?.title ? `"${deleting.title}" - ` : ''}{t('clear_confirm_body')}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setDeleting(null)}
                className="w-full rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-bold py-2.5 text-sm transition-all active:scale-95 cursor-pointer"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={executeDelete}
                className="w-full rounded-xl bg-rose-600 text-white font-bold py-2.5 text-sm transition-all active:scale-95 cursor-pointer hover:bg-rose-700"
              >
                {t('delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Bill Form Sheet */}
      <Sheet
        open={adding}
        onClose={() => setAdding(false)}
        title={t('new_bill')}
        zIndex={70}
        left={
          <button
            type="button"
            onClick={() => setAdding(false)}
            className="text-sm font-semibold text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white transition-colors cursor-pointer"
          >
            {t('cancel')}
          </button>
        }
        right={
          <button
            type="button"
            onClick={saveBill}
            disabled={!title.trim() || !Number(amount) || saving}
            className={cn(
              'text-[15px] font-bold py-1 px-1 text-emerald-600 dark:text-emerald-400 cursor-pointer',
              (!title.trim() || !Number(amount) || saving) && 'opacity-40 cursor-not-allowed'
            )}
            data-testid="bill-save"
          >
            {saving ? '...' : t('save')}
          </button>
        }
      >
        <div className="space-y-5 pt-2">
          <Field label={t('bill_title')}>
            <TextInput
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('bill_title_ph')}
              data-testid="bill-title"
            />
          </Field>

          <Field label={`${t('amount')} (${home})`}>
            <TextInput
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(sanitizeAmount(e.target.value))}
              placeholder="0"
              className="text-lg font-bold"
              data-testid="bill-amount"
            />
          </Field>

          <Field label={t('due_day_of_month')}>
            <TextInput
              type="number"
              inputMode="numeric"
              min="1"
              max="31"
              value={dueDay}
              onChange={(e) => setDueDay(e.target.value)}
              placeholder="1"
              data-testid="bill-due"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <DatePickerInput
              label="Mulai Dari (Opsional)"
              value={startsFrom}
              onChange={setStartsFrom}
              clearable
            />
            <DatePickerInput
              label="Berakhir Setelah (Opsional)"
              value={endsAfter}
              onChange={setEndsAfter}
              clearable
            />
          </div>

          <Field label={t('category')}>
            <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5">
              {EXPENSE_CATS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategory(c.id)}
                  className={cn(
                    'shrink-0 rounded-xl border px-3.5 py-2 text-sm font-semibold whitespace-nowrap transition-colors cursor-pointer',
                    category === c.id
                      ? 'bg-zinc-950 text-white border-zinc-950 dark:bg-white dark:text-zinc-950 dark:border-white'
                      : 'bg-white dark:bg-[#1c1c1e] border-zinc-200 dark:border-white/10 text-zinc-950 dark:text-white'
                  )}
                  data-testid={`bill-cat-${c.id}`}
                >
                  {t(`cat_${c.id}`)}
                </button>
              ))}
            </div>
          </Field>

          <Field label={t('source_account')}>
            <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5">
              <button
                type="button"
                onClick={() => setAccountId(null)}
                className={cn(
                  'shrink-0 rounded-xl border px-3.5 py-2 text-sm font-semibold whitespace-nowrap cursor-pointer',
                  accountId === null
                    ? 'bg-zinc-950 text-white border-zinc-950 dark:bg-white dark:text-zinc-950 dark:border-white'
                    : 'bg-white dark:bg-[#1c1c1e] border-zinc-200 dark:border-white/10 text-zinc-950 dark:text-white'
                )}
              >
                {t('no_account_opt')}
              </button>
              {(accounts || []).map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setAccountId(a.id)}
                  className={cn(
                    'shrink-0 rounded-xl border px-3.5 py-2 text-sm font-semibold whitespace-nowrap cursor-pointer',
                    accountId === a.id
                      ? 'bg-zinc-950 text-white border-zinc-950 dark:bg-white dark:text-zinc-950 dark:border-white'
                      : 'bg-white dark:bg-[#1c1c1e] border-zinc-200 dark:border-white/10 text-zinc-950 dark:text-white'
                  )}
                >
                  {a.name}
                </button>
              ))}
            </div>
          </Field>

          {/* Auto-log expense toggle switch */}
          <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-zinc-950 dark:text-white">
                  {t('auto_log_expense')}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  {t('auto_log_expense_sub')}
                </p>
              </div>
              <Switch checked={autoLogExpense} onChange={setAutoLogExpense} />
            </div>
          </div>

          <PrimaryButton onClick={saveBill} disabled={!title.trim() || !Number(amount) || saving}>
            {saving ? '...' : t('save')}
          </PrimaryButton>
        </div>
      </Sheet>

      {/* Edit Bill Form Sheet */}
      <Sheet
        open={!!editing}
        onClose={() => setEditing(null)}
        title={t('edit') || 'Edit Bill'}
        zIndex={70}
        left={
          <button
            type="button"
            onClick={() => setEditing(null)}
            className="text-sm font-semibold text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white transition-colors cursor-pointer"
          >
            {t('cancel')}
          </button>
        }
        right={
          <button
            type="button"
            onClick={saveEditBill}
            disabled={!editTitle.trim() || !Number(editAmount) || savingEdit}
            className={cn(
              'text-[15px] font-bold py-1 px-1 text-emerald-600 dark:text-emerald-400 cursor-pointer',
              (!editTitle.trim() || !Number(editAmount) || savingEdit) && 'opacity-40 cursor-not-allowed'
            )}
            data-testid="bill-edit-save"
          >
            {savingEdit ? '...' : t('save')}
          </button>
        }
      >
        <div className="space-y-5 pt-2">
          <Field label={t('bill_title')}>
            <TextInput
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder={t('bill_title_ph')}
              data-testid="edit-bill-title"
            />
          </Field>

          <Field label={`${t('amount')} (${home})`}>
            <TextInput
              type="text"
              inputMode="decimal"
              value={editAmount}
              onChange={(e) => setEditAmount(sanitizeAmount(e.target.value))}
              placeholder="0"
              className="text-lg font-bold"
              data-testid="edit-bill-amount"
            />
          </Field>

          <Field label={t('due_day_of_month')}>
            <TextInput
              type="number"
              inputMode="numeric"
              min="1"
              max="31"
              value={editDueDay}
              onChange={(e) => setEditDueDay(e.target.value)}
              placeholder="1"
              data-testid="edit-bill-due"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <DatePickerInput
              label="Mulai Dari (Opsional)"
              value={editStartsFrom}
              onChange={setEditStartsFrom}
              clearable
            />
            <DatePickerInput
              label="Berakhir Setelah (Opsional)"
              value={editEndsAfter}
              onChange={setEditEndsAfter}
              clearable
            />
          </div>

          <Field label={t('category')}>
            <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5">
              {EXPENSE_CATS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setEditCategory(c.id)}
                  className={cn(
                    'shrink-0 rounded-xl border px-3.5 py-2 text-sm font-semibold whitespace-nowrap transition-colors cursor-pointer',
                    editCategory === c.id
                      ? 'bg-zinc-950 text-white border-zinc-950 dark:bg-white dark:text-zinc-950 dark:border-white'
                      : 'bg-white dark:bg-[#1c1c1e] border-zinc-200 dark:border-white/10 text-zinc-950 dark:text-white'
                  )}
                >
                  {t(`cat_${c.id}`)}
                </button>
              ))}
            </div>
          </Field>

          <Field label={t('source_account')}>
            <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5">
              <button
                type="button"
                onClick={() => setEditAccountId(null)}
                className={cn(
                  'shrink-0 rounded-xl border px-3.5 py-2 text-sm font-semibold whitespace-nowrap cursor-pointer',
                  editAccountId === null
                    ? 'bg-zinc-950 text-white border-zinc-950 dark:bg-white dark:text-zinc-950 dark:border-white'
                    : 'bg-white dark:bg-[#1c1c1e] border-zinc-200 dark:border-white/10 text-zinc-950 dark:text-white'
                )}
              >
                {t('no_account_opt')}
              </button>
              {(accounts || []).map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setEditAccountId(a.id)}
                  className={cn(
                    'shrink-0 rounded-xl border px-3.5 py-2 text-sm font-semibold whitespace-nowrap cursor-pointer',
                    editAccountId === a.id
                      ? 'bg-zinc-950 text-white border-zinc-950 dark:bg-white dark:text-zinc-950 dark:border-white'
                      : 'bg-white dark:bg-[#1c1c1e] border-zinc-200 dark:border-white/10 text-zinc-950 dark:text-white'
                  )}
                >
                  {a.name}
                </button>
              ))}
            </div>
          </Field>

          {/* Auto-log expense toggle switch */}
          <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-zinc-950 dark:text-white">
                  {t('auto_log_expense')}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  {t('auto_log_expense_sub')}
                </p>
              </div>
              <Switch checked={editAutoLog} onChange={setEditAutoLog} />
            </div>
          </div>

          <PrimaryButton onClick={saveEditBill} disabled={!editTitle.trim() || !Number(editAmount) || savingEdit}>
            {savingEdit ? '...' : t('save')}
          </PrimaryButton>
        </div>
      </Sheet>
    </>
  )
}
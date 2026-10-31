'use client'
import { useEffect, useMemo, useState } from 'react'
import { ChevronRight, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { useApp } from './context'
import { Sheet, TextInput, Field, Segmented } from './ui'
import CurrencySheet from './CurrencySheet'
import { getCurrency, roundMoney } from '@/lib/currencies'
import { cn } from '@/lib/utils'
import { sanitizeAmount } from '@/lib/amount'

const n = (v) => Number(v) || 0

export default function LoanCalculatorSheet({ open, onClose }) {
  const { t, home, fmt, store } = useApp()
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState(home)
  const [rate, setRate] = useState('')
  const [tenure, setTenure] = useState('')
  const [unit, setUnit] = useState('months')
  const [method, setMethod] = useState('flat')
  const [pickCur, setPickCur] = useState(false)

  useEffect(() => {
    if (!open) return
    setAmount(''); setCurrency(home); setRate(''); setTenure(''); setUnit('months'); setMethod('flat')
  }, [open]) // eslint-disable-line

  const result = useMemo(() => {
    const P = n(amount)
    const annual = n(rate)
    const months = unit === 'years' ? n(tenure) * 12 : n(tenure)
    if (P <= 0 || months <= 0) return { monthly: 0, interest: 0, total: 0 }
    let monthly = 0, total = 0, interest = 0
    if (method === 'flat') {
      interest = P * (annual / 100) * (months / 12)
      total = P + interest
      monthly = total / months
    } else {
      const r = annual / 100 / 12
      if (r === 0) { monthly = P / months }
      else { const f = Math.pow(1 + r, months); monthly = (P * r * f) / (f - 1) }
      total = monthly * months
      interest = total - P
    }
    const safe = (x) => (isFinite(x) && !isNaN(x) ? x : 0)
    return { monthly: safe(monthly), interest: safe(interest), total: safe(total) }
  }, [amount, rate, tenure, unit, method])

  const addToBills = async () => {
    if (result.monthly <= 0) { toast.error(t('error')); return }
    try {
      await store.createBill({ title: 'Loan installment', amount: roundMoney(result.monthly, currency), currency, due_day: 1, category: 'bills', account_id: null })
      toast.success(t('saved_msg'))
    } catch (e) { toast.error(e?.message || t('error')) }
  }

  return (
    <>
      <Sheet open={open} onClose={onClose} full title={t('loan_calculator')}>
        <div className="space-y-5 pt-2">
          <Field label={t('loan_amount') || 'Loan amount'}>
            <div className="flex gap-2">
              <button type="button" onClick={() => setPickCur(true)} className="shrink-0 rounded-xl bg-muted border border-border/60 px-3 py-3 flex items-center gap-1.5" data-testid="loan-currency">
                <span className="font-bold text-sm">{getCurrency(currency).symbol} {currency}</span>
                <ChevronRight size={15} className="text-muted-foreground" />
              </button>
              <TextInput type="text" inputMode="decimal" value={amount} onChange={(e) => setAmount(sanitizeAmount(e.target.value))} placeholder="0" className="flex-1 text-lg font-bold" data-testid="loan-amount" />
            </div>
          </Field>

          <Field label={t('interest_rate') || 'Interest rate (% per year)'}>
            <TextInput type="text" inputMode="decimal" value={rate} onChange={(e) => setRate(sanitizeAmount(e.target.value))} placeholder="e.g. 3.5" data-testid="loan-rate" />
          </Field>

          <Field label={t('loan_tenure') || 'Loan tenure'}>
            <div className="flex gap-2">
              <TextInput type="number" inputMode="numeric" value={tenure} onChange={(e) => setTenure(e.target.value)} placeholder="0" className="flex-1" data-testid="loan-tenure" />
              <Segmented size="sm" className="w-40 shrink-0" value={unit} onChange={setUnit} options={[{ id: 'months', label: t('loan_months') || 'Months' }, { id: 'years', label: t('loan_years') || 'Years' }]} />
            </div>
          </Field>

          <Field label={t('calc_type') || 'Interest calculation type'}>
            <Segmented value={method} onChange={setMethod} options={[{ id: 'flat', label: t('flat_rate') || 'Flat' }, { id: 'reducing', label: t('reducing_balance') || 'Menurun' }]} />
          </Field>

          {/* Output */}
          <div className="rounded-2xl bg-foreground text-background p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] opacity-60">{t('loan_monthly')}</p>
            <p className="text-2xl font-extrabold tabular-nums mt-1" data-testid="loan-monthly">{fmt(result.monthly, currency)}</p>
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="rounded-xl bg-background/10 px-3 py-2.5">
                <p className="text-[11px] uppercase tracking-wide opacity-60">{t('loan_interest')}</p>
                <p className="font-bold tabular-nums mt-0.5" data-testid="loan-interest">{fmt(result.interest, currency)}</p>
              </div>
              <div className="rounded-xl bg-background/10 px-3 py-2.5">
                <p className="text-[11px] uppercase tracking-wide opacity-60">{t('loan_total')}</p>
                <p className="font-bold tabular-nums mt-0.5" data-testid="loan-total">{fmt(result.total, currency)}</p>
              </div>
            </div>
          </div>

          <button type="button" onClick={addToBills} disabled={result.monthly <= 0}
            className={cn('w-full rounded-xl bg-muted border border-border/60 font-semibold py-3.5 text-[15px] flex items-center justify-center gap-2 active:scale-[0.98] transition', result.monthly <= 0 && 'opacity-40')}
            data-testid="loan-add-bill">
                  {t('loancalc_add_bills')}
          </button>
          <div className="h-4" />
        </div>
      </Sheet>
      <CurrencySheet open={pickCur} onClose={() => setPickCur(false)} value={currency} onSelect={setCurrency} zIndex={70} />
    </>
  )
}
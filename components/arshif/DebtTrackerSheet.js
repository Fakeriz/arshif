'use client'
import { useEffect, useMemo, useState } from 'react'
import { ChevronRight, Plus, Check, Share2, HandCoins } from 'lucide-react'
import { toast } from 'sonner'
import { useApp } from './context'
import { Sheet, Segmented, TextInput, Field, DatePickerInput } from './ui'
import CurrencySheet from './CurrencySheet'
import { getCurrency, roundMoney } from '@/lib/currencies'
import { cn } from '@/lib/utils'
import { sanitizeAmount } from '@/lib/amount'

const safeDate = (s) => {
  if (!s) return null
  try { const d = new Date(s); return isNaN(d.getTime()) ? null : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) } catch { return null }
}

export default function DebtTrackerSheet({ open, onClose }) {
  const { t, home, fmt, accounts = [], store, convertToHome } = useApp()
  const [debts, setDebts] = useState([])
  const [filter, setFilter] = useState('lent')
  const [adding, setAdding] = useState(false)
  const [pickCur, setPickCur] = useState(false)

  // form
  const [direction, setDirection] = useState('lent')
  const [person, setPerson] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState(home)
  const [due, setDue] = useState('')
  const [note, setNote] = useState('')
  const [accountId, setAccountId] = useState(null)

  const load = async () => { try { setDebts((await store.listDebts()) || []) } catch { setDebts([]) } }
  useEffect(() => {
    if (!open) return
    setFilter('lent'); setAdding(false)
    load()
  }, [open]) // eslint-disable-line

  const toHome = (d) => {
    const raw = Number(d?.amount) || 0
    try { const v = convertToHome ? convertToHome(raw, d?.currency || home) : raw; return isFinite(v) && !isNaN(v) ? v : raw } catch { return raw }
  }
  const summary = useMemo(() => {
    let owed = 0, owe = 0
    ;(debts || []).forEach((d) => {
      if (d?.settled) return
      const v = toHome(d)
      if (d?.direction === 'lent') owed += v; else owe += v
    })
    return { owed, owe, net: owed - owe }
  }, [debts]) // eslint-disable-line

  const list = (debts || []).filter((d) => {
    if (filter === 'settled') return !!d?.settled
    return !d?.settled && d?.direction === filter
  })

  const openAdd = () => {
    setDirection('lent'); setPerson(''); setAmount(''); setCurrency(home); setDue(''); setNote(''); setAccountId(accounts[0]?.id || null); setAdding(true)
  }
  const save = async () => {
    if (!person.trim() || !(Number(amount) || 0)) return
    try {
      await store.createDebt({ direction, person: person.trim(), amount: roundMoney(Number(amount), currency), currency, due_date: due || null, note: note.trim(), account_id: accountId, settled: false })
      setAdding(false); await load(); toast.success(t('saved_msg'))
    } catch (e) { toast.error(e?.message || t('error')) }
  }
  const settle = async (d) => {
    setDebts((l) => (l || []).map((x) => (x.id === d.id ? { ...x, settled: true } : x)))
    try { await store.updateDebt(d.id, { settled: true }); await load() } catch (e) { toast.error(e?.message || t('error')); load() }
  }
  const remind = async (d) => {
    const amt = fmt(d?.amount, d?.currency || home)
    const msg = d?.direction === 'lent'
      ? `Hi ${d?.person}, just a friendly reminder about the ${amt} I lent you${d?.due_date ? ` (due ${safeDate(d.due_date)})` : ''}. Thank you!`
      : `Hi ${d?.person}, reminder that I owe you ${amt}${d?.due_date ? ` (due ${safeDate(d.due_date)})` : ''}. I'll settle it soon!`
    try { await navigator.clipboard.writeText(msg); toast.success('Reminder copied') } catch { toast(msg) }
  }

  return (
    <>
      <Sheet open={open} onClose={onClose} full title={t('debt_tracker')}
        right={<button type="button" onClick={openAdd} className="h-11 w-11 rounded-full bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 flex items-center justify-center font-bold" data-testid="debt-add"><Plus size={18} /></button>}>
        {/* Summary */}
        <div className="mt-1 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 p-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-zinc-600 dark:text-zinc-400 font-semibold">I Am Owed</p>
              <p className="text-lg font-extrabold tabular-nums text-emerald-600 dark:text-emerald-400 mt-0.5" data-testid="debt-owed">{fmt(summary.owed, home)}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-zinc-600 dark:text-zinc-400 font-semibold">I Owe</p>
              <p className="text-lg font-extrabold tabular-nums text-rose-600 dark:text-rose-400 mt-0.5" data-testid="debt-owe">{fmt(summary.owe, home)}</p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-white/10 flex items-center justify-between">
            <span className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">{t('debt_net_position')}</span>
            <span className={cn('text-sm font-bold tabular-nums', summary.net >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')} data-testid="debt-net">
              {summary.net >= 0 ? '+' : '-'}{fmt(Math.abs(summary.net), home)}
            </span>
          </div>
        </div>

        <Segmented className="mt-4" size="sm" value={filter} onChange={setFilter}
          options={[{ id: 'lent', label: t('debt_owe_me') || 'Owe Me' }, { id: 'borrowed', label: t('debt_i_owe') || 'I Owe' }, { id: 'settled', label: t('debt_settled') || 'Settled' }]} />

        <div className="mt-4 space-y-2.5">
          {list.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="h-14 w-14 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-3 text-zinc-400 dark:text-zinc-500"><HandCoins size={24} strokeWidth={1.5} /></div>
              <p className="font-bold text-zinc-950 dark:text-white">{t('debt_empty_title')}</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">{t('debt_empty_sub')}</p>
            </div>
          ) : list.map((d) => (
            <div key={d.id} className="rounded-2xl bg-white dark:bg-[#1c1c1e] border border-zinc-200 dark:border-white/10 p-4" data-testid="debt-row">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold text-[15px] truncate text-zinc-950 dark:text-white">{d?.person}</p>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">{d?.direction === 'lent' ? t('debt_lent') || 'Lent' : t('debt_borrowed') || 'Borrowed'}{d?.due_date ? ` · due ${safeDate(d.due_date)}` : ''}{d?.note ? ` · ${d.note}` : ''}</p>
                </div>
                <p className={cn('font-bold tabular-nums text-[15px] shrink-0', d?.direction === 'lent' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>{fmt(d?.amount, d?.currency || home)}</p>
              </div>
              {!d?.settled ? (
                <div className="flex gap-2 mt-3">
                  <button type="button" onClick={() => settle(d)} className="flex-1 rounded-xl bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 text-sm font-bold py-2 flex items-center justify-center gap-1.5 transition-colors" data-testid="debt-settle"><Check size={15} /> {t('debt_mark_paid') || 'Mark as Paid'}</button>
                  <button type="button" onClick={() => remind(d)} className="rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 text-zinc-950 dark:text-white text-sm font-bold py-2 px-3 flex items-center justify-center gap-1.5 transition-colors" data-testid="debt-remind"><Share2 size={15} /> {t('debt_remind') || 'Remind'}</button>
                </div>
              ) : (
                <p className="mt-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1"><Check size={13} /> {t('debt_settled_badge') || 'Settled'}</p>
              )}
            </div>
          ))}
        </div>
        <div className="h-6" />
      </Sheet>

      {/* Add debt */}
      <Sheet open={adding} onClose={() => setAdding(false)} title={t('debt_add_title') || 'Add Debt / IOU'} zIndex={70}
        left={<button type="button" onClick={() => setAdding(false)} className="text-sm font-semibold text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white transition-colors">{t('cancel')}</button>}
        right={<button type="button" onClick={save} disabled={!person.trim() || !(Number(amount) || 0)} className={cn('text-[15px] font-bold py-1 px-1 text-zinc-950 dark:text-white', (!person.trim() || !(Number(amount) || 0)) && 'opacity-40')} data-testid="debt-save">{t('save')}</button>}>
        <div className="space-y-5 pt-2">
          <Segmented value={direction} onChange={setDirection} options={[{ id: 'lent', label: t('debt_lent') || 'Lent' }, { id: 'borrowed', label: t('debt_borrowed') || 'Borrowed' }]} />
          <Field label={t('contact_name') || 'Contact name'}><TextInput value={person} onChange={(e) => setPerson(e.target.value)} placeholder={t('debt_contact_ph') || 'e.g. Budi'} data-testid="debt-person" /></Field>
          <Field label={t('amount') || 'Amount'}>
            <div className="flex gap-2">
              <button type="button" onClick={() => setPickCur(true)} className="shrink-0 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 px-3 py-3 flex items-center gap-1.5 text-zinc-950 dark:text-white" data-testid="debt-currency">
                <span className="font-bold text-sm">{getCurrency(currency).symbol} {currency}</span>
                <ChevronRight size={15} className="text-zinc-500 dark:text-zinc-400" />
              </button>
              <TextInput type="text" inputMode="decimal" value={amount} onChange={(e) => setAmount(sanitizeAmount(e.target.value))} placeholder="0" className="flex-1 text-lg font-bold" data-testid="debt-amount" />
            </div>
          </Field>
          <DatePickerInput label={t('debt_due_date')} value={due} onChange={setDue} data-testid="debt-due" clearable />
          <Field label={t('note') || 'Note'}><TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('optional') || 'Optional'} /></Field>
          <Field label={t('source_account')}>
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              <button type="button" onClick={() => setAccountId(null)} className={cn('shrink-0 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors', accountId === null ? 'bg-zinc-950 text-white border-zinc-950 dark:bg-white dark:text-zinc-950 dark:border-white' : 'bg-white dark:bg-[#1c1c1e] border-zinc-200 dark:border-white/10 text-zinc-950 dark:text-white')}>{t('no_account_opt')}</button>
              {(accounts || []).map((a) => (
                <button key={a.id} type="button" onClick={() => setAccountId(a.id)} className={cn('shrink-0 rounded-xl border px-3 py-2 text-sm font-semibold whitespace-nowrap transition-colors', accountId === a.id ? 'bg-zinc-950 text-white border-zinc-950 dark:bg-white dark:text-zinc-950 dark:border-white' : 'bg-white dark:bg-[#1c1c1e] border-zinc-200 dark:border-white/10 text-zinc-950 dark:text-white')}>{a.name}</button>
              ))}
            </div>
          </Field>
        </div>
      </Sheet>
      <CurrencySheet open={pickCur} onClose={() => setPickCur(false)} value={currency} onSelect={setCurrency} zIndex={80} />
    </>
  )
}
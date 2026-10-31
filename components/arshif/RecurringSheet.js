'use client'
import { useEffect, useState } from 'react'
import { ChevronRight, Plus, Trash2, Repeat } from 'lucide-react'
import { toast } from 'sonner'
import { useApp } from './context'
import { Sheet, TextInput, Field, Segmented, DatePickerInput } from './ui'
import CurrencySheet from './CurrencySheet'
import { getCurrency } from '@/lib/currencies'
import { cn } from '@/lib/utils'
import { sanitizeAmount } from '@/lib/amount'

const LS_KEY = 'arshif_recurring'
const lsGet = () => { try { const v = localStorage.getItem(LS_KEY); return v ? JSON.parse(v) : [] } catch { return [] } }
const lsSet = (v) => { try { localStorage.setItem(LS_KEY, JSON.stringify(v)) } catch {} }
const uid = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `r_${Date.now()}_${Math.random().toString(36).slice(2)}`)

const daysUntil = (s) => {
  if (!s) return null
  try { const d = new Date(s); if (isNaN(d.getTime())) return null; const ms = new Date(d).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0); return Math.round(ms / 86400000) } catch { return null }
}

export default function RecurringSheet({ open, onClose }) {
  const { t, home, fmt, accounts = [] } = useApp()
  const [items, setItems] = useState([])
  const [adding, setAdding] = useState(false)
  const [pickCur, setPickCur] = useState(false)

  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState(home)
  const [freq, setFreq] = useState('monthly')
  const [due, setDue] = useState('')
  const [accountId, setAccountId] = useState(null)

  useEffect(() => {
    if (!open) return
    setItems(lsGet()); setAdding(false)
  }, [open])

  const openAdd = () => { setTitle(''); setAmount(''); setCurrency(home); setFreq('monthly'); setDue(''); setAccountId(accounts[0]?.id || null); setAdding(true) }
  const save = () => {
    if (!title.trim() || !(Number(amount) || 0)) return
    const row = { id: uid(), title: title.trim(), amount: Number(amount) || 0, currency, frequency: freq, next_due: due || null, account_id: accountId, created_at: new Date().toISOString() }
    const next = [...(items || []), row]
    setItems(next); lsSet(next); setAdding(false); toast.success(t('saved_msg'))
  }
  const remove = (id) => { const next = (items || []).filter((x) => x?.id !== id); setItems(next); lsSet(next) }

  const countdown = (s) => {
    const d = daysUntil(s)
    if (d == null) return ''
    if (d < 0) return t('rec_overdue', { days: Math.abs(d) })
    if (d === 0) return t('rec_today')
    if (d === 1) return t('rec_tomorrow')
    return t('rec_in_days', { days: d })
  }
  const freqSuffix = { weekly: t('freq_weekly'), monthly: t('freq_monthly'), yearly: t('freq_yearly') }

  return (
    <>
      <Sheet open={open} onClose={onClose} full title={t('recurring_sheet_title')}
        right={<button type="button" onClick={openAdd} className="text-[15px] font-bold py-1 px-1 flex items-center gap-1 text-zinc-950 dark:text-white" data-testid="recurring-add"><Plus size={16} /> {t('recurring_add_btn')}</button>}>

        <div className="mt-2 space-y-2.5">
          {(items || []).length === 0 && !adding ? (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <div className="h-14 w-14 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-3 text-zinc-400 dark:text-zinc-500"><Repeat size={24} strokeWidth={1.5} /></div>
              <p className="font-bold text-[15px] text-zinc-950 dark:text-white">{t('recurring_empty')}</p>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">{t('recurring_empty_sub')}</p>
              <button type="button" onClick={openAdd} className="mt-4 rounded-xl bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 px-4 py-2.5 font-bold text-sm" data-testid="recurring-empty-add">{t('recurring_add')}</button>
            </div>
          ) : null}

          {(items || []).map((r) => {
            const acc = (accounts || []).find((a) => a?.id === r?.account_id)
            const overdue = (daysUntil(r?.next_due) ?? 1) < 0
            return (
              <div key={r?.id} className="flex items-center gap-3 rounded-2xl bg-white dark:bg-[#1c1c1e] border border-zinc-200 dark:border-white/10 px-4 py-3.5" data-testid="recurring-row">
                <div className="h-10 w-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-900 dark:text-white shrink-0"><Repeat size={18} strokeWidth={1.5} /></div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-[15px] truncate text-zinc-950 dark:text-white">{r?.title}</p>
                  <p className={cn('text-xs mt-0.5', overdue ? 'text-rose-500 dark:text-rose-400 font-semibold' : 'text-zinc-600 dark:text-zinc-400')}>{countdown(r?.next_due)}{acc?.name ? ` · ${acc.name}` : ''}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold tabular-nums text-[15px] text-zinc-950 dark:text-white">{fmt(r?.amount, r?.currency || home)}</p>
                  <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">{freqSuffix[r?.frequency] || ''}</p>
                </div>
                <button type="button" onClick={() => remove(r?.id)} className="h-11 w-11 rounded-lg flex items-center justify-center text-zinc-400 hover:text-rose-500 dark:text-zinc-500 dark:hover:text-rose-400 shrink-0" aria-label={t('delete')}><Trash2 size={15} /></button>
              </div>
            )
          })}
        </div>

        {adding ? (
          <div className="mt-4 rounded-2xl bg-white dark:bg-[#1c1c1e] border border-zinc-200 dark:border-white/10 p-4 space-y-4">
            <Field label={t('recurring_title_label')}><TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('recurring_name_ph')} data-testid="recurring-title" /></Field>
            <Field label={t('amount')}>
              <div className="flex gap-2">
                <button type="button" onClick={() => setPickCur(true)} className="shrink-0 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 px-3 py-3 flex items-center gap-1.5 text-zinc-950 dark:text-white" data-testid="recurring-currency">
                  <span className="font-bold text-sm">{getCurrency(currency).symbol}</span>
                  <ChevronRight size={15} className="text-zinc-500 dark:text-zinc-400" />
                </button>
                <TextInput type="text" inputMode="decimal" value={amount} onChange={(e) => setAmount(sanitizeAmount(e.target.value))} placeholder="0" className="flex-1 text-lg font-bold" data-testid="recurring-amount" />
              </div>
            </Field>
            <Field label={t('frequency')}>
              <Segmented value={freq} onChange={setFreq} options={[{ id: 'weekly', label: t('weekly') }, { id: 'monthly', label: t('monthly') }, { id: 'yearly', label: t('yearly') }]} />
            </Field>
            <DatePickerInput label={t('recurring_next_due')} value={due} onChange={setDue} data-testid="recurring-due" />
            <Field label={t('source_account')}>
              <div className="flex gap-2 overflow-x-auto no-scrollbar">
                <button type="button" onClick={() => setAccountId(null)} className={cn('shrink-0 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors', accountId === null ? 'bg-zinc-950 text-white border-zinc-950 dark:bg-white dark:text-zinc-950 dark:border-white' : 'bg-white dark:bg-[#1c1c1e] border-zinc-200 dark:border-white/10 text-zinc-950 dark:text-white')}>{t('no_account_opt')}</button>
                {(accounts || []).map((a) => (
                  <button key={a.id} type="button" onClick={() => setAccountId(a.id)} className={cn('shrink-0 rounded-xl border px-3 py-2 text-sm font-semibold whitespace-nowrap transition-colors', accountId === a.id ? 'bg-zinc-950 text-white border-zinc-950 dark:bg-white dark:text-zinc-950 dark:border-white' : 'bg-white dark:bg-[#1c1c1e] border-zinc-200 dark:border-white/10 text-zinc-950 dark:text-white')}>{a.name}</button>
                ))}
              </div>
            </Field>
            <div className="flex gap-2">
              <button type="button" onClick={() => setAdding(false)} className="flex-1 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 py-2.5 font-semibold text-sm text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white transition-colors">{t('cancel')}</button>
              <button type="button" onClick={save} disabled={!title.trim() || !(Number(amount) || 0)} className={cn('flex-1 rounded-xl bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 py-2.5 font-bold text-sm transition-colors', (!title.trim() || !(Number(amount) || 0)) && 'opacity-40')} data-testid="recurring-save">{t('save')}</button>
            </div>
          </div>
        ) : null}
        <div className="h-6" />
      </Sheet>
      <CurrencySheet open={pickCur} onClose={() => setPickCur(false)} value={currency} onSelect={setCurrency} zIndex={80} />
    </>
  )
}

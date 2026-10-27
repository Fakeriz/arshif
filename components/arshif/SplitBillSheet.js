'use client'
import { useEffect, useMemo, useState } from 'react'
import { Plus, X, UserPlus, Check } from 'lucide-react'
import { toast } from 'sonner'
import { useApp } from './context'
import { Sheet, SheetTextButton, Field, TextInput, Segmented, PrimaryButton, Card } from './ui'
import { allocateEqualShares, getCurrency, roundMoney } from '@/lib/currencies'
import { cn } from '@/lib/utils'
import { sanitizeAmount } from '@/lib/amount'

export default function SplitBillSheet({ open, onClose }) {
  const { t, home, fmt, profile, store } = useApp()
  const [title, setTitle] = useState('')
  const [total, setTotal] = useState('')
  const [mode, setMode] = useState('equally')
  const [people, setPeople] = useState([])
  const [newPerson, setNewPerson] = useState('')
  const [items, setItems] = useState([])
  const [assign, setAssign] = useState({})
  const [activePerson, setActivePerson] = useState('me')

  useEffect(() => {
    if (!open) return
    setTitle(''); setTotal(''); setMode('equally'); setItems([]); setAssign({}); setNewPerson('')
    const me = { id: 'me', name: profile?.full_name?.split(' ')[0] || t('you') }
    setPeople([me, { id: 'p1', name: '' }]); setActivePerson('me')
  }, [open]) // eslint-disable-line

  const named = people.filter((p) => p.name.trim())
  const totalNum = mode === 'items'
    ? roundMoney(items.reduce((s, i) => s + (Number(i.price) || 0), 0), home)
    : roundMoney(Number(total) || 0, home)
  const equalShares = useMemo(() => allocateEqualShares(totalNum, named.length, home), [totalNum, named.length, home])
  const equalShare = equalShares[0] || 0

  const perPerson = useMemo(() => {
    const totals = Object.fromEntries(people.map((p) => [p.id, 0]))
    if (mode === 'equally') { named.forEach((p, idx) => { totals[p.id] = equalShares[idx] || 0 }); return { totals, unassigned: 0 } }
    if (mode === 'uneven') { people.forEach((p) => { totals[p.id] = roundMoney(Number(p.amount) || 0, home) }); return { totals, unassigned: 0 } }
    let unassigned = 0
    items.forEach((it, idx) => {
      const a = assign[idx] || []; const price = roundMoney(Number(it.price) || 0, home)
      if (!a.length) { unassigned = roundMoney(unassigned + price, home); return }
      const shares = allocateEqualShares(price, a.length, home)
      a.forEach((pid, shareIdx) => { if (totals[pid] != null) totals[pid] = roundMoney(totals[pid] + shares[shareIdx], home) })
    })
    return { totals, unassigned }
  }, [mode, people, named, equalShares, items, assign, home])

  const setPerson = (id, patch) => setPeople((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  const addPerson = () => { const name = newPerson.trim(); const id = `p_${Date.now()}`; setPeople((ps) => [...ps, { id, name: name || `Person ${ps.length + 1}` }]); setActivePerson(id); setNewPerson('') }
  const removePerson = (id) => { if (id === 'me') return; setPeople((ps) => ps.filter((p) => p.id !== id)); setAssign((a) => Object.fromEntries(Object.entries(a).map(([k, v]) => [k, v.filter((x) => x !== id)]))); if (activePerson === id) setActivePerson('me') }
  const addItem = () => setItems((x) => [...x, { name: '', price: 0 }])
  const setItem = (i, patch) => setItems((x) => x.map((it, idx) => (idx === i ? { ...it, ...patch } : it)))
  const delItem = (i) => { setItems((x) => x.filter((_, idx) => idx !== i)); setAssign((a) => { const c = { ...a }; delete c[i]; return c }) }
  const toggleAssign = (i) => setAssign((a) => { const cur = a[i] || []; return { ...a, [i]: cur.includes(activePerson) ? cur.filter((x) => x !== activePerson) : [...cur, activePerson] } })

  const save = async () => {
    const unevenTotal = roundMoney(people.reduce((sum, person) => sum + (Number(person.amount) || 0), 0), home)
    if (!title.trim() || totalNum <= 0 || named.length < 2 || named.length !== people.length) { toast.error(t('error')); return }
    if (mode === 'uneven' && unevenTotal !== totalNum) { toast.error(t('error')); return }
    if (mode === 'items' && perPerson.unassigned > 0) { toast.error(t('error')); return }
    if (!store?.createSplitBill) { toast.error(t('error')); return }
    const participants = named.map((person) => ({
      ...person,
      amount: roundMoney(perPerson.totals[person.id] || 0, home),
    }))
    try {
      await store.createSplitBill({
        title: title.trim(),
        total: roundMoney(totalNum, home),
        currency: home,
        mode,
        participants,
        items: mode === 'items' ? items.map((item, index) => ({ ...item, price: roundMoney(item.price, home), assignees: assign[index] || [] })) : [],
        status: 'open',
      })
      toast.success(t('saved_msg'))
      onClose?.()
    } catch (error) {
      toast.error(error?.message || t('error'))
    }
  }

  return (
    <Sheet open={open} onClose={onClose} full title={t('split_bill')} left={<SheetTextButton muted onClick={onClose}>{t('cancel')}</SheetTextButton>} right={<SheetTextButton bold onClick={save}>{t('save')}</SheetTextButton>}>
      <div className="space-y-5 pt-2">
        <Field label={t('goal_name')}><TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Dinner at Murni" data-testid="split-title" /></Field>
        <Segmented value={mode} onChange={setMode} options={[{ id: 'equally', label: t('equally') }, { id: 'uneven', label: t('uneven') }, { id: 'items', label: t('by_items') }]} />

        {mode !== 'items' ? (
          <Field label={`${t('total')} (${getCurrency(home).code})`}><TextInput type="text" inputMode="decimal" value={total} onChange={(e) => setTotal(sanitizeAmount(e.target.value))} placeholder="0" className="text-lg font-bold" data-testid="split-total" /></Field>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-1"><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-600 dark:text-zinc-400">{t('items')}</p><span className="text-sm font-bold tabular-nums text-zinc-950 dark:text-white">{fmt(totalNum, home)}</span></div>
            <Card className="overflow-hidden bg-white dark:bg-[#1c1c1e] border-zinc-200 dark:border-white/10">
              {items.map((it, i) => {
                const a = assign[i] || []; const mine = a.includes(activePerson)
                return (
                  <div key={i} className="flex items-center gap-2 px-3 py-2 border-b border-zinc-200/60 dark:border-white/5 last:border-0">
                    <button type="button" onClick={() => toggleAssign(i)} className="h-11 w-11 rounded-lg flex items-center justify-center shrink-0" aria-label="assign"><span className={cn('h-5 w-5 rounded-md border flex items-center justify-center transition-colors', mine ? 'bg-zinc-950 border-zinc-950 text-white dark:bg-white dark:border-white dark:text-zinc-950' : 'border-zinc-300 dark:border-zinc-700')}>{mine ? <Check size={12} strokeWidth={3} /> : null}</span></button>
                    <input value={it.name} onChange={(e) => setItem(i, { name: e.target.value })} placeholder={t('item_name')} className="flex-1 bg-transparent text-sm min-w-0 text-zinc-950 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 font-medium outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 rounded" />
                    <input type="text" inputMode="decimal" value={it.price} onChange={(e) => setItem(i, { price: Number(sanitizeAmount(e.target.value)) || 0 })} className="w-20 bg-zinc-100 dark:bg-zinc-800 rounded-lg px-2 py-1 text-right text-sm focus-visible:ring-2 focus-visible:ring-foreground/20 tabular-nums font-bold text-zinc-950 dark:text-white border border-zinc-200 dark:border-white/5 outline-none" placeholder="0" />
                    <button type="button" onClick={() => delItem(i)} className="p-1 text-zinc-400 hover:text-rose-500 dark:text-zinc-500 dark:hover:text-rose-400 transition-colors"><X size={14} /></button>
                  </div>
                )
              })}
              <button type="button" onClick={addItem} className="w-full px-3 py-2.5 text-sm font-bold flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white transition-colors"><Plus size={14} /> {t('add_item')}</button>
            </Card>
            {perPerson.unassigned > 0 ? <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">{t('unassigned_items')}: {fmt(perPerson.unassigned, home)}</p> : null}
          </div>
        )}

        {mode === 'equally' && named.length ? <p className="text-center text-sm font-semibold text-zinc-700 dark:text-zinc-300">{fmt(equalShare, home)} / {t('person')} × {named.length}</p> : null}

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-600 dark:text-zinc-400 mb-2">{t('participants')}</p>
          <div className="space-y-2">
            {people.map((p) => (
              <div key={p.id} className={cn('flex items-center gap-2 p-2.5 bg-white dark:bg-[#121214] border border-zinc-200 dark:border-white/10 rounded-2xl transition-all', mode === 'items' && activePerson === p.id && 'ring-2 ring-zinc-950 dark:ring-white')} onClick={mode === 'items' ? () => setActivePerson(p.id) : undefined}>
                <div className="h-9 w-9 rounded-full bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 flex items-center justify-center text-sm font-bold shrink-0">{(p.name.trim()[0] || '?').toUpperCase()}</div>
                <input value={p.name} onChange={(e) => setPerson(p.id, { name: e.target.value })} placeholder="Name" className="flex-1 bg-transparent focus-visible:ring-2 focus-visible:ring-foreground/20 rounded text-sm font-bold min-w-0 text-zinc-950 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 outline-none" onClick={(e) => e.stopPropagation()} />
                {mode === 'uneven' ? (
                  <input type="text" inputMode="decimal" value={p.amount || ''} onChange={(e) => setPerson(p.id, { amount: sanitizeAmount(e.target.value) })} placeholder="0" className="w-20 bg-zinc-100 dark:bg-zinc-800 rounded-lg px-2 py-1.5 text-sm font-bold text-right focus-visible:ring-2 focus-visible:ring-foreground/20 tabular-nums text-zinc-950 dark:text-white border border-zinc-200 dark:border-white/5 outline-none" onClick={(e) => e.stopPropagation()} />
                ) : (
                  <span className="text-sm font-bold tabular-nums text-zinc-950 dark:text-white pr-1">{fmt(perPerson.totals[p.id] || 0, home)}</span>
                )}
                {p.id !== 'me' ? <button type="button" onClick={(e) => { e.stopPropagation(); removePerson(p.id) }} className="p-1.5 text-zinc-400 hover:text-rose-500 dark:text-zinc-500 dark:hover:text-rose-400 transition-colors"><X size={15} /></button> : null}
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-2">
            <TextInput value={newPerson} onChange={(e) => setNewPerson(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addPerson()} placeholder={t('add_participant')} className="py-2" data-testid="split-add" />
            <button type="button" onClick={addPerson} className="h-[42px] w-[42px] rounded-xl bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 flex items-center justify-center shrink-0"><UserPlus size={16} /></button>
          </div>
        </div>

        <PrimaryButton onClick={save}>{t('save')}</PrimaryButton>
      </div>
    </Sheet>
  )
}
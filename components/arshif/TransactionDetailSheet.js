'use client'
import { useEffect, useMemo, useState } from 'react'
import { Pencil, Trash2, Eye, X, Plus, Check, UserPlus, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { useApp } from './context'
import { Sheet, Segmented, CategoryBadge, Card } from './ui'
import ReceiptPreviewWithDrive, { getDriveThumbnailUrl } from './ReceiptPreviewWithDrive'
import { roundMoney } from '@/lib/currencies'
import { applyTxToBalances } from '@/lib/ledger'
import { cn } from '@/lib/utils'
import { sanitizeAmount } from '@/lib/amount'

export default function TransactionDetailSheet({ open, isOpen: propIsOpen, onClose, tx: propTx, transaction, onEdit }) {
  const isOpen = open ?? propIsOpen
  const activeTx = propTx ?? transaction
  const { t, fmt, home, accounts = [], store, refresh, rates, profile, lang, convertToHome, deleteTransaction } = useApp()
  const [subTab, setSubTab] = useState('items')
  const [viewImg, setViewImg] = useState(false)
  const [items, setItems] = useState([])
  const [editingItems, setEditingItems] = useState(false)
  // split state: participants + assignment map { itemIndex: [participantId,...] }
  const [people, setPeople] = useState([])
  const [assign, setAssign] = useState({})
  const [activePerson, setActivePerson] = useState(null)
  const [newPerson, setNewPerson] = useState('')

  useEffect(() => {
    if (!isOpen || !activeTx) return
    setSubTab('items')
    setEditingItems(false)
    setItems(Array.isArray(activeTx.items) ? activeTx.items.map((it) => ({ ...it })) : [])
    const saved = activeTx.split
    if (saved?.people?.length) {
      setPeople(saved.people); setAssign(saved.assign || {}); setActivePerson(saved.people[0]?.id || null)
    } else {
      const me = { id: 'me', name: profile?.full_name?.split(' ')[0] || t('you') }
      setPeople([me]); setAssign({}); setActivePerson('me')
    }
    setNewPerson('')
  }, [isOpen, activeTx]) // eslint-disable-line

  // per-person totals for split-by-items.
  // NOTE: declared BEFORE any conditional return so hook order stays constant (Rules of Hooks).
  const perPerson = useMemo(() => {
    const totals = Object.fromEntries((people || []).map((p) => [p?.id, 0]))
    let unassigned = 0
    ;(items || []).forEach((it, idx) => {
      const assignees = assign?.[idx] || []
      const price = Number(it?.price) || 0
      if (!assignees.length) { unassigned += price; return }
      const share = price / assignees.length
      assignees.forEach((pid) => { if (totals[pid] != null) totals[pid] += share })
    })
    return { totals, unassigned }
  }, [items, assign, people])

  if (!isOpen || !activeTx) return null

  const tx = activeTx

  const cur = tx?.currency || home
  const acc = (accounts || []).find((a) => a?.id === tx?.account_id)
  const isForeign = cur !== home
  const total = Number(tx.amount) || (items || []).reduce((s, i) => s + (Number(i?.price) || 0), 0)

  const dateStr = tx?.date || tx?.transaction_date
  const formattedDate = (() => {
    if (!dateStr) return '—'
    try {
      const parsed = new Date(dateStr)
      if (isNaN(parsed.getTime())) return '—'
      return parsed.toLocaleDateString(lang === 'en' ? 'en-GB' : 'id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
    } catch {
      return '—'
    }
  })()

  const remove = async () => {
    onClose?.()
    toast.success(t('deleted'))
    try {
      if (deleteTransaction) {
        await deleteTransaction(tx)
      } else {
        await applyTxToBalances(store, accounts, tx, -1, rates)
        await store.deleteTransaction(tx.id)
        if (refresh) await refresh()
      }
    } catch (e) { toast.error(e?.message || t('error')) }
  }

  const persistItems = async (next) => {
    setItems(next)
    try { await store.updateTransaction(tx.id, { items: next }); await refresh() } catch (e) { toast.error(e?.message || t('error')) }
  }
  const setItem = (idx, patch) => { const next = items.map((it, i) => (i === idx ? { ...it, ...patch } : it)); setItems(next) }
  const addItem = () => setItems((x) => [...x, { name: '', qty: 1, price: 0 }])
  const delItem = (idx) => { const next = items.filter((_, i) => i !== idx); persistItems(next); setAssign((a) => { const c = { ...a }; delete c[idx]; return c }) }

  const addPerson = () => {
    const name = newPerson.trim()
    if (!name) return
    const id = `p_${Date.now()}`
    setPeople((ps) => [...ps, { id, name }]); setActivePerson(id); setNewPerson('')
  }
  const removePerson = (id) => {
    if (id === 'me') return
    setPeople((ps) => ps.filter((p) => p.id !== id))
    setAssign((a) => Object.fromEntries(Object.entries(a).map(([k, v]) => [k, v.filter((x) => x !== id)])))
    if (activePerson === id) setActivePerson('me')
  }
  const toggleAssign = (idx) => {
    if (!activePerson) return
    setAssign((a) => {
      const cur = a[idx] || []
      return { ...a, [idx]: cur.includes(activePerson) ? cur.filter((x) => x !== activePerson) : [...cur, activePerson] }
    })
  }
  const saveSplit = async () => {
    try { await store.updateTransaction(tx.id, { split: { people, assign, savedAt: new Date().toISOString() } }); await refresh(); toast.success(t('saved_msg')) } catch (e) { toast.error(e?.message || t('error')) }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      full
      right={<div className="flex items-center gap-1"><button type="button" onClick={() => onEdit?.(tx)} className="p-2 text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white" data-testid="tx-edit"><Pencil size={18} /></button><button type="button" onClick={remove} className="p-2 text-rose-500 hover:text-rose-600" data-testid="tx-delete"><Trash2 size={18} /></button></div>}
    >
      <p className="text-center text-xs text-zinc-600 dark:text-zinc-400 font-medium">
        {t('paid_by')} {profile?.full_name?.split(' ')[0] || t('user')} {t('on')} {formattedDate}
        {tx.receipt_number ? ` · ${t('receipt_no')} ${tx.receipt_number}` : ''}
      </p>

      <div className="flex items-center gap-3 mt-4">
        <CategoryBadge id={tx.category} size="lg" />
        <div className="flex-1">
          <p className="text-xl font-extrabold text-zinc-950 dark:text-white">{tx.merchant || tx.note || tx.description || t(`cat_${tx.category || 'other'}`)}</p>
          <span className="inline-block mt-1 text-[10px] font-bold uppercase rounded-md bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-zinc-600 dark:text-zinc-400">{t(`cat_${tx.category || 'other'}`)}</span>
        </div>
      </div>

      <ReceiptPreviewWithDrive
        receiptUrl={tx.receipt_url}
        storageProvider={tx.storage_provider}
        merchantName={tx.merchant || tx.note || tx.description}
        receiptCache={tx.receipt_cache || tx.receipt_preview}
        onOpenFullImage={() => setViewImg(true)}
      />

      <div className="text-center mt-6">
        <p className="text-4xl font-extrabold tabular-nums text-zinc-950 dark:text-white">{tx.type === 'expense' ? '-' : tx.type === 'income' ? '+' : ''}{fmt(total, cur)}</p>
        {isForeign ? <p className="text-sm text-zinc-600 dark:text-zinc-400 font-medium mt-1">≈ {fmt(convertToHome(total, cur), home)} {home} · {t('rate')} {tx.rate ? Number(tx.rate).toPrecision(4) : ''}</p> : null}
        <p className="text-xs text-zinc-600 dark:text-zinc-400 font-medium mt-2">{t(tx.payment_method || 'cash')}{acc ? ` · ${acc.name}` : ''}{tx.tax_deductible ? ` · ${t('tax_deductible')}` : ''}</p>
      </div>

      <div className="mt-6">
        <Segmented value={subTab} onChange={setSubTab} options={[{ id: 'items', label: t('items') }, { id: 'split', label: t('split') }]} />

        {subTab === 'items' ? (
          <div className="mt-3">
            <div className="flex items-center justify-between mb-2 px-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-600 dark:text-zinc-400">{items.length} {t('items')}</p>
              <button type="button" onClick={() => { if (editingItems) persistItems(items); setEditingItems(!editingItems) }} className="text-xs font-bold text-zinc-950 dark:text-white flex items-center gap-1">{editingItems ? <><Check size={13} /> {t('done')}</> : <><Pencil size={12} /> {t('edit')}</>}</button>
            </div>
            <Card className="overflow-hidden">
              <div className="grid grid-cols-[1fr_auto] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-600 dark:text-zinc-400 border-b border-zinc-200/60 dark:border-white/5"><span>{t('item')}</span><span>{t('price')}</span></div>
              {items.map((it, i) => (
                <div key={i} className="flex items-center gap-2 px-4 py-2.5 text-sm border-b border-zinc-200/40 dark:border-white/5 last:border-0 text-zinc-950 dark:text-white">
                  {editingItems ? (
                    <>
                      <input value={it.name} onChange={(e) => setItem(i, { name: e.target.value })} placeholder={t('item_name')} className="flex-1 bg-transparent text-base focus-visible:ring-2 focus-visible:ring-foreground/20 rounded min-w-0 text-zinc-950 dark:text-white outline-none" />
                      <input type="text" inputMode="decimal" value={it.price} onChange={(e) => setItem(i, { price: Number(sanitizeAmount(e.target.value)) || 0 })} className="w-20 bg-zinc-100 dark:bg-zinc-800 text-base text-zinc-950 dark:text-white rounded-lg px-2 py-1 text-right focus-visible:ring-2 focus-visible:ring-foreground/20 tabular-nums font-semibold outline-none" />
                      <button type="button" onClick={() => delItem(i)} className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"><X size={15} /></button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 truncate font-medium">{it.qty > 1 ? `${it.qty}× ` : ''}{it.name || t('item')}</span>
                      <span className="tabular-nums font-bold text-zinc-950 dark:text-white">{fmt(it.price, cur)}</span>
                    </>
                  )}
                </div>
              ))}
              {!items.length ? <p className="px-4 py-3 text-sm text-zinc-400 dark:text-zinc-500">—</p> : null}
              {editingItems ? <button type="button" onClick={addItem} className="w-full px-4 py-3 text-sm font-bold flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white"><Plus size={15} /> {t('add_item')}</button> : null}
              <div className="grid grid-cols-[1fr_auto] px-4 py-3 font-bold border-t border-zinc-200/60 dark:border-white/5 text-zinc-950 dark:text-white"><span>{t('total')}</span><span className="tabular-nums">{fmt(total, cur)}</span></div>
            </Card>
          </div>
        ) : (
          <div className="mt-3 space-y-4">
            {/* Participants */}
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-600 dark:text-zinc-400 mb-2">{t('participants')}</p>
              <div className="flex flex-wrap gap-2">
                {(people || []).map((p) => (
                  <button key={p.id} type="button" onClick={() => setActivePerson(p.id)} className={cn('inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-semibold transition-all', activePerson === p.id ? 'bg-zinc-950 text-white border-zinc-950 dark:bg-white dark:text-zinc-950 dark:border-white font-bold' : 'bg-white dark:bg-[#1c1c1e] text-zinc-950 dark:text-white border-zinc-200 dark:border-white/10')}>
                    <span className="h-5 w-5 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 flex items-center justify-center text-[10px] font-bold">{(p.name[0] || '?').toUpperCase()}</span>
                    {p.name}
                    <span className="tabular-nums opacity-80">{fmt(perPerson.totals[p.id] || 0, cur)}</span>
                    {p.id !== 'me' ? <X size={13} onClick={(e) => { e.stopPropagation(); removePerson(p.id) }} /> : null}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                <input value={newPerson} onChange={(e) => setNewPerson(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addPerson()} placeholder={t('add_participant')} className="flex-1 rounded-xl bg-white dark:bg-[#1c1c1e] border border-zinc-200 dark:border-white/10 px-3 py-2 text-base text-zinc-950 dark:text-white placeholder:text-zinc-400 outline-none" data-testid="split-add-person" />
                <button type="button" onClick={addPerson} className="h-9 w-9 rounded-xl bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 flex items-center justify-center font-bold"><UserPlus size={16} /></button>
              </div>
            </div>

            {/* Assign items */}
            {items.length ? (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-600 dark:text-zinc-400 mb-1">{t('assign_items')}</p>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-2">{t('tap_to_assign')}: <span className="font-bold text-zinc-950 dark:text-white">{people.find((p) => p.id === activePerson)?.name || '—'}</span></p>
                <Card className="overflow-hidden">
                  {items.map((it, i) => {
                    const assignees = assign[i] || []
                    const mine = activePerson && assignees.includes(activePerson)
                    return (
                      <button key={i} type="button" onClick={() => toggleAssign(i)} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm border-b border-zinc-200/40 dark:border-white/5 last:border-0 text-left">
                        <span className={cn('h-5 w-5 rounded-md border flex items-center justify-center shrink-0 transition-colors', mine ? 'bg-zinc-950 border-zinc-950 text-white dark:bg-white dark:border-white dark:text-zinc-950' : 'border-zinc-300 dark:border-zinc-700')}>{mine ? <Check size={13} strokeWidth={3} /> : null}</span>
                        <span className="flex-1 truncate font-medium text-zinc-950 dark:text-white">{it.name || t('item')}</span>
                        <span className="tabular-nums font-bold text-zinc-950 dark:text-white">{fmt(it.price, cur)}</span>
                        {assignees.length ? <span className="text-[10px] text-zinc-500 dark:text-zinc-400">/{assignees.length}</span> : null}
                      </button>
                    )
                  })}
                  <div className="flex items-center justify-between px-4 py-2.5 text-sm bg-zinc-50 dark:bg-zinc-900 border-t border-zinc-200/40 dark:border-white/5">
                    <span className="text-zinc-600 dark:text-zinc-400 font-medium">{t('unassigned_items')}</span>
                    <span className="tabular-nums font-bold text-zinc-950 dark:text-white">{fmt(perPerson.unassigned, cur)}</span>
                  </div>
                </Card>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-zinc-200 dark:border-white/10 p-4 text-center text-sm text-zinc-600 dark:text-zinc-400">
                {t('no_transactions_sub')}
              </div>
            )}

            {/* Summary */}
            <Card className="p-4 space-y-2">
              {(people || []).map((p) => (
                <div key={p.id} className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-zinc-950 dark:text-white">{p.name}</span>
                  <span className="tabular-nums font-bold text-zinc-950 dark:text-white">{fmt(perPerson.totals[p.id] || 0, cur)}</span>
                </div>
              ))}
            </Card>

            <button type="button" onClick={saveSplit} className="w-full rounded-xl bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 font-bold py-3.5 transition-colors" data-testid="split-save">{t('save_split')}</button>
          </div>
        )}
      </div>
      <div className="h-8" />

      {viewImg && tx.receipt_url ? (
        <div className="fixed inset-0 z-[80] bg-black/95 flex items-center justify-center p-4 cursor-pointer" onClick={() => setViewImg(false)}>
          <button type="button" className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer transition" onClick={() => setViewImg(false)}><X size={20} /></button>
          <div className="relative max-h-[85dvh] max-w-full flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <img
              src={getDriveThumbnailUrl(tx.receipt_url, 1200, tx.merchant || tx.note)}
              alt="receipt"
              referrerPolicy="no-referrer"
              crossOrigin="anonymous"
              className="max-h-[75dvh] max-w-full object-contain rounded-2xl shadow-2xl select-none"
            />
            {tx.receipt_url?.includes('drive.google.com') && (
              <a
                href={tx.receipt_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/15 hover:bg-white/25 text-white text-xs font-bold backdrop-blur-md transition-all active:scale-95 cursor-pointer shadow-lg border border-white/10"
              >
                <ExternalLink size={14} />
                {t('tx_open_drive')}
              </a>
            )}
          </div>
        </div>
      ) : null}
    </Sheet>
  )
}
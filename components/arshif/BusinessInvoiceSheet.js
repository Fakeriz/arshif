'use client'
import { useEffect, useMemo, useState } from 'react'
import { Briefcase, Plus, Trash2, Share2, CheckCircle2, FileText, ChevronRight, X } from 'lucide-react'
import { toast } from 'sonner'
import { useApp } from './context'
import { Sheet, TextInput, Field, Segmented } from './ui'
import CurrencySheet from './CurrencySheet'
import { getCurrency } from '@/lib/currencies'
import { cn } from '@/lib/utils'
import { sanitizeAmount } from '@/lib/amount'

const uid = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `iv_${Date.now()}_${Math.random().toString(36).slice(2)}`)
const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d } catch { return d } }
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} }

const CFG_KEY = 'arshif_business_cfg'

const invoiceTotal = (inv) => (inv?.items || []).reduce((s, it) => s + (Number(it?.qty) || 0) * (Number(it?.price) || 0), 0)

const safeDate = (s) => {
  if (!s) return ''
  try { const d = new Date(s); return isNaN(d.getTime()) ? '' : d.toLocaleDateString() } catch { return '' }
}

export default function BusinessInvoiceSheet({ open, onClose }) {
  const { t, home, fmt, convertToHome, session, accounts = [], store, refresh } = useApp()
  const scope = session?.user?.id || 'guest'
  const INV_KEY = `arshif_invoices_${scope}`

  const [cfg, setCfg] = useState({ enabled: false, brand: '' })
  const [invoices, setInvoices] = useState([])
  const [tab, setTab] = useState('invoices')
  const [filter, setFilter] = useState('all')

  // form
  const [formOpen, setFormOpen] = useState(false)
  const [client, setClient] = useState('')
  const [due, setDue] = useState('')
  const [currency, setCurrency] = useState(home)
  const [items, setItems] = useState([{ id: uid(), desc: '', qty: '1', price: '' }])
  const [payNote, setPayNote] = useState('')
  const [pickCur, setPickCur] = useState(false)

  useEffect(() => {
    if (!open) return
    setCfg({ enabled: false, brand: '', ...(lsGet(CFG_KEY, {}) || {}) })
    setInvoices(lsGet(INV_KEY, []) || [])
    setTab('invoices'); setFilter('all'); setFormOpen(false)
  }, [open]) // eslint-disable-line

  const persistCfg = (patch) => { const next = { ...cfg, ...patch }; setCfg(next); lsSet(CFG_KEY, next) }
  const persistInv = (next) => { setInvoices(next); lsSet(INV_KEY, next) }

  const toHome = (amt, cur) => {
    const raw = Number(amt) || 0
    try { const v = convertToHome ? convertToHome(raw, cur || home) : raw; return isFinite(v) && !isNaN(v) ? v : raw } catch { return raw }
  }

  const nextNumber = useMemo(() => {
    const year = new Date().getFullYear()
    const seq = (invoices || []).length + 1
    return `INV-${year}-${String(seq).padStart(3, '0')}`
  }, [invoices])

  const summary = useMemo(() => {
    const list = invoices || []
    const paid = list.filter((i) => i?.status === 'paid')
    const unpaid = list.filter((i) => i?.status !== 'paid')
    const revenue = paid.reduce((s, i) => s + toHome(invoiceTotal(i), i?.currency), 0)
    const outstanding = unpaid.reduce((s, i) => s + toHome(invoiceTotal(i), i?.currency), 0)
    return { revenue, outstanding, paidCount: paid.length, unpaidCount: unpaid.length, total: list.length }
  }, [invoices]) // eslint-disable-line

  const filtered = useMemo(() => {
    const list = invoices || []
    if (filter === 'paid') return list.filter((i) => i?.status === 'paid')
    if (filter === 'unpaid') return list.filter((i) => i?.status !== 'paid')
    return list
  }, [invoices, filter])

  const openForm = () => {
    setClient(''); setDue(''); setCurrency(home); setItems([{ id: uid(), desc: '', qty: '1', price: '' }]); setPayNote(''); setFormOpen(true)
  }
  const addItem = () => setItems((arr) => [...(arr || []), { id: uid(), desc: '', qty: '1', price: '' }])
  const updItem = (id, patch) => setItems((arr) => (arr || []).map((it) => (it.id === id ? { ...it, ...patch } : it)))
  const delItem = (id) => setItems((arr) => (arr || []).length > 1 ? (arr || []).filter((it) => it.id !== id) : arr)

  const formTotal = (items || []).reduce((s, it) => s + (Number(it?.qty) || 0) * (Number(it?.price) || 0), 0)
  const canSave = client.trim() && formTotal > 0

  const saveInvoice = () => {
    if (!canSave) return
    const inv = {
      id: uid(), number: nextNumber, client: client.trim(), due_date: due || null, currency,
      items: (items || []).map((it) => ({ desc: (it.desc || '').trim(), qty: Number(it.qty) || 0, price: Number(it.price) || 0 })),
      pay_note: payNote.trim(), status: 'unpaid', created_at: new Date().toISOString(),
    }
    persistInv([inv, ...(invoices || [])])
    setFormOpen(false)
    toast.success(t('saved_msg'))
  }

  const markPaid = async (inv) => {
    if (!inv || inv.status === 'paid') return
    persistInv((invoices || []).map((i) => (i.id === inv.id ? { ...i, status: 'paid', paid_at: new Date().toISOString() } : i)))
    // Record income to the business (first) account.
    try {
      if (store?.createTransaction) {
        const acc = (accounts || [])[0]
        await store.createTransaction({
          type: 'income', amount: invoiceTotal(inv), currency: inv.currency || home,
          category: 'business', account_id: acc?.id || null, date: new Date().toISOString(),
          note: `${cfg.brand || t('business')} · ${inv.number} · ${inv.client || ''}`.trim(),
        })
        if (refresh) await refresh()
      }
    } catch {}
    toast.success(t('bi_paid_toast'))
  }

  const shareInvoice = async (inv) => {
    const cur = inv?.currency || home
    const lines = [
      cfg.brand ? `*${cfg.brand}*` : '*Invoice*',
      `${t('bi_invoice')}: ${inv?.number || ''}`,
      `${t('bi_client')}: ${inv?.client || '-'}`,
      inv?.due_date ? `${t('bi_due_date')}: ${safeDate(inv.due_date)}` : null,
      '',
      ...((inv?.items || []).map((it) => `• ${it?.desc || '-'} — ${it?.qty || 0} x ${getCurrency(cur).symbol}${Number(it?.price) || 0} = ${fmt((Number(it?.qty) || 0) * (Number(it?.price) || 0), cur)}`)),
      '',
      `${t('bi_total')}: ${fmt(invoiceTotal(inv), cur)}`,
      `${t('bi_status')}: ${inv?.status === 'paid' ? t('bi_status_paid') : t('bi_status_unpaid')}`,
      inv?.pay_note ? `\n${inv.pay_note}` : null,
    ].filter((x) => x !== null && x !== undefined)
    const text = lines.join('\n')
    try {
      if (navigator?.share) { await navigator.share({ title: inv?.number || 'Invoice', text }) }
      else { await navigator.clipboard.writeText(text); toast.success(t('bi_copied')) }
    } catch { try { await navigator.clipboard.writeText(text); toast.success(t('bi_copied')) } catch {} }
  }

  const remove = (id) => persistInv((invoices || []).filter((i) => i?.id !== id))

  const itemCard = 'rounded-2xl bg-zinc-100 border border-zinc-200/60 dark:bg-[#141416] dark:border-white/5'

  return (
    <>
      <Sheet open={open} onClose={onClose} full title={t('bi_title')}
        right={<button type="button" onClick={openForm} className="text-[15px] font-bold py-1 px-1 flex items-center gap-1" data-testid="bi-new"><Plus size={16} /> {t('bi_new_invoice')}</button>}>

        {/* Business mode config */}
        <div className={cn(itemCard, 'p-4 mt-1')}>
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-background flex items-center justify-center text-foreground shrink-0"><Briefcase size={17} strokeWidth={1.5} /></div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-[15px]">{t('bi_enable')}</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{t('bi_enable_desc')}</p>
            </div>
            <button type="button" role="switch" aria-checked={!!cfg.enabled} onClick={() => persistCfg({ enabled: !cfg.enabled })}
              className={cn('shrink-0 h-7 w-12 rounded-full transition-colors relative', cfg.enabled ? 'bg-foreground' : 'bg-zinc-300 dark:bg-white/15')} data-testid="bi-toggle">
              <span className={cn('absolute top-0.5 h-6 w-6 rounded-full bg-background transition-all', cfg.enabled ? 'left-[22px]' : 'left-0.5')} />
            </button>
          </div>
          {cfg.enabled ? (
            <div className="mt-3">
              <Field label={t('bi_brand_name')}><TextInput value={cfg.brand} onChange={(e) => persistCfg({ brand: e.target.value })} placeholder={t('bi_brand_ph')} data-testid="bi-brand" /></Field>
            </div>
          ) : null}
        </div>

        <Segmented className="mt-4" value={tab} onChange={setTab} options={[{ id: 'invoices', label: t('bi_tab_invoices') }, { id: 'summary', label: t('bi_tab_summary') }]} />

        {tab === 'invoices' ? (
          <>
            {/* status filter */}
            <div className="flex gap-2 mt-4">
              {[{ id: 'all', label: t('bi_status_all') }, { id: 'unpaid', label: t('bi_status_unpaid') }, { id: 'paid', label: t('bi_status_paid') }].map((f) => (
                <button key={f.id} type="button" onClick={() => setFilter(f.id)} className={cn('rounded-full px-3.5 py-1.5 text-[13px] font-semibold border transition', filter === f.id ? 'bg-foreground text-background border-foreground' : 'bg-background border-border/60 text-muted-foreground')} data-testid={`bi-filter-${f.id}`}>{f.label}</button>
              ))}
            </div>

            <div className="mt-4 space-y-2.5">
              {(filtered || []).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 text-center">
                  <div className="h-14 w-14 rounded-2xl bg-zinc-100 dark:bg-white/[0.06] flex items-center justify-center mb-3"><FileText size={24} className="text-muted-foreground" strokeWidth={1.5} /></div>
                  <p className="font-semibold">{t('bi_no_invoices')}</p>
                  <p className="text-sm text-muted-foreground mt-1">{t('bi_no_invoices_sub')}</p>
                </div>
              ) : null}

              {(filtered || []).map((inv) => (
                <div key={inv?.id} className={cn(itemCard, 'p-4')} data-testid="bi-invoice-row">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-[15px] tabular-nums">{inv?.number}</p>
                        <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', inv?.status === 'paid' ? 'bg-foreground text-background' : 'border border-border/70 text-muted-foreground')}>{inv?.status === 'paid' ? t('bi_status_paid') : t('bi_status_unpaid')}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5 truncate">{inv?.client || '-'}{inv?.due_date ? ` · ${t('bi_due')} ${safeDate(inv.due_date)}` : ''}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-extrabold tabular-nums text-[15px]">{fmt(invoiceTotal(inv), inv?.currency || home)}</p>
                      <button type="button" onClick={() => remove(inv?.id)} className="text-muted-foreground mt-1 inline-flex" aria-label="delete"><Trash2 size={14} /></button>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    {inv?.status !== 'paid' ? (
                      <button type="button" onClick={() => markPaid(inv)} className="flex-1 rounded-xl bg-foreground text-background py-2 text-[13px] font-semibold flex items-center justify-center gap-1.5" data-testid="bi-mark-paid"><CheckCircle2 size={15} /> {t('bi_mark_paid')}</button>
                    ) : null}
                    <button type="button" onClick={() => shareInvoice(inv)} className={cn('rounded-xl bg-background border border-border/60 py-2 text-[13px] font-semibold flex items-center justify-center gap-1.5', inv?.status === 'paid' ? 'flex-1' : 'px-4')} data-testid="bi-share"><Share2 size={15} /> {t('bi_share')}</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="mt-4 space-y-3">
            <div className="rounded-2xl bg-foreground text-background p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] opacity-60">{t('bi_total_revenue')}</p>
              <p className="text-3xl font-extrabold tabular-nums mt-1" data-testid="bi-revenue">{fmt(summary.revenue, home)}</p>
              <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="rounded-xl bg-background/10 px-3 py-2.5">
                  <p className="text-[11px] uppercase tracking-wide opacity-60">{t('bi_outstanding')}</p>
                  <p className="font-bold tabular-nums mt-0.5">{fmt(summary.outstanding, home)}</p>
                </div>
                <div className="rounded-xl bg-background/10 px-3 py-2.5">
                  <p className="text-[11px] uppercase tracking-wide opacity-60">{t('bi_invoices_count')}</p>
                  <p className="font-bold tabular-nums mt-0.5">{summary.total}</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div className={cn(itemCard, 'p-4')}>
                <p className="text-xs text-muted-foreground">{t('bi_status_paid')}</p>
                <p className="text-2xl font-extrabold tabular-nums mt-1">{summary.paidCount}</p>
              </div>
              <div className={cn(itemCard, 'p-4')}>
                <p className="text-xs text-muted-foreground">{t('bi_status_unpaid')}</p>
                <p className="text-2xl font-extrabold tabular-nums mt-1">{summary.unpaidCount}</p>
              </div>
            </div>
          </div>
        )}
        <div className="h-6" />
      </Sheet>

      {/* Invoice form modal */}
      <Sheet open={formOpen} onClose={() => setFormOpen(false)} full title={t('bi_new_invoice')} zIndex={70}
        left={<button type="button" onClick={() => setFormOpen(false)} className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">{t('cancel')}</button>}
        right={<button type="button" onClick={saveInvoice} disabled={!canSave} className={cn('text-[15px] font-bold py-1 px-1', !canSave && 'opacity-40')} data-testid="bi-save">{t('save')}</button>}>
        <div className="space-y-4 mt-1">
          <div className="rounded-xl bg-zinc-100 border border-zinc-200/60 dark:bg-[#141416] dark:border-white/5 px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{t('bi_invoice')}</span>
            <span className="font-bold tabular-nums">{nextNumber}</span>
          </div>
          <Field label={t('bi_client')}><TextInput value={client} onChange={(e) => setClient(e.target.value)} placeholder={t('bi_client_ph')} data-testid="bi-client" /></Field>
          <Field label={t('bi_due_date')}><TextInput type="date" value={due} onChange={(e) => setDue(e.target.value)} data-testid="bi-due" /></Field>
          <Field label={t('currency')}>
            <button type="button" onClick={() => setPickCur(true)} className="w-full rounded-xl bg-background border border-border/60 px-3 py-3 flex items-center gap-1.5" data-testid="bi-currency">
              <span className="font-bold text-sm">{getCurrency(currency).symbol} {currency}</span>
              <ChevronRight size={15} className="text-muted-foreground ml-auto" />
            </button>
          </Field>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-2">{t('bi_items')}</p>
            <div className="space-y-2">
              {(items || []).map((it) => (
                <div key={it.id} className="rounded-xl bg-zinc-100 border border-zinc-200/60 dark:bg-[#141416] dark:border-white/5 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <TextInput value={it.desc} onChange={(e) => updItem(it.id, { desc: e.target.value })} placeholder={t('bi_desc')} className="flex-1" data-testid="bi-item-desc" />
                    {(items || []).length > 1 ? <button type="button" onClick={() => delItem(it.id)} className="text-muted-foreground shrink-0" aria-label="remove item"><X size={16} /></button> : null}
                  </div>
                  <div className="flex gap-2">
                    <div className="w-20"><TextInput type="text" inputMode="decimal" value={it.qty} onChange={(e) => updItem(it.id, { qty: sanitizeAmount(e.target.value) })} placeholder={t('bi_qty')} /></div>
                    <TextInput type="text" inputMode="decimal" value={it.price} onChange={(e) => updItem(it.id, { price: sanitizeAmount(e.target.value) })} placeholder={t('bi_price')} className="flex-1" />
                    <div className="shrink-0 flex items-center px-2 text-sm font-semibold tabular-nums text-muted-foreground min-w-[70px] justify-end">{fmt((Number(it.qty) || 0) * (Number(it.price) || 0), currency)}</div>
                  </div>
                </div>
              ))}
            </div>
            <button type="button" onClick={addItem} className="mt-2 w-full rounded-xl border border-dashed border-border py-2.5 font-semibold text-sm flex items-center justify-center gap-1.5 text-muted-foreground" data-testid="bi-add-item"><Plus size={16} /> {t('bi_add_item')}</button>
          </div>

          <Field label={t('bi_payment_note')}><TextInput value={payNote} onChange={(e) => setPayNote(e.target.value)} placeholder={t('bi_payment_note_ph')} data-testid="bi-paynote" /></Field>

          <div className="rounded-xl bg-foreground text-background px-4 py-3 flex items-center justify-between">
            <span className="font-semibold">{t('bi_total')}</span>
            <span className="text-xl font-extrabold tabular-nums">{fmt(formTotal, currency)}</span>
          </div>
        </div>
        <div className="h-6" />
      </Sheet>

      <CurrencySheet open={pickCur} onClose={() => setPickCur(false)} value={currency} onSelect={setCurrency} zIndex={90} />
    </>
  )
}
'use client'
import { useEffect, useMemo, useState } from 'react'
import { ChevronRight, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useApp } from './context'
import { Sheet, TextInput, Field, Segmented } from './ui'
import CurrencySheet from './CurrencySheet'
import { getCurrency } from '@/lib/currencies'
import { signedAccountBalance } from '@/lib/ledger'
import { cn } from '@/lib/utils'
import { sanitizeAmount } from '@/lib/amount'

const KEY_A = 'arshif_networth_assets'
const KEY_L = 'arshif_networth_liabs'
const lsGet = (k) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : [] } catch { return [] } }
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} }
const uid = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `n_${Date.now()}_${Math.random().toString(36).slice(2)}`)

export default function NetWorthSheet({ open, onClose }) {
  const { t, home, fmt, accounts = [], convertToHome } = useApp()
  const [tab, setTab] = useState('assets')
  const [assets, setAssets] = useState([])
  const [liabs, setLiabs] = useState([])
  const [adding, setAdding] = useState(false)
  const [pickCur, setPickCur] = useState(false)

  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState(home)

  useEffect(() => {
    if (!open) return
    setTab('assets'); setAdding(false); setAssets(lsGet(KEY_A)); setLiabs(lsGet(KEY_L))
  }, [open])

  const toHome = (amt, cur) => {
    const raw = Number(amt) || 0
    try { const v = convertToHome ? convertToHome(raw, cur || home) : raw; return isFinite(v) && !isNaN(v) ? v : raw } catch { return raw }
  }

  const totals = useMemo(() => {
    const accountAssets = (accounts || []).reduce((s, a) => {
      if (String(a?.type || '').toLowerCase() === 'credit' || signedAccountBalance(a) < 0) return s
      return s + toHome(a?.balance, a?.currency)
    }, 0)
    const accountLiabs = (accounts || []).reduce((s, a) => {
      if (signedAccountBalance(a) >= 0) return s
      return s + Math.abs(toHome(signedAccountBalance(a), a?.currency))
    }, 0)
    const manualA = (assets || []).reduce((s, a) => s + toHome(a?.amount, a?.currency), 0)
    const manualLiabs = (liabs || []).reduce((s, l) => s + toHome(l?.amount, l?.currency), 0)
    const totalAssets = accountAssets + manualA
    const totalLiab = accountLiabs + manualLiabs
    return { totalAssets, totalLiab, net: totalAssets - totalLiab }
  }, [accounts, assets, liabs]) // eslint-disable-line

  const openAdd = () => { setName(''); setAmount(''); setCurrency(home); setAdding(true) }
  const save = () => {
    if (!name.trim() || !(Number(amount) || 0)) return
    const row = { id: uid(), name: name.trim(), amount: Number(amount) || 0, currency }
    if (tab === 'assets') { const next = [...(assets || []), row]; setAssets(next); lsSet(KEY_A, next) }
    else { const next = [...(liabs || []), row]; setLiabs(next); lsSet(KEY_L, next) }
    setAdding(false); toast.success(t('saved_msg'))
  }
  const removeAsset = (id) => { const next = (assets || []).filter((x) => x?.id !== id); setAssets(next); lsSet(KEY_A, next) }
  const removeLiab = (id) => { const next = (liabs || []).filter((x) => x?.id !== id); setLiabs(next); lsSet(KEY_L, next) }

  const cardCls = 'flex items-center gap-3 rounded-2xl bg-zinc-100 border border-zinc-200/60 dark:bg-white/[0.04] dark:border-white/10 px-4 py-3.5'

  return (
    <>
      <Sheet open={open} onClose={onClose} full title={t('net_worth') || 'Net Worth Tracker'}>
        {/* Hero */}
        <div className="mt-1 rounded-2xl bg-foreground text-background p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] opacity-60">{t('nw_total_net_worth')}</p>
          <p className="text-3xl font-extrabold tabular-nums mt-1" data-testid="nw-total">{fmt(totals.net, home)}</p>
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="rounded-xl bg-background/10 px-3 py-2.5">
              <p className="text-[11px] uppercase tracking-wide opacity-60">{t('nw_total_assets')}</p>
              <p className="font-bold tabular-nums mt-0.5" data-testid="nw-assets">{fmt(totals.totalAssets, home)}</p>
            </div>
            <div className="rounded-xl bg-background/10 px-3 py-2.5">
              <p className="text-[11px] uppercase tracking-wide opacity-60">{t('nw_total_liabilities')}</p>
              <p className="font-bold tabular-nums mt-0.5" data-testid="nw-liab">{fmt(totals.totalLiab, home)}</p>
            </div>
          </div>
        </div>

        <Segmented className="mt-4" value={tab} onChange={(v) => { setTab(v); setAdding(false) }} options={[{ id: 'assets', label: 'Assets' }, { id: 'liabilities', label: 'Liabilities' }]} />

        <div className="mt-4 space-y-2.5">
          {tab === 'assets' ? (
            <>
              {(accounts || []).filter((a) => signedAccountBalance(a) >= 0).map((a) => (
                <div key={a.id} className={cardCls} data-testid="nw-account">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[15px] truncate">{a?.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Account</p>
                  </div>
                  <p className="font-bold tabular-nums text-[15px]">{fmt(a?.balance, a?.currency || home)}</p>
                </div>
              ))}
              {(assets || []).map((a) => (
                <div key={a.id} className={cardCls} data-testid="nw-asset-row">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[15px] truncate">{a?.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t('nw_manual_asset')}</p>
                  </div>
                  <p className="font-bold tabular-nums text-[15px]">{fmt(a?.amount, a?.currency || home)}</p>
                  <button type="button" onClick={() => removeAsset(a?.id)} className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground" aria-label="delete"><Trash2 size={15} /></button>
                </div>
              ))}
            </>
          ) : (
            <>
              {(accounts || []).filter((a) => signedAccountBalance(a) < 0).map((a) => (
                <div key={a.id} className={cardCls} data-testid="nw-account-liability">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[15px] truncate">{a?.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t('nw_credit_account')}</p>
                  </div>
                  <p className="font-bold tabular-nums text-[15px] text-rose-600 dark:text-rose-400">{fmt(Math.abs(signedAccountBalance(a)), a?.currency || home)}</p>
                </div>
              ))}
              {(liabs || []).map((l) => (
                <div key={l.id} className={cardCls} data-testid="nw-liab-row">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[15px] truncate">{l?.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Liability</p>
                  </div>
                  <p className="font-bold tabular-nums text-[15px] text-rose-600 dark:text-rose-400">{fmt(l?.amount, l?.currency || home)}</p>
                  <button type="button" onClick={() => removeLiab(l?.id)} className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground" aria-label="delete"><Trash2 size={15} /></button>
                </div>
              ))}
              {(liabs || []).length === 0 ? <p className="text-center text-sm text-muted-foreground py-6">{t('nw_no_liabilities')}</p> : null}
            </>
          )}
        </div>

        {adding ? (
          <div className="mt-4 rounded-2xl bg-zinc-100 border border-zinc-200/60 dark:bg-white/[0.04] dark:border-white/10 p-4 space-y-4">
            <Field label={tab === 'assets' ? t('nw_asset_name') || 'Asset name' : t('nw_liability_name') || 'Liability name'}><TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder={tab === 'assets' ? t('nw_asset_ph') || 'e.g. Property, Stocks' : t('nw_liability_ph') || 'e.g. Credit Card, Car Loan'} data-testid="nw-name" /></Field>
            <Field label={t('amount') || 'Amount'}>
              <div className="flex gap-2">
                <button type="button" onClick={() => setPickCur(true)} className="shrink-0 rounded-xl bg-background border border-border/60 px-3 py-3 flex items-center gap-1.5" data-testid="nw-currency">
                  <span className="font-bold text-sm">{getCurrency(currency).symbol} {currency}</span>
                  <ChevronRight size={15} className="text-muted-foreground" />
                </button>
                <TextInput type="text" inputMode="decimal" value={amount} onChange={(e) => setAmount(sanitizeAmount(e.target.value))} placeholder="0" className="flex-1 text-lg font-bold" data-testid="nw-amount" />
              </div>
            </Field>
            <div className="flex gap-2">
              <button type="button" onClick={() => setAdding(false)} className="flex-1 rounded-xl bg-background border border-border/60 py-2.5 font-medium text-sm">{t('cancel')}</button>
              <button type="button" onClick={save} disabled={!name.trim() || !(Number(amount) || 0)} className={cn('flex-1 rounded-xl bg-foreground text-background py-2.5 font-semibold text-sm', (!name.trim() || !(Number(amount) || 0)) && 'opacity-40')} data-testid="nw-save">{t('save')}</button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={openAdd} className="mt-4 w-full rounded-xl border border-dashed border-border py-3.5 font-semibold text-[15px] flex items-center justify-center gap-2 text-muted-foreground" data-testid="nw-add">
            <Plus size={18} /> {tab === 'assets' ? 'Add Asset' : 'Add Liability'}
          </button>
        )}
        <div className="h-6" />
      </Sheet>
      <CurrencySheet open={pickCur} onClose={() => setPickCur(false)} value={currency} onSelect={setCurrency} zIndex={80} />
    </>
  )
}
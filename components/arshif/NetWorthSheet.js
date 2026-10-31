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
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

const ASSET_CATS = [
  { id: 'cash', label: 'Cash' },
  { id: 'property', label: 'Property' },
  { id: 'vehicle', label: 'Vehicle' },
  { id: 'investments', label: 'Investments' },
  { id: 'crypto', label: 'Crypto' },
  { id: 'business', label: 'Business' },
  { id: 'other_asset', label: 'Other' },
]
const LIAB_CATS = [
  { id: 'loan', label: 'Loan / KTA' },
  { id: 'credit_card', label: 'Credit Card' },
  { id: 'bnpl', label: 'PayLater' },
  { id: 'mortgage', label: 'KPR' },
  { id: 'other_liab', label: 'Other' },
]

const KEY_A = 'arshif_networth_assets'
const KEY_L = 'arshif_networth_liabs'
const KEY_S = 'arshif_guest_nw_snap'
const lsGet = (k) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : [] } catch { return [] } }
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} }
const uid = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `n_${Date.now()}_${Math.random().toString(36).slice(2)}`)

export default function NetWorthSheet({ open, onClose }) {
  const { t, home, fmt, accounts = [], convertToHome, store } = useApp()
  const [tab, setTab] = useState('assets')
  const [assets, setAssets] = useState([])
  const [liabs, setLiabs] = useState([])
  const [snapshots, setSnapshots] = useState([])
  const [adding, setAdding] = useState(false)
  const [pickCur, setPickCur] = useState(false)
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState(home)
  const [category, setCategory] = useState('other')

  useEffect(() => {
    if (!open) return
    setTab('assets'); setAdding(false)
    setAssets(lsGet(KEY_A)); setLiabs(lsGet(KEY_L))
    const load = async () => {
      try {
        const snap = await (store?.listNetWorthSnapshots?.()) || []
        setSnapshots(Array.isArray(snap) ? snap : [])
      } catch { setSnapshots(lsGet(KEY_S)) }
    }
    load()
  }, [open, store])

  useEffect(() => { lsSet(KEY_A, assets) }, [assets])
  useEffect(() => { lsSet(KEY_L, liabs) }, [liabs])

  const toHome = (amt, cur) => {
    const raw = Number(amt) || 0
    try { const v = convertToHome ? convertToHome(raw, cur || home) : raw; return isFinite(v) && !isNaN(v) ? v : raw } catch { return raw }
  }

  const totals = useMemo(() => {
    const accountAssets = (accounts || []).reduce((s, a) => {
      if (String(a?.type || '').toLowerCase() === 'credit_card' || signedAccountBalance(a) < 0) return s
      return s + toHome(a?.balance, a?.currency)
    }, 0)
    const accountLiabs = (accounts || []).reduce((s, a) => {
      if (signedAccountBalance(a) >= 0) return s
      return s + Math.abs(toHome(signedAccountBalance(a), a?.currency))
    }, 0)
    const manualA = (assets || []).reduce((s, a) => s + toHome(a?.amount, a?.currency), 0)
    const manualLiabs = (liabs || []).reduce((s, l) => s + toHome(l?.amount, l?.currency), 0)
    return {
      totalAssets: accountAssets + manualA,
      totalLiab: accountLiabs + manualLiabs,
      net: (accountAssets + manualA) - (accountLiabs + manualLiabs),
      accountAssets, accountLiabs, manualAssets: manualA, manualLiabs: manualLiabs,
    }
  }, [accounts, assets, liabs, home, convertToHome])

  const assetByCat = useMemo(() => {
    const m = {}
    ;(assets || []).forEach((a) => { const c = a?.category || 'other'; m[c] = (m[c] || 0) + toHome(a?.amount, a?.currency) })
    return Object.entries(m).sort((a, b) => b[1] - a[1])
  }, [assets])

  const liabByCat = useMemo(() => {
    const m = {}
    ;(liabs || []).forEach((l) => { const c = l?.category || 'other'; m[c] = (m[c] || 0) + toHome(l?.amount, l?.currency) })
    return Object.entries(m).sort((a, b) => b[1] - a[1])
  }, [liabs])

  const trendData = useMemo(() => {
    if (!snapshots.length) return []
    return snapshots.map((s) => ({
      month: s.month,
      netWorth: toHome(s.net_worth, s.currency || home),
      assets: toHome(s.total_assets, s.currency || home),
      liab: toHome(s.total_liabilities, s.currency || home),
    }))
  }, [snapshots, home, toHome])

  const estimatedTrend = useMemo(() => {
    const last = trendData[trendData.length - 1]
    if (!last) return []
    const nowKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
    const existing = trendData.find((d) => d.month === nowKey)
    if (existing) return trendData
    return [...trendData, { month: nowKey, netWorth: totals.net, assets: totals.totalAssets, liab: totals.totalLiab }]
  }, [trendData, totals])

  const openAdd = () => { setName(''); setAmount(''); setCurrency(home); setCategory('other'); setAdding(true) }
  const save = async () => {
    if (!name.trim() || !(Number(amount) || 0)) return
    const row = { id: uid(), name: name.trim(), amount: Number(amount) || 0, currency, category, type: tab === 'assets' ? 'asset' : 'liability' }
    try {
      if (store?.createNetWorthEntry) {
        await store.createNetWorthEntry(row)
        if (tab === 'assets') { setAssets((prev) => [...(prev || []), row]) }
        else { setLiabs((prev) => [...(prev || []), row]) }
      } else {
        if (tab === 'assets') { const next = [...(assets || []), row]; setAssets(next); lsSet(KEY_A, next) }
        else { const next = [...(liabs || []), row]; setLiabs(next); lsSet(KEY_L, next) }
      }
      setAdding(false); toast.success(t('saved_msg'))
    } catch (e) { toast.error(e?.message || t('error')) }
  }
  const removeAsset = async (id) => {
    try { if (store?.deleteNetWorthEntry) await store.deleteNetWorthEntry(id) } catch {}
    const next = (assets || []).filter((x) => x?.id !== id); setAssets(next); lsSet(KEY_A, next)
  }
  const removeLiab = async (id) => {
    try { if (store?.deleteNetWorthEntry) await store.deleteNetWorthEntry(id) } catch {}
    const next = (liabs || []).filter((x) => x?.id !== id); setLiabs(next); lsSet(KEY_L, next)
  }

  const cardCls = 'flex items-center gap-3 rounded-2xl bg-zinc-100 border border-zinc-200/60 dark:bg-white/[0.04] dark:border-white/10 px-4 py-3.5'
  const catLabel = (id) => {
    const pool = tab === 'assets' ? ASSET_CATS : LIAB_CATS
    return pool.find((c) => c.id === id)?.label || id
  }

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
              <p className="font-bold tabular-nums mt-0.5 text-rose-300" data-testid="nw-liab">{fmt(totals.totalLiab, home)}</p>
            </div>
          </div>
          {(totals.accountAssets > 0 || totals.manualAssets > 0 || totals.totalLiab > 0) ? (
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] opacity-70">
              {totals.accountAssets > 0 ? <span>Accounts: {fmt(totals.accountAssets, home)}</span> : null}
              {totals.manualAssets > 0 ? <span>Manual: {fmt(totals.manualAssets, home)}</span> : null}
            </div>
          ) : null}
        </div>

        {/* Trend Chart */}
        {trendData.length > 0 ? (
          <div className="mt-4 rounded-2xl bg-card border border-border/40 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-3">{t('nw_trend', 'Net Worth Trend')}</p>
            <ResponsiveContainer width="100%" height={120}>
              <AreaChart data={estimatedTrend} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="nwGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--foreground))" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="hsl(var(--foreground))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted-foreground)/0.15)" vertical={false} />
                <XAxis dataKey="month" tickFormatter={(v) => v.slice(5)} axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                <YAxis hide domain={['auto', 'auto']} />
                <Tooltip formatter={(v) => fmt(Number(v), home)} labelFormatter={(l) => l} contentStyle={{ fontSize: 12, borderRadius: 12 }} />
                <Area type="monotone" dataKey="netWorth" stroke="hsl(var(--foreground))" strokeWidth={2} fill="url(#nwGrad)" name="Net Worth" />
                <Area type="monotone" dataKey="liab" stroke="hsl(var(--rose-500))" strokeWidth={1.5} fill="transparent" name="Liabilities" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : null}

        {/* Tabs */}
        <Segmented className="mt-4" value={tab} onChange={(v) => { setTab(v); setAdding(false) }} options={[
          { id: 'assets', label: t('nw_assets', 'Assets') },
          { id: 'liabilities', label: t('nw_liabilities', 'Liabilities') },
          { id: 'breakdown', label: t('nw_breakdown', 'Breakdown') },
        ]} />

        {/* Breakdown view */}
        {tab === 'breakdown' ? (
          <div className="mt-4 space-y-5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">{t('nw_by_asset_cat', 'Assets by category')}</p>
              {assetByCat.length === 0 ? (
                <p className="text-xs text-muted-foreground py-3 text-center">{t('nw_no_assets', 'No manual assets yet')}</p>
              ) : (
                <div className="space-y-1.5">
                  {assetByCat.map(([cat, amt]) => (
                    <div key={cat} className="flex items-center gap-3">
                      <div className="w-24 text-xs text-muted-foreground truncate">{catLabel(cat)}</div>
                      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-foreground" style={{ width: `${Math.min(100, (amt / Math.max(1, totals.totalAssets)) * 100)}%` }} />
                      </div>
                      <span className="text-xs font-semibold tabular-nums w-24 text-right">{fmt(amt, home)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">{t('nw_by_liab_cat', 'Liabilities by category')}</p>
              {liabByCat.length === 0 ? (
                <p className="text-xs text-muted-foreground py-3 text-center">{t('nw_no_liabs', 'No manual liabilities yet')}</p>
              ) : (
                <div className="space-y-1.5">
                  {liabByCat.map(([cat, amt]) => (
                    <div key={cat} className="flex items-center gap-3">
                      <div className="w-24 text-xs text-muted-foreground truncate">{catLabel(cat)}</div>
                      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-rose-500" style={{ width: `${Math.min(100, (amt / Math.max(1, totals.totalLiab)) * 100)}%` }} />
                      </div>
                      <span className="text-xs font-semibold tabular-nums text-rose-600 dark:text-rose-400 w-24 text-right">{fmt(amt, home)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-2.5">
            {tab === 'assets' ? (
              <>
                {(accounts || []).filter((a) => signedAccountBalance(a) >= 0).map((a) => (
                  <div key={a.id} className={cardCls} data-testid="nw-account">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[15px] truncate">{a?.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{t('nw_account', 'Account')}</p>
                    </div>
                    <p className="font-bold tabular-nums text-[15px]">{fmt(a?.balance, a?.currency || home)}</p>
                  </div>
                ))}
                {(assets || []).map((a) => (
                  <div key={a.id} className={cardCls} data-testid="nw-asset-row">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[15px] truncate">{a?.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{a?.category ? catLabel(a.category) : t('nw_manual_asset', 'Manual asset')}</p>
                    </div>
                    <p className="font-bold tabular-nums text-[15px]">{fmt(a?.amount, a?.currency || home)}</p>
                    <button type="button" onClick={() => removeAsset(a?.id)} className="h-11 w-11 rounded-lg flex items-center justify-center text-muted-foreground hover:text-rose-500" aria-label="delete"><Trash2 size={15} /></button>
                  </div>
                ))}
                {(assets || []).length === 0 ? <p className="text-center text-sm text-muted-foreground py-6">{t('nw_no_assets', 'No manual assets yet')}</p> : null}
              </>
            ) : (
              <>
                {(accounts || []).filter((a) => signedAccountBalance(a) < 0).map((a) => (
                  <div key={a.id} className={cardCls} data-testid="nw-account-liability">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[15px] truncate">{a?.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{t('nw_credit_account', 'Credit account')}</p>
                    </div>
                    <p className="font-bold tabular-nums text-[15px] text-rose-600 dark:text-rose-400">{fmt(Math.abs(signedAccountBalance(a)), a?.currency || home)}</p>
                  </div>
                ))}
                {(liabs || []).map((l) => (
                  <div key={l.id} className={cardCls} data-testid="nw-liab-row">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[15px] truncate">{l?.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{l?.category ? catLabel(l.category) : t('nw_liability', 'Liability')}</p>
                    </div>
                    <p className="font-bold tabular-nums text-[15px] text-rose-600 dark:text-rose-400">{fmt(l?.amount, l?.currency || home)}</p>
                    <button type="button" onClick={() => removeLiab(l?.id)} className="h-11 w-11 rounded-lg flex items-center justify-center text-muted-foreground hover:text-rose-500" aria-label="delete"><Trash2 size={15} /></button>
                  </div>
                ))}
                {(liabs || []).length === 0 ? <p className="text-center text-sm text-muted-foreground py-6">{t('nw_no_liabilities', 'No liabilities found')}</p> : null}
              </>
            )}
          </div>
        )}

        {adding ? (
          <div className="mt-4 rounded-2xl bg-zinc-100 border border-zinc-200/60 dark:bg-white/[0.04] dark:border-white/10 p-4 space-y-4">
            <Field label={tab === 'assets' ? t('nw_asset_name') || 'Asset name' : t('nw_liability_name') || 'Liability name'}>
              <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder={tab === 'assets' ? t('nw_asset_ph', 'e.g. House, Car, Stocks') : t('nw_liability_ph', 'e.g. Loan, Credit Card')} data-testid="nw-name" />
            </Field>
            <Field label={t('nw_category', 'Category')}>
              <div className="flex flex-wrap gap-1.5">
                {(tab === 'assets' ? ASSET_CATS : LIAB_CATS).map((c) => (
                  <button key={c.id} type="button" onClick={() => setCategory(c.id)}
                    className={cn('px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer', category === c.id ? 'bg-foreground text-background border-transparent' : 'bg-muted/40 border-border/40 text-muted-foreground')}
                  >{c.label}</button>
                ))}
              </div>
            </Field>
            <Field label={t('amount', 'Amount')}>
              <div className="flex gap-2">
                <button type="button" onClick={() => setPickCur(true)} className="shrink-0 rounded-xl bg-background border border-border/60 px-3 py-3 flex items-center gap-1.5" data-testid="nw-currency">
                  <span className="font-bold text-sm">{getCurrency(currency).symbol}</span>
                  <ChevronRight size={15} className="text-muted-foreground" />
                </button>
                <TextInput type="text" inputMode="decimal" value={amount} onChange={(e) => setAmount(sanitizeAmount(e.target.value))} placeholder="0" className="flex-1 text-lg font-bold" data-testid="nw-amount" />
              </div>
            </Field>
            <div className="flex gap-2">
              <button type="button" onClick={() => setAdding(false)} className="flex-1 rounded-xl bg-background border border-border/60 py-2.5 font-medium text-sm">{t('cancel', 'Cancel')}</button>
              <button type="button" onClick={save} disabled={!name.trim() || !(Number(amount) || 0)} className={cn('flex-1 rounded-xl bg-foreground text-background py-2.5 font-semibold text-sm', (!name.trim() || !(Number(amount) || 0)) && 'opacity-40')} data-testid="nw-save">{t('save', 'Save')}</button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={openAdd} className="mt-4 w-full rounded-xl border border-dashed border-border py-3.5 font-semibold text-[15px] flex items-center justify-center gap-2 text-muted-foreground" data-testid="nw-add">
            <Plus size={18} /> {tab === 'assets' ? t('nw_add_asset', 'Add Asset') : t('nw_add_liability', 'Add Liability')}
          </button>
        )}
        <div className="h-6" />
      </Sheet>
      <CurrencySheet open={pickCur} onClose={() => setPickCur(false)} value={currency} onSelect={setCurrency} zIndex={80} />
    </>
  )
}

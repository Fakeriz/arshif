'use client'
import { useEffect, useMemo, useState } from 'react'
import { 
  ChevronRight, Search, Check, Ban, 
  CreditCard, Wallet, Banknote, Landmark, 
  Smartphone, BarChart3, Briefcase 
} from 'lucide-react'
import { toast } from 'sonner'
import { useApp } from './context'
import { Sheet, LogoBadge } from './ui'
import CurrencySheet from './CurrencySheet'
import { BankCard, CardMotifTexture, EmvChip, ContactlessWave } from './BankCard'
import { CARD_THEMES, BANK_LOGOS, ACCOUNT_TYPES, ACCOUNT_ICONS, getTheme } from '@/lib/categories'
import { getCurrency, roundMoney } from '@/lib/currencies'
import { convert, getRate } from '@/lib/rates'
import { cn } from '@/lib/utils'
import { sanitizeAmount } from '@/lib/amount'

// Country filter tabs — Order: [All] -> [Indonesia] -> [Turkey] -> [Malaysia]
const COUNTRY_TABS = [
  { id: 'all', labelKey: 'all', defaultLabel: 'All' },
  { id: 'id', labelKey: 'indonesia', defaultLabel: 'Indonesia' },
  { id: 'tr', labelKey: 'turkey', defaultLabel: 'Turkey' },
  { id: 'my', labelKey: 'malaysia', defaultLabel: 'Malaysia' },
]

// Pemetaan kunci nama string ke komponen Lucide React
const ICON_MAP = {
  card: CreditCard,
  creditcard: CreditCard,
  wallet: Wallet,
  cash: Banknote,
  banknote: Banknote,
  bank: Landmark,
  bankbuilding: Landmark,
  landmark: Landmark,
  phone: Smartphone,
  smartphone: Smartphone,
  chart: BarChart3,
  barchart3: BarChart3,
  business: Briefcase,
  briefcase: Briefcase,
}

// Adaptive input styling: light grey on light mode, obsidian on dark mode.
const INPUT_CLS = 'w-full bg-zinc-100 dark:bg-[#1c1c1e] border border-zinc-200 dark:border-white/10 text-zinc-950 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 outline-none focus:border-zinc-400 dark:focus:border-white/25'

// Exported PreviewCard — delegates to BankCard with exact physical card anatomy
export function PreviewCard({ name, balance, currency, theme, logo, icon = 'card', type, id, fmt, className }) {
  return (
    <BankCard
      name={name}
      balance={balance}
      currency={currency}
      theme={theme}
      logo={logo}
      icon={icon}
      type={type}
      id={id}
      fmt={fmt}
      className={className}
    />
  )
}

export default function NewAccountSheet({ open, onClose }) {
  const { t, home, accounts = [], store, refresh, fmt, rates } = useApp()
  const [name, setName] = useState('')
  const [type, setType] = useState('bank')
  const [icon, setIcon] = useState('card')
  const [currency, setCurrency] = useState(home)
  const [theme, setTheme] = useState('parang')
  const [logo, setLogo] = useState(null)
  const [tab, setTab] = useState('all')
  const [query, setQuery] = useState('')
  const [source, setSource] = useState('new')
  const [fromId, setFromId] = useState(null)
  const [balance, setBalance] = useState('')
  const [pickCur, setPickCur] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setName('')
    setType('bank')
    setIcon('card')
    setCurrency(home)
    setTheme('parang')
    setLogo(null)
    setTab('all')
    setQuery('')
    setSource('new')
    setFromId(accounts[0]?.id || null)
    setBalance('')
  }, [open]) // eslint-disable-line

  const logos = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (BANK_LOGOS || []).filter(
      (l) => l.country !== 'generic' && (tab === 'all' || l.country === tab) && (!q || l.name.toLowerCase().includes(q))
    )
  }, [tab, query])

  const activeTheme = getTheme(theme)
  const num = parseFloat(balance) || 0
  const canSave = name.trim().length > 0 && (source === 'new' || fromId)

  // Sanitasi input nominal via shared utility (koma -> titik, max 2 desimal).
  const handleAmountChange = (e) => setBalance(sanitizeAmount(e.target.value))

  const create = async () => {
    if (!canSave || saving) return
    setSaving(true)
    try {
      const acc = await store.createAccount({
        name: name.trim(),
        type,
        icon,
        currency,
        balance: roundMoney(num, currency),
        theme,
        logo,
        country: tab === 'all' ? null : tab,
      })
      if (source === 'split' && fromId && num > 0) {
        const from = accounts.find((a) => a.id === fromId)
        if (from) {
          const delta = convert(num, currency, from.currency, rates)
          await store.updateAccount(from.id, { balance: roundMoney((Number(from.balance) || 0) - delta, from.currency) })
          await store.createTransaction({
            type: 'transfer',
            amount: roundMoney(num, currency),
            currency,
            home_currency: home,
            home_currency_amount: roundMoney(convert(num, currency, home, rates), home),
            rate: getRate(currency, home, rates),
            category: 'transfer',
            payment_method: 'bank',
            account_id: from.id,
            to_account_id: acc?.id,
            fee: 0,
            note: `${t('opening_balance')}: ${name.trim()}`,
            items: [],
            tax_deductible: false,
            date: new Date().toISOString(),
          })
        }
      }
      await refresh()
      toast.success(t('saved_msg'))
      onClose?.()
    } catch (e) {
      toast.error(e?.missingTable ? t('db_missing') : e?.message || t('error'))
    } finally {
      setSaving(false)
    }
  }

  const Label = ({ children, right }) => (
    <div className="flex items-center justify-between mb-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-600 dark:text-zinc-400">{children}</p>
      {right ? <span className="text-[12px] font-bold text-zinc-950 dark:text-white">{right}</span> : null}
    </div>
  )

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        full
        noPadding
        className="bg-white dark:bg-[#121214] text-zinc-950 dark:text-white"
        title={t('new_account')}
        left={
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-semibold text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white transition-colors"
          >
            {t('cancel')}
          </button>
        }
        right={
          <button
            type="button"
            onClick={create}
            disabled={!canSave || saving}
            className={cn('text-[15px] font-bold py-1 px-1 text-zinc-950 dark:text-white', (!canSave || saving) && 'opacity-40')}
            data-testid="account-save"
          >
            {saving ? '...' : (t('create_btn') || t('create'))}
          </button>
        }
      >
        <div className="p-4 space-y-6">
          {/* Card Preview with realistic EMV chip, contactless wave, chosen motif and icon fallback */}
          <PreviewCard
            name={name || t('new_account')}
            balance={num}
            currency={currency}
            theme={theme}
            logo={logo}
            icon={icon}
            type={type}
            fmt={fmt}
          />

          {/* Section 1 — CARD DESIGN */}
          <section>
            <Label right={activeTheme?.name}>{t('card_design')}</Label>
            <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4 py-1.5">
              {CARD_THEMES.map((th) => {
                const active = theme === th.id
                return (
                  <button
                    key={th.id}
                    type="button"
                    onClick={() => setTheme(th.id)}
                    className="shrink-0 relative group flex flex-col items-center"
                    data-testid={`theme-${th.id}`}
                  >
                    <div
                      className={cn(
                        'h-14 w-[84px] rounded-xl p-1.5 relative overflow-hidden flex flex-col justify-between shadow-sm transition-transform active:scale-95',
                        th.className,
                        active && 'ring-2 ring-zinc-950 dark:ring-white ring-offset-2 ring-offset-white dark:ring-offset-[#121214]'
                      )}
                    >
                      <CardMotifTexture motif={th.motif} isLight={th.isLight} />
                      <div className="flex items-center justify-between relative z-10">
                        <EmvChip isLight={th.isLight} className="w-5 h-3.5 rounded-sm" />
                        <ContactlessWave className="w-2.5 h-2.5 opacity-70" />
                      </div>
                      <span className={cn('text-[9px] font-bold truncate relative z-10 leading-tight', th.isLight ? 'text-zinc-950' : 'text-white')}>
                        {th.name}
                      </span>
                    </div>
                    {active ? (
                      <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 flex items-center justify-center shadow ring-2 ring-white dark:ring-zinc-900 z-20">
                        <Check size={11} strokeWidth={3} />
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </div>
          </section>

          {/* Section 2 — ACCOUNT DETAILS */}
          <section>
            <Label>{t('account_details')}</Label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('account_name_ph')}
              className={cn(INPUT_CLS, 'px-4 py-3 rounded-xl text-[15px] font-semibold')}
              data-testid="account-name"
            />
          </section>

          {/* Section 3 — TYPE */}
          <section>
            <Label>{t('account_type')}</Label>
            <div className="grid grid-cols-3 gap-2">
              {ACCOUNT_TYPES.map((ty) => {
                const active = type === ty.id
                return (
                  <button
                    key={ty.id}
                    type="button"
                    onClick={() => setType(ty.id)}
                    className={cn(
                      'rounded-xl py-2.5 text-sm transition-colors',
                      active
                        ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 font-bold'
                        : 'bg-zinc-100 dark:bg-[#1c1c1e] border border-zinc-200 dark:border-white/10 text-zinc-700 dark:text-zinc-300 font-medium'
                    )}
                    data-testid={`type-${ty.id}`}
                  >
                    {ty.label}
                  </button>
                )
              })}
            </div>
          </section>

{/* Section 4 — ICON (Horizontal Swipeable Row) */}
          <section>
            <Label>{t('account_icon')}</Label>
            <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar snap-x touch-pan-x py-1 -mx-4 px-4">
              {(ACCOUNT_ICONS || []).map((ic) => {
                const iconKey = String(ic.id || ic.icon || '').toLowerCase()
                const IconComponent = ICON_MAP[iconKey] || CreditCard
                const active = icon === ic.id

                return (
                  <button
                    key={ic.id}
                    type="button"
                    onClick={() => {
                      setIcon(ic.id)
                      setLogo(null)
                    }}
                    className={cn(
                      'w-11 h-11 rounded-2xl flex items-center justify-center border shrink-0 snap-start transition-all active:scale-95',
                      active
                        ? 'bg-zinc-200/90 text-zinc-950 border-zinc-400 ring-2 ring-zinc-950 dark:bg-white dark:text-zinc-950 dark:border-white dark:ring-white'
                        : 'bg-zinc-100 border-zinc-200 text-zinc-700 hover:bg-zinc-200/60 dark:bg-[#1c1c1e] dark:border-white/10 dark:text-zinc-400 dark:hover:bg-zinc-800'
                    )}
                    title={ic.id}
                    data-testid={`icon-${ic.id}`}
                  >
                    <IconComponent size={20} strokeWidth={1.8} />
                  </button>
                )
              })}
            </div>
          </section>

          {/* Section 5 — BANK / E-WALLET (OPTIONAL) */}
          <section>
            <Label>{t('bank_ewallet_opt')}</Label>
            <div className="w-full py-2 box-border">
              <div className="relative flex items-center w-full">
                <Search className="absolute left-3.5 text-muted-foreground pointer-events-none shrink-0" size={16} />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t('search_bank_ph')}
                  className="w-full pl-10 pr-4 py-2.5 rounded-2xl text-sm bg-muted/40 border border-border/40 text-foreground placeholder-muted-foreground outline-none focus:border-border transition-colors"
                  data-testid="logo-search"
                />
              </div>
            </div>
            
            {/* Country tabs */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 mt-3">
              {COUNTRY_TABS.map((c) => {
                const active = tab === c.id
                const tabLabel = t(c.labelKey) || c.defaultLabel
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setTab(c.id)}
                    className={cn(
                      'shrink-0 rounded-full px-3.5 py-1.5 text-sm whitespace-nowrap transition-colors',
                      active
                        ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 font-bold'
                        : 'bg-zinc-100 dark:bg-[#1c1c1e] border border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-zinc-400 font-medium'
                    )}
                    data-testid={`country-${c.id}`}
                  >
                    {tabLabel}
                  </button>
                )
              })}
            </div>

            {/* Bank Selector */}
            <div className="flex items-start gap-2.5 overflow-x-auto py-2 no-scrollbar snap-x touch-pan-x mt-2">
              {/* None option */}
              <button
                type="button"
                onClick={() => setLogo(null)}
                className="shrink-0 snap-start flex flex-col items-center group"
                data-testid="logo-none"
              >
                <div
                  className={cn(
                    'w-12 h-12 rounded-xl flex items-center justify-center border-2 border-dashed transition-all group-active:scale-95',
                    logo === null
                      ? 'border-zinc-950 bg-zinc-950/10 text-zinc-950 dark:border-white dark:bg-white/10 dark:text-white'
                      : 'border-zinc-300 dark:border-white/25 text-zinc-400 dark:text-zinc-500 hover:border-zinc-400'
                  )}
                >
                  <Ban size={20} strokeWidth={1.8} />
                </div>
                <span className="w-12 h-4 text-[11px] leading-4 truncate text-center mt-1 text-zinc-600 dark:text-zinc-400 font-medium">
                  {t('none')}
                </span>
              </button>

              {logos.map((l) => {
                const active = logo === l.id
                return (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => setLogo(active ? null : l.id)}
                    className="shrink-0 snap-start flex flex-col items-center group"
                    data-testid={`logo-${l.id}`}
                  >
                    <div
                      className={cn(
                        'w-12 h-12 rounded-xl border-2 transition-all flex items-center justify-center group-active:scale-95 overflow-hidden',
                        active
                          ? 'border-zinc-950 dark:border-white ring-2 ring-zinc-950/20 dark:ring-white/20'
                          : 'border-transparent'
                      )}
                    >
                      <LogoBadge logoId={l.id} size="bank" />
                    </div>
                    <span className="w-12 h-4 text-[11px] leading-4 truncate text-center mt-1 text-zinc-600 dark:text-zinc-400 font-medium">
                      {l.name}
                    </span>
                  </button>
                )
              })}
            </div>
          </section>

          {/* Section 6 — OPENING BALANCE */}
          <section>
            <Label>{t('opening_balance')}</Label>
            <div className="flex bg-zinc-100 dark:bg-[#1c1c1e] border border-zinc-200 dark:border-white/10 rounded-xl p-1 gap-1">
              {[{ id: 'split', label: t('split_from') }, { id: 'new', label: t('new_money') }].map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setSource(o.id)}
                  className={cn(
                    'flex-1 rounded-lg py-2 text-sm transition-colors',
                    source === o.id
                      ? 'bg-white text-zinc-950 font-bold dark:bg-zinc-800 dark:text-white shadow-sm'
                      : 'text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white font-medium'
                  )}
                  data-testid={`source-${o.id}`}
                >
                  {o.label}
                </button>
              ))}
            </div>
            {source === 'split' ? (
              <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 pt-2.5">
                {accounts.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setFromId(a.id)}
                    className={cn(
                      'shrink-0 rounded-xl px-3 py-2 text-sm whitespace-nowrap transition-colors',
                      fromId === a.id
                        ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 font-bold'
                        : 'bg-zinc-100 dark:bg-[#1c1c1e] border border-zinc-200 dark:border-white/10 text-zinc-700 dark:text-zinc-300 font-medium'
                    )}
                  >
                    {a.name} · {fmt(a.balance, a.currency)}
                  </button>
                ))}
              </div>
            ) : null}
            <div className="flex gap-2 mt-2.5">
              <button
                type="button"
                onClick={() => setPickCur(true)}
                className="shrink-0 rounded-xl bg-zinc-100 dark:bg-[#1c1c1e] border border-zinc-200 dark:border-white/10 px-3.5 py-3 flex items-center gap-1.5 text-zinc-950 dark:text-white"
                data-testid="account-currency"
              >
                <span className="font-bold text-sm">{getCurrency(currency).symbol} {currency}</span>
                <ChevronRight size={15} className="text-zinc-500 dark:text-zinc-400" />
              </button>
              <input
                type="text"
                inputMode="decimal"
                value={balance}
                onChange={handleAmountChange}
                placeholder="0"
                className={cn(INPUT_CLS, 'flex-1 px-4 py-3 rounded-xl text-lg font-bold tabular-nums')}
                data-testid="account-balance"
              />
            </div>
          </section>

          <button
            type="button"
            onClick={create}
            disabled={!canSave || saving}
            className={cn(
              'w-full rounded-xl bg-zinc-950 text-white hover:bg-zinc-900 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 font-bold py-3.5 text-[15px] transition-all active:scale-[0.98]',
              (!canSave || saving) && 'opacity-40 active:scale-100'
            )}
            data-testid="account-create-btn"
          >
            {saving ? '...' : (t('create_btn') || t('create'))}
          </button>
          <div className="h-2" />
        </div>
      </Sheet>
      <CurrencySheet open={pickCur} onClose={() => setPickCur(false)} value={currency} onSelect={setCurrency} zIndex={70} />
    </>
  )
}
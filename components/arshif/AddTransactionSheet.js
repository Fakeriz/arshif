'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronRight, Calculator, Camera, Delete, Check, X, FileText, Search, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { useApp } from './context'
import { Sheet, SheetTextButton, Segmented, Pill, Field, TextInput, CategoryBadge, CategoryIcon, Card, SectionLabel, Switch } from './ui'
import CurrencySheet from './CurrencySheet'
import { CATEGORIES, PAYMENT_METHODS } from '@/lib/categories'
import { getCurrency, roundMoney } from '@/lib/currencies'
import { convert, getRate, formatRate } from '@/lib/rates'
import { applyTxToBalances, evaluateExpression, toLocalDatetimeValue, fileToDataUrl } from '@/lib/ledger'
import { cn } from '@/lib/utils'
import { sanitizeAmount } from '@/lib/amount'
import { useHaptic } from '@/hooks/useHaptic'
import { getDriveThumbnailUrl } from './ReceiptPreviewWithDrive'

const KEYS = ['7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '−', '.', '0', '⌫', '+']

export default function AddTransactionSheet({ open, isOpen: propIsOpen, onClose, initial, transaction }) {
  const isOpen = open ?? propIsOpen
  const init = initial ?? transaction
  const { t, home, rates, accounts = [], store, refresh, fmt, transactions = [], open: openSheet, isAiAllowed, saveTransaction } = useApp()
  const haptic = useHaptic()
  const [type, setType] = useState('expense')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState(home)
  const [category, setCategory] = useState('food')
  const [payment, setPayment] = useState('cash')
  const [accountId, setAccountId] = useState(null)
  const [toAccountId, setToAccountId] = useState(null)
  const [time, setTime] = useState(() => `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`)
  const [date, setDate] = useState(toLocalDatetimeValue(new Date()))
  const [note, setNote] = useState('')
  const [receipt, setReceipt] = useState(null)
  const [items, setItems] = useState([])
  const [merchant, setMerchant] = useState('')
  const [receiptNumber, setReceiptNumber] = useState('')
  const [tax, setTax] = useState(false)
  const [showFee, setShowFee] = useState(false)
  const [fee, setFee] = useState('')
  const [showCalc, setShowCalc] = useState(false)
  const [pickCurrency, setPickCurrency] = useState(false)
  const [pickCategory, setPickCategory] = useState(false)
  const [catSearch, setCatSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const fileRef = useRef(null)
  const editId = init?.editId || null

  useEffect(() => {
    if (!isOpen) return
    const ini = init || {}
    const pad = (n) => String(n).padStart(2, '0')
    const now = new Date()
    const defaultTime = `${pad(now.getHours())}:${pad(now.getMinutes())}`
    const scanned = ini

    // Sinkronisasi jam dari hasil scan struk agar akurat dan tidak default ke 08:00 AM
    const validTime = scanned.time || defaultTime
    setTime(validTime)

    setType(ini.type || 'expense')
    setAmount(ini.amount ? String(ini.amount) : '')
    setCurrency(ini.currency || home)
    setCategory(ini.category || (ini.type === 'income' ? 'salary' : 'food'))
    setPayment(ini.payment_method || 'cash')
    let accId = ini.account_id || null
    if (!accId && ini.account_name) {
      const m = accounts.find((a) => a.name?.toLowerCase().includes(String(ini.account_name).toLowerCase()) || String(ini.account_name).toLowerCase().includes(a.name?.toLowerCase()))
      accId = m?.id || null
    }
    if (!accId && !ini.editId && ini.account_id !== null) accId = accounts[0]?.id || null
    setAccountId(accId)
    setToAccountId(ini.to_account_id || accounts.find((a) => a.id !== accId)?.id || null)

    let dtVal = ''
    if (scanned.transaction_date && typeof scanned.transaction_date === 'string' && scanned.transaction_date.includes('T')) {
      dtVal = scanned.transaction_date.slice(0, 16)
    } else if (typeof scanned.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(scanned.date)) {
      dtVal = `${scanned.date}T${validTime}`
    } else if (typeof scanned.date === 'string' && scanned.date.includes('T')) {
      const parts = scanned.date.split('T')
      dtVal = `${parts[0]}T${scanned.time || (parts[1].startsWith('00:00') ? validTime : parts[1].slice(0, 5))}`
    } else if (scanned.date) {
      dtVal = toLocalDatetimeValue(scanned.date)
    } else {
      dtVal = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${validTime}`
    }
    setDate(dtVal)

    setNote(ini.note || '')
    const previewSrc = ini.receipt_preview || ini.receipt_url || null
    setReceipt(
      previewSrc
        ? {
            dataUrl: previewSrc,
            driveUrl: ini.receipt_url?.includes('drive.google.com') ? ini.receipt_url : null,
            name: ini.merchant ? `Struk ${ini.merchant}` : 'receipt',
            isPdf: typeof previewSrc === 'string' && (previewSrc.endsWith('.pdf') || previewSrc.includes('application/pdf')),
          }
        : null
    )
    setItems(Array.isArray(ini.items) ? ini.items : [])
    setMerchant(ini.merchant || '')
    setReceiptNumber(ini.receipt_number || '')
    setTax(!!ini.tax_deductible)
    setFee(ini.fee ? String(ini.fee) : '')
    setShowFee(!!ini.fee)
    setShowCalc(false)
  }, [isOpen]) // eslint-disable-line

  const num = useMemo(() => evaluateExpression(amount), [amount])
  const isForeign = currency !== home
  const converted = convert(num, currency, home, rates)
  const rate = getRate(currency, home, rates)
  const cur = getCurrency(currency)
  const title = type === 'expense' ? t('add_expense') : type === 'income' ? t('add_income') : t('add_transfer')
  const canSave = num > 0 && (type !== 'transfer' || (accountId && toAccountId && accountId !== toAccountId))

  const pressKey = (k) => {
    haptic?.buttonPress?.()
    if (k === '⌫') return setAmount((a) => a.slice(0, -1))
    if (k === '=') return setAmount(String(roundMoney(evaluateExpression(amount), currency)))
    setAmount((a) => a + k)
  }

  const onFile = async (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    try {
      const dataUrl = await fileToDataUrl(f, 1000)
      setReceipt({ dataUrl: f.type?.startsWith('image/') ? dataUrl : null, name: f.name, isPdf: !f.type?.startsWith('image/') })
    } catch { toast.error(t('error')) }
  }

  const save = async () => {
    if (!canSave || saving) return
    setSaving(true)
    try {
      const finalAmount = roundMoney(num, currency)

      // Fallback: Jika accountId masih kosong/null, gunakan akun pertama yang tersedia
      const resolvedAccountId = accountId || accounts?.[0]?.id || null

      const tx = {
        type,
        amount: finalAmount,
        currency,
        home_currency: home,
        home_currency_amount: roundMoney(convert(finalAmount, currency, home, rates), home),
        rate,
        category: type === 'transfer' ? 'transfer' : category,
        payment_method: type === 'transfer' ? 'bank' : payment,
        account_id: resolvedAccountId, // <-- Pastikan terisi ID akun
        to_account_id: type === 'transfer' ? toAccountId : null,
        fee: type === 'transfer' && showFee ? Number(fee) || 0 : 0,
        note: note || null,
        merchant: merchant || null,
        receipt_number: receiptNumber || null,
        receipt_url: receipt?.driveUrl || (receipt?.dataUrl?.includes('drive.google.com') ? receipt.dataUrl : (initial?.receipt_url || receipt?.dataUrl || null)),
        storage_provider: initial?.storage_provider || (receipt?.driveUrl || receipt?.dataUrl?.includes('drive.google.com') || initial?.receipt_url?.includes('drive.google.com') ? 'google_drive' : 'local'),
        items: items?.length ? items : [],
        tax_deductible: type === 'expense' ? tax : false,
        date: new Date(date).toISOString(),
        transaction_date: new Date(date).toISOString(),
      }

      // Trigger haptic feedback for successful transaction
      haptic?.successfulTransaction?.()

      // Close immediately & notify for instantaneous UI feedback
      onClose?.()
      toast.success(t('saved_msg'))

      // Data URL struk masuk tx.receipt_cache (kolom DB) lewat create/update —
      // ikut sinkron antar-perangkat, bukan localStorage.
      if (receipt?.dataUrl && receipt.dataUrl.startsWith('data:') && !tx.receipt_cache) {
        tx.receipt_cache = receipt.dataUrl
      }

      if (saveTransaction) {
        await saveTransaction(tx, editId)
      } else {
        if (editId) {
          const old = transactions.find((x) => x.id === editId)
          if (old) await applyTxToBalances(store, accounts, old, -1, rates)
          await store.updateTransaction(editId, tx)
        } else {
          await store.createTransaction(tx)
        }
        await applyTxToBalances(store, accounts, tx, 1, rates)
        if (refresh) await refresh()
      }
    } catch (e) {
      toast.error(e?.missingTable ? t('db_missing') : e?.message || t('error'))
    } finally {
      setSaving(false)
    }
  }

  const accountPills = (value, onChange, allowNone = true) => (
    <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5">
      {accounts.map((a) => <Pill key={a.id} active={value === a.id} onClick={() => onChange(a.id)}>{a.name}</Pill>)}
      {allowNone ? <Pill active={!value} onClick={() => onChange(null)}>{t('no_account_opt')}</Pill> : null}
    </div>
  )

  return (
    <>
      <Sheet
        open={isOpen}
        onClose={onClose}
        full
        title={title}
        left={<SheetTextButton muted onClick={onClose} data-testid="tx-cancel">{t('cancel')}</SheetTextButton>}
        right={<SheetTextButton bold onClick={save} className={cn(!canSave && 'opacity-40')} data-testid="tx-save">{saving ? '...' : t('save')}</SheetTextButton>}
      >
        <Segmented value={type} onChange={(v) => { setType(v); if (v === 'income' && ['food', 'groceries', 'transport'].includes(category)) setCategory('salary'); if (v === 'expense' && ['salary', 'freelance'].includes(category)) setCategory('food') }} options={[{ id: 'expense', label: t('expense') }, { id: 'income', label: t('income_tab') }, { id: 'transfer', label: t('transfer') }]} className="mt-1" />

        {/* Amount */}
        <div className="mt-6 text-center">
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setPickCurrency(true)}
              className="rounded-xl bg-white dark:bg-[#1c1c1e] border border-zinc-200 dark:border-white/10 px-3.5 py-1.5 text-sm font-bold text-zinc-950 dark:text-white flex items-center gap-1.5 shadow-sm active:scale-95 transition-transform"
              data-testid="currency-pill"
            >
              <span>{currency}</span>
              <ChevronRight size={14} className="text-zinc-400 dark:text-zinc-500" />
            </button>
            <button
              type="button"
              onClick={() => setShowCalc(!showCalc)}
              className={cn(
                'h-9 w-9 rounded-xl border flex items-center justify-center transition-colors',
                showCalc
                  ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 border-transparent'
                  : 'bg-white dark:bg-[#1c1c1e] text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-white/10'
              )}
              aria-label="calculator"
              data-testid="calc-toggle"
            >
              <Calculator size={16} />
            </button>
          </div>
          <div className="mt-3 flex items-baseline justify-center gap-2">
            <span className="text-2xl font-bold text-zinc-600 dark:text-zinc-400">{cur.symbol}</span>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.,+\-*/×÷−]/g, ''))}
              inputMode="decimal"
              placeholder="0"
              className="bg-transparent text-5xl font-bold tabular-nums tracking-tight text-center outline-none w-full max-w-[260px] text-zinc-950 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus-visible:ring-2 focus-visible:ring-foreground/20 rounded"
              data-testid="amount-input"
            />
          </div>
          {/[+\-*/×÷−]/.test(amount.slice(1)) ? <p className="text-sm font-semibold text-zinc-600 dark:text-zinc-400 mt-1">= {fmt(num, currency)}</p> : null}
          {isForeign && num > 0 ? (
            <div className="inline-flex mt-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 px-3 py-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400" data-testid="conversion-badge">
              ≈ {fmt(converted, home)} {home} <span className="mx-1.5 opacity-40">|</span> {t('rate')}: 1 {currency} = {formatRate(rate)} {home}
            </div>
          ) : null}
          </div>

        {showCalc ? (
          <div className="grid grid-cols-4 gap-2 mt-4">
            {KEYS.map((k) => (
              <button key={k} type="button" onClick={() => pressKey(k)} className={cn('h-12 rounded-xl font-bold text-lg active:scale-95 transition', /[÷×−+]/.test(k) ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950' : 'bg-white dark:bg-[#1c1c1e] text-zinc-950 dark:text-white border border-zinc-200 dark:border-white/10')}>
                {k === '⌫' ? <Delete size={18} className="mx-auto" /> : k}
              </button>
            ))}
            <button type="button" onClick={() => pressKey('=')} className="col-span-4 h-11 rounded-xl bg-zinc-200 dark:bg-zinc-800 text-zinc-950 dark:text-white font-bold">=</button>
          </div>
        ) : null}

        {type !== 'transfer' ? (
          <div className="mt-6 space-y-6">
            {/* Category */}
            <Card onClick={() => setPickCategory(true)} className="flex items-center gap-3 p-3" data-testid="category-card">
              <CategoryBadge id={category} />
              <div className="flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-600 dark:text-zinc-400">{t('category')}</p>
                <p className="font-bold text-zinc-950 dark:text-white">{t(`cat_${category}`)}</p>
              </div>
              <ChevronRight size={18} className="text-zinc-400 dark:text-zinc-500" />
            </Card>

            <Field label={t('payment_method')}>
              <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5">
                {PAYMENT_METHODS.map((m) => <Pill key={m} active={payment === m} onClick={() => setPayment(m)}>{t(m)}</Pill>)}
              </div>
            </Field>

            <Field label={t('source_account')}>{accountPills(accountId, setAccountId)}</Field>

            <Field label={t('date_time')}>
              <TextInput
                type="datetime-local"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value)
                  if (e.target.value?.includes('T')) {
                    setTime(e.target.value.split('T')[1].slice(0, 5))
                  }
                }}
                data-testid="date-input"
              />
            </Field>

            <Field label={t('merchant')}>
              <TextInput value={merchant} onChange={(e) => setMerchant(e.target.value)} placeholder={t('tx_desc_placeholder')} />
            </Field>

            <Field label={t('note')}>
              <TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('note_placeholder')} data-testid="note-input" />
            </Field>

            <Field>
              <div className="flex items-center justify-between pb-1">
                <SectionLabel className="mb-0">{t('receipt')}</SectionLabel>
                <button
                  type="button"
                  onClick={() => {
                    if (!isAiAllowed) {
                      openSheet('aiPremium')
                    } else {
                      onClose?.()
                      openSheet('scan')
                    }
                  }}
                  className="text-xs font-bold text-zinc-950 dark:text-white flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition cursor-pointer"
                  data-testid="add-tx-scan-receipt"
                >
                  <Sparkles size={12} className="text-zinc-950 dark:text-white" />
                  <span>{t('scan_receipt') || 'Scan Receipt'}</span>
                </button>
              </div>
              <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={onFile} />
              <Card onClick={() => fileRef.current?.click()} className="flex items-center gap-3 p-3">
                {receipt?.dataUrl ? (
                  <img
                    src={getDriveThumbnailUrl(receipt.dataUrl, 160, merchant)}
                    alt="receipt"
                    referrerPolicy="no-referrer"
                    crossOrigin="anonymous"
                    className="h-12 w-12 rounded-xl object-cover border border-border/40"
                  />
                ) : (
                  <div className="h-12 w-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 flex items-center justify-center">{receipt?.isPdf ? <FileText size={20} /> : <Camera size={20} />}</div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-zinc-950 dark:text-white truncate">{receipt ? receipt.name : t('add_receipt')}</p>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 font-medium">{t('photo_or_pdf')}</p>
                </div>
                {receipt ? <button type="button" onClick={(e) => { e.stopPropagation(); setReceipt(null) }} className="p-2 text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white"><X size={16} /></button> : <ChevronRight size={18} className="text-zinc-400 dark:text-zinc-500" />}
              </Card>
              {items?.length ? <p className="text-xs text-zinc-600 dark:text-zinc-400 px-1 font-medium">{items.length} {t('items').toLowerCase()} · {receiptNumber ? `${t('receipt_no')} ${receiptNumber}` : ''}</p> : null}
            </Field>

            {type === 'expense' ? (
              <Card className="flex items-center gap-3 p-4">
                <div className="flex-1">
                  <p className="font-bold text-zinc-950 dark:text-white">{t('tax_deductible')}</p>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400">{t('tax_deductible_sub')}</p>
                </div>
                <Switch checked={tax} onChange={setTax} data-testid="tax-switch" />
              </Card>
            ) : null}
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            <Field label={t('from')}>{accountPills(accountId, setAccountId, false)}</Field>
            <Field label={t('to')}>
              <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5">
                {accounts.filter((a) => a.id !== accountId).map((a) => <Pill key={a.id} active={toAccountId === a.id} onClick={() => setToAccountId(a.id)}>{a.name}</Pill>)}
              </div>
            </Field>
            {!showFee ? (
              <button type="button" onClick={() => setShowFee(true)} className="text-sm font-bold text-zinc-950 dark:text-white">{t('add_charges')}</button>
            ) : (
              <Field label={`${t('charges')} (${currency})`}>
                <TextInput type="text" inputMode="decimal" value={fee} onChange={(e) => setFee(sanitizeAmount(e.target.value))} placeholder="0" />
              </Field>
            )}
            <Field label={t('date_time')}>
              <TextInput type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label={t('notes')}>
              <TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('note_placeholder')} />
            </Field>
            {accounts.length < 2 ? <p className="text-xs text-zinc-600 dark:text-zinc-400 font-medium">{t('select_accounts')}</p> : null}
          </div>
        )}
        <div className="h-6" />
      </Sheet>

      <CurrencySheet open={pickCurrency} onClose={() => setPickCurrency(false)} value={currency} onSelect={setCurrency} zIndex={70} />

      <Sheet open={pickCategory} onClose={() => { setPickCategory(false); setCatSearch('') }} title={t('select_category')} zIndex={70} noPadding>
        <div className="w-full px-4 py-2 box-border">
          <div className="relative flex items-center w-full">
            <Search className="absolute left-3.5 text-muted-foreground pointer-events-none shrink-0" size={16} />
            <input
              type="text"
              value={catSearch}
              onChange={(e) => setCatSearch(e.target.value)}
              placeholder={t('search')}
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl text-base bg-muted/40 border border-border/40 text-foreground placeholder-muted-foreground outline-none focus:border-border transition-colors"
              data-testid="category-search"
            />
          </div>
        </div>
        <div className="px-4 pb-6 grid grid-cols-4 gap-3 pt-2">
          {CATEGORIES.filter((c) => {
            if (!c.types.includes(type)) return false
            if (!catSearch.trim()) return true
            const term = catSearch.trim().toLowerCase()
            const label = (t(`cat_${c.id}`) || c.id).toLowerCase()
            return label.includes(term) || c.id.toLowerCase().includes(term)
          }).map((c) => (
            <button key={c.id} type="button" onClick={() => { setCategory(c.id); setPickCategory(false); setCatSearch('') }} className="flex flex-col items-center gap-2" data-testid={`cat-${c.id}`}>
              <div className={cn('h-14 w-14 rounded-2xl flex items-center justify-center border transition-all', category === c.id ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 border-zinc-950 dark:border-white shadow-md' : 'bg-white dark:bg-[#1c1c1e] text-zinc-900 dark:text-zinc-100 border-zinc-200 dark:border-white/10')}>
                <CategoryIcon id={c.id} size={22} />
              </div>
              <span className="text-[11px] font-semibold text-center leading-tight text-zinc-950 dark:text-white">{t(`cat_${c.id}`)}</span>
            </button>
          ))}
        </div>
      </Sheet>
    </>
  )
}
'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import {
  CreditCard,
  Calendar,
  Check,
  Trash2,
  Camera,
  Percent,
  Sparkles,
  Zap,
  Building2,
  ShoppingBag,
  Smartphone,
  Wallet,
  ArrowRight,
  Info,
} from 'lucide-react'
import { toast } from 'sonner'
import { getCurrency } from '@/lib/currencies'
import { cn, triggerHaptic } from '@/lib/utils'
import { Sheet, DatePickerInput } from '@/components/arshif/ui'

// Indonesian providers for fixed-installment loans
const INDO_PROVIDERS = [
  { id: 'cc', name: 'Cicilan Kartu Kredit', icon: CreditCard, defaultRate: 0 },
  { id: 'spaylater', name: 'SPayLater', icon: ShoppingBag, defaultRate: 2.95 },
  { id: 'kredivo', name: 'Kredivo', icon: Zap, defaultRate: 2.6 },
  { id: 'akulaku', name: 'Akulaku', icon: Wallet, defaultRate: 2.85 },
  { id: 'kta', name: 'KTA Bank BCA/Mandiri', icon: Building2, defaultRate: 1.0 },
  { id: 'custom', name: 'Kustom', icon: Smartphone, defaultRate: 0 },
]

// Running balance debt types
const RUNNING_DEBT_TYPES = [
  { id: 'cc', label: 'Kartu Kredit' },
  { id: 'kta', label: 'KTA / Pinjaman Pribadi' },
  { id: 'paylater', label: 'PayLater' },
  { id: 'flexible', label: 'Pinjaman Fleksibel' },
]

// Default paid from accounts
const DEFAULT_PAID_FROM = [
  { id: 'bca', name: 'BCA' },
  { id: 'mandiri', name: 'Mandiri' },
  { id: 'gopay', name: 'GoPay' },
  { id: 'ask_every_time', name: 'Tanya Setiap Bayar' },
]

// Tenor options in months
const TENOR_OPTIONS = [3, 6, 12, 24, 36]

export default function LoanModal({
  open,
  onClose,
  loan = null, // if editing
  onSaved,
  onDeleted,
  home = 'IDR',
  accounts = [],
  store,
  t = (k) => k,
}) {
  // Mode: instalment | running | compare
  const [activeTab, setActiveTab] = useState('instalment')

  const [principalAmount, setPrincipalAmount] = useState('')
  const [selectedProvider, setSelectedProvider] = useState('spaylater')
  const [planName, setPlanName] = useState('')
  const [tenorMonths, setTenorMonths] = useState(12)
  const [interestRate, setInterestRate] = useState(0) // % per month
  const [isZeroPercent, setIsZeroPercent] = useState(true)
  const [trackInBills, setTrackInBills] = useState(true)
  const [dueDay, setDueDay] = useState('25')

  const [runningType, setRunningType] = useState('cc')
  const [paidFrom, setPaidFrom] = useState('bca')
  const [balanceMode, setBalanceMode] = useState('full') // 'partial' | 'full'
  const [partialPaidAmount, setPartialPaidAmount] = useState('')
  const [firstPaymentDate, setFirstPaymentDate] = useState('')
  const [coverPhoto, setCoverPhoto] = useState('')

  const [isSubmitting, setIsSubmitting] = useState(false)
  const fileInputRef = useRef(null)

  // Reset atau isi form dari data loan saat modal dibuka
  useEffect(() => {
    if (!open) return
    if (loan) {
      const isRunning = loan.debt_mode === 'running'
      setActiveTab(isRunning ? 'running' : 'instalment')
      setPrincipalAmount(String(loan.total_amount || loan.amount || ''))
      setPlanName(loan.name || loan.title || '')
      setTenorMonths(Number(loan.remaining_tenor || loan.tenor_months) || 12)
      setDueDay(String(loan.due_day || 25))
      setInterestRate(Number(loan.interest_rate) || 0)
      setIsZeroPercent(Number(loan.interest_rate || 0) === 0)
      setTrackInBills(loan.track_in_bills !== false)
      setSelectedProvider(loan.provider_id || 'custom')

      if (isRunning) {
        setRunningType(loan.running_type || 'cc')
        setPaidFrom(loan.paid_from || 'bca')
        setBalanceMode(loan.balance_mode || 'full')
        setPartialPaidAmount(String(loan.partial_paid_amount || ''))
        setFirstPaymentDate(loan.first_payment_date || '')
        setCoverPhoto(loan.cover_url || '')
      }
    } else {
      setActiveTab('instalment')
      setPrincipalAmount('')
      setSelectedProvider('spaylater')
      setPlanName('SPayLater Cicilan')
      setTenorMonths(12)
      setInterestRate(0)
      setIsZeroPercent(true)
      setTrackInBills(true)
      setDueDay('25')

      setRunningType('cc')
      setPaidFrom('bca')
      setBalanceMode('full')
      setPartialPaidAmount('')
      setFirstPaymentDate(new Date().toISOString().slice(0, 10))
      setCoverPhoto('')
    }
  }, [open, loan])

  const currencySymbol = useMemo(() => {
    return getCurrency(home)?.symbol || home || 'Rp'
  }, [home])

  const handleAmountChange = (e, setter) => {
    const raw = e.target.value.replace(/,/g, '.').replace(/[^0-9.]/g, '')
    if ((raw.match(/\./g) || []).length > 1) return
    setter(raw)
  }

  const formatMoney = (val) => {
    const num = Number(val) || 0
    return `${currencySymbol} ${num.toLocaleString('id-ID')}`
  }

  const handleSelectProvider = (prov) => {
    setSelectedProvider(prov.id)
    if (!loan) {
      setPlanName(prov.id === 'custom' ? '' : `${prov.name} Cicilan`)
      if (prov.defaultRate === 0) {
        setIsZeroPercent(true)
        setInterestRate(0)
      } else {
        setIsZeroPercent(false)
        setInterestRate(prov.defaultRate)
      }
    }
  }

  // Hitung angsuran: bunga flat ala standar cicilan konsumen Indonesia
  const calculations = useMemo(() => {
    const principal = Number(principalAmount) || 0
    const months = Math.max(1, Number(tenorMonths) || 1)
    const monthlyRate = isZeroPercent ? 0 : Number(interestRate) || 0

    const monthlyInterest = (principal * (monthlyRate / 100))
    const monthlyPrincipal = principal / months
    const monthlyInstallment = Math.round(monthlyPrincipal + monthlyInterest)
    const totalPayment = Math.round(monthlyInstallment * months)
    const totalInterest = Math.max(0, totalPayment - principal)

    return {
      principal,
      months,
      monthlyInstallment,
      totalPayment,
      totalInterest,
      isZero: isZeroPercent || monthlyRate === 0,
    }
  }, [principalAmount, tenorMonths, interestRate, isZeroPercent])

  const runningCalculations = useMemo(() => {
    const total = Number(principalAmount) || 0
    const paid = balanceMode === 'partial' ? Number(partialPaidAmount) || 0 : 0
    const remaining = Math.max(0, total - paid)
    return { total, paid, remaining }
  }, [principalAmount, balanceMode, partialPaidAmount])

  const processImageFile = (file) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('File harus berupa gambar')
      return
    }
    if (file.size > 3 * 1024 * 1024) {
      toast.error('Ukuran foto maksimal 3MB')
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => setCoverPhoto(e.target?.result || '')
    reader.readAsDataURL(file)
  }

  const isValid = useMemo(() => {
    const num = Number(principalAmount) || 0
    if (num <= 0) return false
    if (activeTab === 'instalment' && !planName.trim()) return false
    return true
  }, [principalAmount, activeTab, planName])

  const handleSave = async () => {
    if (!isValid) {
      toast.error('Lengkapi nominal dan nama cicilan')
      return
    }

    setIsSubmitting(true)
    try {
      const isRunning = activeTab === 'running'
      const monthlyAmt = isRunning
        ? Math.round(runningCalculations.remaining / Math.max(1, tenorMonths || 1))
        : calculations.monthlyInstallment

      const planTitle = (planName || (isRunning ? `Utang ${runningType.toUpperCase()}` : 'Pinjaman')).trim()

      const payload = {
        name: planTitle,
        title: planTitle, // Pastikan title terisi
        total_amount: Number(principalAmount) || 0,
        target_amount: Number(principalAmount) || 0,
        total_loan_amount: Number(principalAmount) || 0,
        installment_amount: monthlyAmt,
        monthly_installment: monthlyAmt,
        monthly_payment: monthlyAmt,
        remaining_tenor: Number(tenorMonths) || 12,
        tenor_months: Number(tenorMonths) || 12,
        due_day: Math.min(31, Math.max(1, Number(dueDay) || 25)),
        due_day_of_month: Math.min(31, Math.max(1, Number(dueDay) || 25)),
        currency: home,
        type: 'loan',
        debt_type: isRunning ? 'running_balance' : 'instalment',
        provider_name: selectedProvider,
        interest_rate: isZeroPercent ? 0 : Number(interestRate) || 0,
        track_in_bills: trackInBills,
      }

      // Simpan langsung ke Supabase goals
      if (store?.createGoal) {
        await store.createGoal(payload)
      } else if (store?.createDebt) {
        await store.createDebt(payload)
      }

      // Sync ke Bills jika diaktifkan
      if (trackInBills && store?.createBill) {
        try {
          await store.createBill({
            title: payload.title,
            amount: monthlyAmt,
            currency: home,
            due_day: payload.due_day,
            category: 'Bills & Utilities',
          })
        } catch (err) {
          console.warn('Bills sync notice:', err?.message)
        }
      }

      const labelType = activeTab === 'running' 
        ? 'Saldo berjalan' 
        : isZeroPercent 
          ? 'Cicilan 0%' 
          : 'Pinjaman cicilan'

      triggerHaptic('success')
      toast.success(
        loan 
          ? `${labelType} berhasil diperbarui` 
          : `${labelType} berhasil ditambahkan`
      )
      if (typeof onSaved === 'function') await onSaved()
      onClose?.()
    } catch (err) {
      toast.error(err?.message || 'Gagal menyimpan pinjaman')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!loan?.id) return
    triggerHaptic('warning')
    setIsSubmitting(true)
    try {
      // Hapus dari goals Supabase, lalu fallback ke store debts
      if (store?.deleteGoal) {
        await store.deleteGoal(loan.id)
      }
      if (store?.deleteDebt) {
        await store.deleteDebt(loan.id).catch(() => {})
      }

      toast.success(
        activeTab === 'running' 
          ? 'Catatan utang saldo berjalan dihapus' 
          : 'Pinjaman cicilan berhasil dihapus'
      )
      if (typeof onDeleted === 'function') await onDeleted()
      if (typeof onSaved === 'function') await onSaved()
      onClose?.()
    } catch (err) {
      toast.error(err?.message || 'Gagal menghapus pinjaman')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Akun user + default bank yang belum ada (untuk pilihan paid from)
  const combinedAccounts = useMemo(() => {
    const userAccs = (accounts || []).map((a) => ({ id: a.id, name: a.name }))
    const existingNames = new Set(userAccs.map((a) => a.name.toLowerCase()))
    const extras = DEFAULT_PAID_FROM.filter((d) => !existingNames.has(d.name.toLowerCase()))
    return [...userAccs, ...extras]
  }, [accounts])

  // Simulasi bunga tiap provider berdasarkan pokok & tenor saat ini
  const comparisonList = useMemo(() => {
    const principal = Number(principalAmount) || 10000000
    const months = Number(tenorMonths) || 12

    const providers = [
      {
        id: 'kredivo',
        name: 'Kredivo',
        monthlyRate: 2.6,
        adminFeePct: 0,
        badge: 'Populer di E-Commerce',
        note: 'Bebas biaya admin jika bayar tepat waktu, bunga flat 2.6%/bulan.',
      },
      {
        id: 'spaylater',
        name: 'SPayLater',
        monthlyRate: 2.95,
        adminFeePct: 1.0,
        badge: 'Terintegrasi Shopee',
        note: 'Bunga 2.95%/bulan + biaya penanganan 1% per transaksi.',
      },
      {
        id: 'cc',
        name: 'Cicilan Kartu Kredit',
        monthlyRate: 0, // Promo 0% or ~1.5%
        adminFeePct: 1.0,
        badge: 'Bunga Terendah (Promo 0%)',
        note: 'Bunga 0% tenor hingga 12-24 bulan dengan biaya admin konversi ~1%.',
      },
      {
        id: 'kta',
        name: 'KTA Bank BCA / Mandiri',
        monthlyRate: 0.99,
        adminFeePct: 1.5,
        badge: 'Limit Besar & Jangka Panjang',
        note: 'Suku bunga flat bank berkisar 0.88% - 1.29%/bulan untuk pinjaman tunai.',
      },
    ]

    return providers.map((p) => {
      const monthlyInterest = principal * (p.monthlyRate / 100)
      const monthlyPrincipal = principal / months
      const adminFee = principal * (p.adminFeePct / 100)
      const monthlyInstallment = Math.round(monthlyPrincipal + monthlyInterest)
      const totalPayment = Math.round(monthlyInstallment * months + adminFee)
      const totalInterest = Math.max(0, totalPayment - principal)

      return {
        ...p,
        monthlyInstallment,
        totalPayment,
        totalInterest,
      }
    })
  }, [principalAmount, tenorMonths])

  const applyComparedProvider = (item) => {
    setSelectedProvider(item.id)
    setPlanName(`${item.name} Cicilan`)
    if (item.monthlyRate === 0) {
      setIsZeroPercent(true)
      setInterestRate(0)
    } else {
      setIsZeroPercent(false)
      setInterestRate(item.monthlyRate)
    }
    setActiveTab('instalment')
    toast.success(`Menerapkan skema cicilan ${item.name}`)
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      zIndex={70}
      title={loan ? t('edit_loan', 'Edit Pinjaman & BNPL') : t('loans_bnpl', 'Pinjaman & BNPL')}
      left={
        <button
          type="button"
          onClick={onClose}
          className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          {t('cancel')}
        </button>
      }
      right={
        <button
          type="button"
          onClick={handleSave}
          disabled={!isValid || isSubmitting}
          className="text-sm font-bold text-foreground hover:opacity-80 transition-opacity cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {isSubmitting ? t('saving', 'Menyimpan...') : loan ? t('save', 'Simpan') : t('create', 'Tambah')}
        </button>
      }
    >
      <div className="space-y-5">
        {/* Input Nominal Utama (Jumlah Pinjaman / Limit) */}
        <div>
          <label className="text-xs text-muted-foreground font-medium mb-1 block">
            {t('loan_principal_limit', 'Jumlah Pinjaman / Limit Total')}
          </label>
          <div className="relative rounded-2xl bg-muted/40 border border-border/30 p-4 flex items-center gap-2 focus-within:border-foreground/40 transition-colors">
            <span className="text-2xl font-extrabold text-foreground select-none shrink-0 pl-1">
              {currencySymbol}
            </span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={principalAmount}
                  onChange={(e) => handleAmountChange(e, setPrincipalAmount)}
                  placeholder="0"
                  className="w-full text-2xl font-extrabold text-foreground bg-transparent outline-none placeholder:text-muted-foreground/30 tabular-nums"
                  autoFocus={false}
                />
              </div>
            </div>

            {/* Segmented Tabs (3 Mode) */}
            <div className="rounded-2xl bg-muted/40 p-1 flex border border-border/30 mb-5">
              <button
                type="button"
                onClick={() => setActiveTab('instalment')}
                className={cn(
                  'flex-1 text-center py-2 px-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer truncate',
                  activeTab === 'instalment'
                    ? 'bg-foreground text-background shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {t('loan_tab_instalment')}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('running')}
                className={cn(
                  'flex-1 text-center py-2 px-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer truncate',
                  activeTab === 'running'
                    ? 'bg-foreground text-background shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {t('loan_tab_running')}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('compare')}
                className={cn(
                  'flex-1 text-center py-2 px-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer truncate',
                  activeTab === 'compare'
                    ? 'bg-foreground text-background shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {t('loan_tab_compare')}
              </button>
            </div>

            {/* TAB 1: CICILAN TETAP */}
            {activeTab === 'instalment' && (
              <div className="space-y-4">
                {/* Provider Indonesia (Pill Horizontal) */}
                <div>
                  <label className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase mb-2 block">
                    {t('loan_choose_provider')}
                  </label>
                  <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                    {INDO_PROVIDERS.map((prov) => {
                      const isSelected = selectedProvider === prov.id
                      const Icon = prov.icon
                      return (
                        <button
                          key={prov.id}
                          type="button"
                          onClick={() => handleSelectProvider(prov)}
                          className={cn(
                            'shrink-0 flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium border transition-all cursor-pointer',
                            isSelected
                              ? 'bg-foreground text-background border-foreground font-semibold shadow-xs'
                              : 'bg-muted/40 border-border/40 text-muted-foreground hover:text-foreground'
                          )}
                        >
                          <Icon size={14} strokeWidth={isSelected ? 2 : 1.75} />
                          <span>{prov.name}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Field Nama Rencana */}
                <div>
                  <label className="text-xs text-muted-foreground font-medium mb-1 block">
                    {t('loan_plan_name')}
                  </label>
                  <input
                    type="text"
                    value={planName}
                    onChange={(e) => setPlanName(e.target.value)}
                    placeholder={t('loan_plan_placeholder')}
                    className="w-full bg-muted/40 rounded-2xl p-3.5 text-sm font-medium text-foreground outline-none border border-border/30 placeholder:text-muted-foreground/40 focus:border-foreground/40 transition-colors"
                  />
                </div>

                {/* Field Pilihan t('loan_tenor') */}
                <div>
                  <label className="text-xs text-muted-foreground font-medium mb-1.5 block">
                    Pilihan t('loan_tenor')
                  </label>
                  <div className="grid grid-cols-5 gap-2">
                    {TENOR_OPTIONS.map((t) => {
                      const isSelected = Number(tenorMonths) === t
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setTenorMonths(t)}
                          className={cn(
                            'py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border text-center',
                            isSelected
                              ? 'bg-foreground text-background border-foreground shadow-xs'
                              : 'bg-muted/40 border-border/30 text-muted-foreground hover:text-foreground'
                          )}
                        >
                          {t} t('loan_monthly_label')
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Skema Bunga (0% vs Custom) */}
                <div className="p-3.5 rounded-2xl bg-muted/30 border border-border/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-foreground block">
                        Skema Bunga 0% (Bebas Bunga)
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        Promo kartu kredit atau cicilan 0%
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsZeroPercent(!isZeroPercent)
                        if (!isZeroPercent) setInterestRate(0)
                        else setInterestRate(2.95)
                      }}
                      className={cn(
                        'w-11 h-6 rounded-full transition-colors relative cursor-pointer',
                        isZeroPercent ? 'bg-emerald-500' : 'bg-muted border border-border/40'
                      )}
                    >
                      <div
                        className={cn(
                          'w-5 h-5 rounded-full bg-white transition-transform shadow-xs absolute top-0.5',
                          isZeroPercent ? 'right-0.5' : 'left-0.5'
                        )}
                      />
                    </button>
                  </div>

                  {!isZeroPercent && (
                    <div className="pt-2 border-t border-border/30 flex items-center justify-between gap-3">
                      <span className="text-xs text-muted-foreground font-medium">
                        Bunga Flat per Bulan (%):
                      </span>
                      <div className="w-28 relative rounded-xl bg-background border border-border/40 px-3 py-1.5 flex items-center">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={interestRate}
                          onChange={(e) => handleAmountChange(e, setInterestRate)}
                          placeholder="2.95"
                          className="w-full text-xs font-bold text-foreground bg-transparent outline-none tabular-nums text-right pr-1"
                        />
                        <span className="text-xs text-muted-foreground font-semibold">%</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Tanggal Jatuh Tempo */}
                <div>
                  <label className="text-xs text-muted-foreground font-medium mb-1 block">
                    {t('loan_due_day')}
                  </label>
                  <div className="relative w-full h-12 rounded-2xl bg-[#F6F6F6] dark:bg-[#18181b] border border-border/70 dark:border-white/10 text-sm font-semibold text-foreground px-4 flex items-center gap-2.5">
                    <Calendar size={16} className="text-muted-foreground shrink-0" />
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={dueDay}
                      onChange={(e) => setDueDay(e.target.value)}
                      placeholder="25"
                      className="w-full text-sm font-semibold text-foreground bg-transparent outline-none tabular-nums text-left"
                    />
                    <span className="text-xs text-muted-foreground font-medium shrink-0">
                    {t('loan_monthly_label')}
                    </span>
                  </div>
                </div>

                {/* Toggle Pantau Bulanan di Tagihan (Bills) */}
                <div className="p-3.5 rounded-2xl bg-muted/30 border border-border/30 flex items-center justify-between">
                  <div className="pr-3">
                    <span className="text-xs font-semibold text-foreground block">
                      {t('loan_track_bills')}
                    </span>
                    <span className="text-[11px] text-muted-foreground block mt-0.5">
                      {t('loan_track_bills_desc')}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTrackInBills(!trackInBills)}
                    className={cn(
                      'w-11 h-6 rounded-full transition-colors relative cursor-pointer shrink-0',
                      trackInBills ? 'bg-emerald-500' : 'bg-muted border border-border/40'
                    )}
                  >
                    <div
                      className={cn(
                        'w-5 h-5 rounded-full bg-white transition-transform shadow-xs absolute top-0.5',
                        trackInBills ? 'right-0.5' : 'left-0.5'
                      )}
                    />
                  </button>
                </div>

                {/* Floating Summary Bar Bawah (Wadah hitam rounded-2xl p-4 text-white) */}
                <div className="rounded-2xl bg-zinc-950 dark:bg-zinc-900 border border-zinc-800 p-4 text-white shadow-lg space-y-2 mt-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 block mb-0.5">
                        {t('loan_monthly_payment')}
                      </span>
                      <span className="text-lg font-bold text-white tabular-nums">
                        {formatMoney(calculations.monthlyInstallment)}
                        <span className="text-xs font-normal text-zinc-400">/bln</span>
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 block mb-0.5">
                        {t('loan_total_payment')}
                      </span>
                      <span className="text-base font-bold text-white tabular-nums">
                        {formatMoney(calculations.totalPayment)}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-zinc-800 flex items-center justify-between text-[11px]">
                    <span className="text-zinc-400">
                      Tenor: {calculations.months} bulan ({dueDay ? `Tempo tgl ${dueDay}` : ''})
                    </span>
                    {calculations.isZero ? (
                      <span className="text-emerald-400 font-semibold flex items-center gap-1">
                        <Check size={13} strokeWidth={2.5} />
                        Rencana Bunga 0%
                      </span>
                    ) : (
                      <span className="text-amber-400 font-medium">
                        Total Bunga: +{formatMoney(calculations.totalInterest)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: SALDO BERJALAN */}
            {activeTab === 'running' && (
              <div className="space-y-4">
                {/* Tipe Utang */}
                <div>
                  <label className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase mb-2 block">
                    {t('loan_debt_type')}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {RUNNING_DEBT_TYPES.map((t) => {
                      const isSelected = runningType === t.id
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setRunningType(t.id)}
                          className={cn(
                            'py-2.5 px-3 rounded-xl text-xs font-medium border transition-all cursor-pointer text-left truncate',
                            isSelected
                              ? 'bg-foreground text-background border-foreground font-semibold shadow-xs'
                              : 'bg-muted/40 border-border/30 text-muted-foreground hover:text-foreground'
                          )}
                        >
                          {t.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Pilihan t('loan_paid_from') */}
                <div>
                  <label className="text-xs text-muted-foreground font-medium mb-1 block">
                    {t('loan_paid_from')}
                  </label>
                  <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                    {combinedAccounts.map((acc) => {
                      const isSelected = paidFrom === acc.id
                      return (
                        <button
                          key={acc.id}
                          type="button"
                          onClick={() => setPaidFrom(acc.id)}
                          className={cn(
                            'shrink-0 px-3.5 py-2 rounded-xl text-xs font-medium border transition-all cursor-pointer',
                            isSelected
                              ? 'bg-foreground text-background border-foreground font-semibold shadow-xs'
                              : 'bg-muted/40 border-border/40 text-muted-foreground hover:text-foreground'
                          )}
                        >
                          {acc.name}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Sub-Segment: Sudah Pernah Dibayar Sebagian vs t('loan_full_remaining') */}
                <div>
                  <label className="text-xs text-muted-foreground font-medium mb-1.5 block">
                    {t('loan_opening_status')}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setBalanceMode('full')}
                      className={cn(
                        'py-2.5 px-3 rounded-xl text-xs font-medium border text-center transition-all cursor-pointer',
                        balanceMode === 'full'
                          ? 'bg-foreground text-background border-foreground font-semibold shadow-xs'
                          : 'bg-muted/40 border-border/30 text-muted-foreground'
                      )}
                    >
                      {t('loan_full_remaining')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setBalanceMode('partial')}
                      className={cn(
                        'py-2.5 px-3 rounded-xl text-xs font-medium border text-center transition-all cursor-pointer',
                        balanceMode === 'partial'
                          ? 'bg-foreground text-background border-foreground font-semibold shadow-xs'
                          : 'bg-muted/40 border-border/30 text-muted-foreground'
                      )}
                    >
                      {t('loan_partially_paid')}
                    </button>
                  </div>
                </div>

                {balanceMode === 'partial' && (
                  <div>
                    <label className="text-xs text-muted-foreground font-medium mb-1 block">
                      {t('loan_amount_paid')}
                    </label>
                    <div className="relative rounded-2xl bg-muted/40 border border-border/30 p-3.5 flex items-center gap-2">
                      <span className="text-sm font-bold text-foreground select-none shrink-0 pl-1">
                        {currencySymbol}
                      </span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={partialPaidAmount}
                        onChange={(e) => handleAmountChange(e, setPartialPaidAmount)}
                        placeholder="0"
                        className="w-full text-sm font-bold text-foreground bg-transparent outline-none tabular-nums"
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1 px-1">
                      Sisa saldo riil:{' '}
                      <span className="font-bold text-foreground">
                        {formatMoney(runningCalculations.remaining)}
                      </span>
                    </p>
                  </div>
                )}

                {/* Tanggal Pembayaran Pertama */}
                <DatePickerInput
                  label="Tanggal Pembayaran Pertama"
                  value={firstPaymentDate}
                  onChange={setFirstPaymentDate}
                />

                {/* Unggah Foto Bukti/Cover (Opsional) */}
                <div>
                  <label className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase mb-1.5 block">
                    {t('loan_cover_optional')}
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      processImageFile(e.target.files?.[0])
                      e.target.value = ''
                    }}
                  />
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="relative rounded-2xl bg-muted/30 border border-dashed border-border/60 p-4 flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50 transition-all overflow-hidden min-h-[100px]"
                  >
                    {coverPhoto ? (
                      <>
                        <img
                          src={coverPhoto}
                          alt="Cover"
                          className="w-full h-full object-cover absolute inset-0"
                        />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center gap-2">
                          <span className="text-xs text-white font-medium bg-black/50 px-3 py-1.5 rounded-lg">
                            {t('loan_change_photo')}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setCoverPhoto('')
                            }}
                            className="p-1.5 rounded-lg bg-black/50 text-white"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Camera size={18} />
                        <span className="text-xs font-medium">t('loan_upload_photo')</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: BANDINGKAN SUKU BUNGA */}
            {activeTab === 'compare' && (
              <div className="space-y-3">
                <div className="p-3 rounded-2xl bg-muted/30 border border-border/30 text-xs text-muted-foreground flex items-start gap-2.5">
                  <Info size={16} className="text-foreground shrink-0 mt-0.5" />
                  <p>
                    Perbandingan simulasi angsuran untuk pokok{' '}
                    <strong className="text-foreground">{formatMoney(principalAmount || 10000000)}</strong>{' '}
                    dengan tenor <strong className="text-foreground">{tenorMonths} bulan</strong>.
                  </p>
                </div>

                <div className="space-y-2.5">
                  {comparisonList.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-border/40 bg-card p-4 hover:border-foreground/30 transition-all space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-sm font-bold text-foreground block">
                            {item.name}
                          </span>
                          <span className="text-[10px] text-emerald-500 font-semibold">
                            {item.badge}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-bold text-foreground block tabular-nums">
                            {formatMoney(item.monthlyInstallment)}
                            <span className="text-[11px] font-normal text-muted-foreground">/bln</span>
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            Bunga: {item.monthlyRate}%/bln
                          </span>
                        </div>
                      </div>

                      <p className="text-[11px] text-muted-foreground/80 leading-relaxed">
                        {item.note}
                      </p>

                      <div className="pt-2 border-t border-border/30 flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          Total bayar: <strong className="text-foreground">{formatMoney(item.totalPayment)}</strong>
                        </span>
                        <button
                          type="button"
                          onClick={() => applyComparedProvider(item)}
                          className="flex items-center gap-1 text-xs font-bold text-foreground hover:opacity-80 transition-opacity cursor-pointer bg-muted/60 px-3 py-1.5 rounded-xl border border-border/40"
                        >
                          <span>{t('loan_choose_scheme')}</span>
                          <ArrowRight size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Bottom Actions for Editing Mode */}
            {loan && (
              <div className="pt-5 mt-4 border-t border-border/30">
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isSubmitting}
                  className="w-full text-center text-sm font-semibold text-rose-500 hover:opacity-80 py-2.5 rounded-xl transition-all cursor-pointer"
                >
                  {t('loan_delete_this')}
                </button>
              </div>
            )}
          </div>
        </Sheet>
  )
}

'use client'
import { useState, useEffect, useMemo } from 'react'
import {
  ShoppingBag,
  Zap,
  Wallet,
  Calendar,
  Bell,
  Trash2,
  CreditCard,
  Building2,
  FileText,
} from 'lucide-react'
import { toast } from 'sonner'
import { getCurrency } from '@/lib/currencies'
import { cn, triggerHaptic } from '@/lib/utils'
import { Sheet, DatePickerInput } from '@/components/arshif/ui'

// Indonesian Postpaid Providers
const POSTPAID_PROVIDERS = [
  { id: 'spaylater', name: 'SPayLater', defaultDue: 5, defaultLimit: 2000000, icon: ShoppingBag },
  { id: 'gopaylater', name: 'GoPay Later', defaultDue: 1, defaultLimit: 1500000, icon: Wallet },
  { id: 'kredivo30', name: 'Kredivo Tagihan 30 Hari', defaultDue: 30, defaultLimit: 3000000, icon: Zap },
  { id: 'indodana', name: 'Indodana', defaultDue: 10, defaultLimit: 1000000, icon: CreditCard },
  { id: 'other', name: 'Lainnya', defaultDue: 25, defaultLimit: 1000000, icon: Building2 },
]

export default function PostpaidPlanModal({
  open,
  onClose,
  plan = null, // if editing
  onSaved,
  onDeleted,
  home = 'IDR',
  store,
  t = (k) => k,
}) {
  const [selectedProvider, setSelectedProvider] = useState('spaylater')
  const [packageName, setPackageName] = useState('SPayLater Bulanan')
  const [dueDay, setDueDay] = useState('10')
  const [firstPaymentDate, setFirstPaymentDate] = useState('')
  const [creditLimit, setCreditLimit] = useState('1000000')
  const [currentBillAmount, setCurrentBillAmount] = useState('')
  const [enableReminder, setEnableReminder] = useState(true)
  const [note, setNote] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Reset or fill form
  useEffect(() => {
    if (!open) return
    if (plan) {
      setSelectedProvider(plan.provider_id || 'spaylater')
      setPackageName(plan.name || plan.title || 'SPayLater Bulanan')
      setDueDay(String(plan.due_day || 10))
      setFirstPaymentDate(plan.first_payment_date || plan.start_date || '')
      setCreditLimit(String(plan.credit_limit || plan.total_amount || ''))
      setCurrentBillAmount(String(plan.installment_amount || plan.monthly_payment || ''))
      setEnableReminder(plan.enable_reminder !== false)
      setNote(plan.note || plan.description || '')
    } else {
      setSelectedProvider('spaylater')
      setPackageName('SPayLater Bulanan')
      setDueDay('10')
      setFirstPaymentDate(new Date().toISOString().slice(0, 10))
      setCreditLimit('1000000')
      setCurrentBillAmount('')
      setEnableReminder(true)
      setNote('')
    }
  }, [open, plan])

  const currencySymbol = useMemo(() => {
    return getCurrency(home)?.symbol || home || 'Rp'
  }, [home])

  const handleAmountChange = (e, setter) => {
    const raw = e.target.value.replace(/,/g, '.').replace(/[^0-9.]/g, '')
    if ((raw.match(/\./g) || []).length > 1) return
    setter(raw)
  }

  const handleProviderSelect = (prov) => {
    setSelectedProvider(prov.id)
    if (!plan) {
      setPackageName(prov.id === 'other' ? 'Tagihan PayLater' : `${prov.name} Bulanan`)
      setDueDay(String(prov.defaultDue))
      if (prov.defaultLimit) {
        setCreditLimit(String(prov.defaultLimit))
      }
    }
  }

  const isValid = packageName.trim().length > 0 && Number(dueDay) >= 1 && Number(dueDay) <= 31

  const handleSave = async () => {
    if (!packageName.trim()) {
      toast.error('Masukkan nama paket paylater')
      return
    }
    const dueDayNum = Number(dueDay) || 1
    if (dueDayNum < 1 || dueDayNum > 31) {
      toast.error('Tanggal jatuh tempo harus antara 1 sampai 31')
      return
    }

    setIsSubmitting(true)
    try {
      const payload = {
        name: packageName.trim(),
        title: packageName.trim(), // Tambahkan title untuk Supabase
        total_amount: Number(creditLimit) || 0,
        target_amount: Number(creditLimit) || 0,
        credit_limit: Number(creditLimit) || 0,
        installment_amount: Number(currentBillAmount) || 0,
        monthly_installment: Number(currentBillAmount) || 0,
        monthly_payment: Number(currentBillAmount) || 0,
        due_day: dueDayNum,
        due_day_of_month: dueDayNum,
        first_payment_date: firstPaymentDate || null,
        currency: home,
        type: 'postpaid',
        debt_type: 'postpaid',
        provider_name: selectedProvider,
        track_in_bills: enableReminder,
        notes: note.trim() || null,
      }

      // Simpan langsung via store createGoal atau createDebt
      if (store?.createGoal) {
        await store.createGoal(payload)
      } else if (store?.createDebt) {
        await store.createDebt(payload)
      }

      // Tautkan ke checklist Bills jika pengingat aktif
      if (store?.createBill && (enableReminder || Number(currentBillAmount) > 0)) {
        try {
          await store.createBill({
            title: payload.title,
            amount: Number(currentBillAmount) || 0,
            currency: home,
            due_day: dueDayNum,
            category: 'Bills & Utilities',
          })
        } catch (err) {
          console.warn('Bills sync notice:', err?.message)
        }
      }

      triggerHaptic('success')
      toast.success('Paket PayLater berhasil ditambahkan')
      if (typeof onSaved === 'function') await onSaved()
      onClose?.()
    } catch (err) {
      toast.error(err?.message || 'Gagal menyimpan paket PayLater')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!plan?.id) return
    triggerHaptic('warning')
    setIsSubmitting(true)
    try {
      // Hapus dari goals Supabase (sumber utama), lalu fallback ke tabel debt
      if (store?.deleteGoal) {
        await store.deleteGoal(plan.id)
      }
      if (store?.deleteDebt) {
        await store.deleteDebt(plan.id).catch(() => {})
      }
      
      const providerName = POSTPAID_PROVIDERS.find(p => p.id === selectedProvider)?.name || 'PayLater'
      toast.success(
        plan 
          ? `Tagihan ${providerName} diperbarui` 
          : `Tagihan ${providerName} bulanan ditambahkan`
      )
      if (typeof onDeleted === 'function') await onDeleted()
      if (typeof onSaved === 'function') await onSaved()
      onClose?.()
    } catch (err) {
      toast.error(err?.message || 'Gagal menghapus paket')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      zIndex={70}
      title={plan ? t('edit_loan', 'Edit Paket PayLater') : t('loan_postpaid_title', 'Paket PayLater Baru')}
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
          {isSubmitting ? t('saving', 'Menyimpan...') : plan ? t('save', 'Simpan') : t('create', 'Tambah')}
        </button>
      }
    >
      <div className="space-y-4">
        {/* Deskripsi */}
        <p className="text-xs text-muted-foreground/90 leading-relaxed mb-4 bg-muted/20 p-3 rounded-2xl border border-border/30">
          Untuk penyedia yang menagih total transaksi sekaligus tiap bulan (seperti GoPay Later / SPayLater Tagihan Penuh) tanpa tenor tetap.
        </p>
              {/* Pilihan Provider Indonesia (Pill) */}
              <div>
                <label className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase mb-2 block">
                  PILIH PENYEDIA PAYLATER
                </label>
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                  {POSTPAID_PROVIDERS.map((prov) => {
                    const isSelected = selectedProvider === prov.id
                    const Icon = prov.icon
                    return (
                      <button
                        key={prov.id}
                        type="button"
                        onClick={() => handleProviderSelect(prov)}
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

              {/* Field Form: Nama Paket */}
              <div>
                <label className="text-xs text-muted-foreground font-medium mb-1 block">
                  Nama Paket
                </label>
                <input
                  type="text"
                  value={packageName}
                  onChange={(e) => setPackageName(e.target.value)}
                  placeholder="e.g. SPayLater Bulanan"
                  className="w-full bg-muted/40 rounded-2xl p-3.5 text-sm font-medium text-foreground outline-none border border-border/30 placeholder:text-muted-foreground/40 focus:border-foreground/40 transition-colors"
                />
              </div>

              {/* Field Form: Tanggal Pembayaran Pertama */}
              <DatePickerInput
                label="Tanggal Tagihan / Pembayaran Pertama"
                value={firstPaymentDate}
                onChange={(val) => {
                  setFirstPaymentDate(val)
                  if (val) {
                    const parts = val.split('-')
                    if (parts.length === 3) {
                      const d = parseInt(parts[2], 10)
                      if (d >= 1 && d <= 31) setDueDay(String(d))
                    }
                  }
                }}
              />

              {/* Field Form: Tanggal Jatuh Tempo (1–31) */}
              <div>
                <label className="text-xs text-muted-foreground font-medium mb-1 block">
                  Tanggal Jatuh Tempo (1–31)
                </label>
                <div className="relative w-full h-12 rounded-2xl bg-[#F6F6F6] dark:bg-[#18181b] border border-border/70 dark:border-white/10 text-sm font-semibold text-foreground px-4 flex items-center gap-2.5">
                  <Calendar size={16} className="text-muted-foreground shrink-0" />
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={dueDay}
                    onChange={(e) => setDueDay(e.target.value)}
                    placeholder="10"
                    className="w-full text-sm font-semibold text-foreground bg-transparent outline-none tabular-nums text-left"
                  />
                  <span className="text-xs text-muted-foreground font-medium shrink-0">
                    Tiap bulan
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1 px-1">
                  Tagihan wajib dilunasi sebelum atau pada tanggal {dueDay || '10'} setiap bulannya.
                </p>
              </div>

              {/* Field Form: Limit Kredit (Opsional) */}
              <div>
                <label className="text-xs text-muted-foreground font-medium mb-1 block">
                  Limit Kredit (Opsional)
                </label>
                <div className="relative rounded-2xl bg-muted/40 border border-border/30 p-3.5 flex items-center gap-2">
                  <span className="text-base font-bold text-foreground select-none shrink-0 pl-1">
                    {currencySymbol}
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={creditLimit}
                    onChange={(e) => handleAmountChange(e, setCreditLimit)}
                    placeholder="1.000.000"
                    className="w-full text-base font-bold text-foreground bg-transparent outline-none tabular-nums placeholder:text-muted-foreground/30"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground mt-1 px-1">
                  Pagu batas maksimal saldo paylater yang dapat digunakan.
                </p>
              </div>

              {/* Field Form: Tagihan Bulan Ini (Opsional) */}
              <div>
                <label className="text-xs text-muted-foreground font-medium mb-1 block">
                  Estimasi Tagihan Bulan Ini (Opsional)
                </label>
                <div className="relative rounded-2xl bg-muted/40 border border-border/30 p-3.5 flex items-center gap-2">
                  <span className="text-base font-bold text-foreground select-none shrink-0 pl-1">
                    {currencySymbol}
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={currentBillAmount}
                    onChange={(e) => handleAmountChange(e, setCurrentBillAmount)}
                    placeholder="0"
                    className="w-full text-base font-bold text-foreground bg-transparent outline-none tabular-nums placeholder:text-muted-foreground/30"
                  />
                </div>
              </div>

              {/* Sakelar Toggle Hijau: Pengingat (Reminder) */}
              <div className="p-3.5 rounded-2xl bg-muted/30 border border-border/30 flex items-center justify-between">
                <div className="flex items-center gap-3 pr-2">
                  <div className="w-8 h-8 rounded-xl bg-muted/60 flex items-center justify-center text-foreground shrink-0">
                    <Bell size={16} strokeWidth={1.75} />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-foreground block">
                      Pengingat (Reminder)
                    </span>
                    <span className="text-[11px] text-muted-foreground block mt-0.5">
                      Beri pengingat tagihan dan tampilkan di checklist Bills sebelum jatuh tempo.
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEnableReminder(!enableReminder)}
                  className={cn(
                    'w-11 h-6 rounded-full transition-colors relative cursor-pointer shrink-0',
                    enableReminder ? 'bg-emerald-500' : 'bg-muted border border-border/40'
                  )}
                >
                  <div
                    className={cn(
                      'w-5 h-5 rounded-full bg-white transition-transform shadow-xs absolute top-0.5',
                      enableReminder ? 'right-0.5' : 'left-0.5'
                    )}
                  />
                </button>
              </div>

              {/* Field Form: Catatan (Opsional) */}
              <div>
                <label className="text-xs text-muted-foreground font-medium mb-1 block">
                  Catatan (Opsional)
                </label>
                <div className="relative rounded-2xl bg-muted/40 border border-border/30 p-3 flex items-start gap-2">
                  <FileText size={16} className="text-muted-foreground shrink-0 mt-1" />
                  <textarea
                    rows={2}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="e.g. Auto-debet dari Rekening BCA"
                    className="w-full text-xs font-medium text-foreground bg-transparent outline-none placeholder:text-muted-foreground/40 resize-none"
                  />
                </div>
              </div>

              {/* Bottom Actions for Editing Mode */}
              {plan && (
                <div className="pt-4 border-t border-border/30">
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={isSubmitting}
                    className="w-full text-center text-sm font-semibold text-rose-500 hover:opacity-80 py-2.5 rounded-xl transition-all cursor-pointer"
                  >
                    Hapus Paket PayLater Ini
                  </button>
                </div>
              )}
            </div>
    </Sheet>
  )
}

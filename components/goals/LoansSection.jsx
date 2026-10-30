'use client'
import { useState, useMemo } from 'react'
import {
  CreditCard,
  Plus,
  ShoppingBag,
  Zap,
  Wallet,
  Building2,
  Smartphone,
  Calendar,
  Layers,
  ChevronRight,
} from 'lucide-react'
import { cn, triggerHaptic } from '@/lib/utils'
import { Sheet } from '@/components/arshif/ui'
import LoanModal from './LoanModal'
import PostpaidPlanModal from './PostpaidPlanModal'

// Provider to Icon mapping helper
function getProviderIcon(item) {
  const provId = item?.provider_id?.toLowerCase() || ''
  const name = (item?.name || item?.title || '').toLowerCase()

  if (provId.includes('spay') || name.includes('spay') || name.includes('shopee')) return ShoppingBag
  if (provId.includes('kredivo') || name.includes('kredivo')) return Zap
  if (provId.includes('gopay') || name.includes('gopay')) return Wallet
  if (provId.includes('akulaku') || name.includes('akulaku')) return Wallet
  if (provId.includes('kta') || name.includes('kta') || name.includes('bca') || name.includes('mandiri') || name.includes('bank')) return Building2
  if (provId.includes('cc') || name.includes('kartu kredit') || name.includes('credit')) return CreditCard
  return CreditCard
}

export default function LoansSection({
  loans = [],
  home = 'IDR',
  accounts = [],
  rates = {},
  store,
  fmt = (amt, curr) => `${curr} ${amt}`,
  t = (k) => k,
  onRefresh,
}) {
  // State for Type Action Sheet (Mengacu image_15.png)
  const [typeActionSheetOpen, setTypeActionSheetOpen] = useState(false)

  // State for Loan/Instalment Modal
  const [loanModalOpen, setLoanModalOpen] = useState(false)
  const [selectedLoan, setSelectedLoan] = useState(null)

  // State for Postpaid Plan Modal
  const [postpaidModalOpen, setPostpaidModalOpen] = useState(false)
  const [selectedPostpaid, setSelectedPostpaid] = useState(null)

  // Strict filter: only items that are genuinely loans, debts, or installments
  const validLoans = useMemo(() => {
    return (loans || []).filter((l) => {
      if (!l) return false
      const type = String(l?.type || '').toLowerCase()
      if (['loan', 'debt', 'bnpl', 'postpaid', 'installment', 'cicilan', 'pinjaman'].includes(type)) return true
      if (l?.debt_type != null || l?.debt_mode != null || Boolean(l?.is_debt)) return true
      if (l?.tenure != null || l?.tenure_months != null || l?.tenor_months != null || l?.remaining_tenor != null) return true
      if (l?.interest != null || l?.interest_rate != null) return true
      if (l?.installment_amount != null || l?.monthly_installment != null || l?.total_loan_amount != null) return true
      return false
    })
  }, [loans])

  // Calculate total monthly installment
  const totalLoanInstallment = useMemo(() => {
    return validLoans.reduce((sum, l) => {
      const amt = Number(l?.installment_amount || l?.monthly_payment || l?.monthly_installment || l?.amount) || 0
      return sum + amt
    }, 0)
  }, [validLoans])

  // Subtitle based on currency
  const bnplSubtitle = useMemo(() => {
    if (home === 'MYR') return t('loans_empty_my', 'Track Atome, SPayLater, Grab, bank financing & more.')
    if (home === 'TRY') return t('loans_empty_tr', 'Track loans, cash advances, BNPL & flexible accounts.')
    return t('loans_empty_id', 'Track SPayLater, GoPay Later, Kredivo, bank loans & installments.')
  }, [home, t])

  // Open appropriate edit modal
  const handleCardClick = (item) => {
    if (item?.debt_mode === 'postpaid') {
      setSelectedPostpaid(item)
      setPostpaidModalOpen(true)
    } else {
      setSelectedLoan(item)
      setLoanModalOpen(true)
    }
  }

  return (
    <div>
      {/* Header section with (+) button */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          {t('loans_bnpl', 'Loans & BNPL')}
        </span>
        <div className="flex items-center">
          <span className="text-xs text-muted-foreground mr-3 font-medium">
            {fmt(totalLoanInstallment, home)}/mo
          </span>
          <button
            type="button"
            onClick={() => setTypeActionSheetOpen(true)}
            className="w-7 h-7 rounded-full bg-foreground text-background flex items-center justify-center hover:opacity-90 active:scale-95 transition-all shadow-xs cursor-pointer"
            aria-label={t('add_loan_choice', '+ Add loan or BNPL installment')}
            data-testid="new-loan"
          >
            <Plus size={15} strokeWidth={2.5} />
          </button>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground/80 mb-3 font-normal">
        {bnplSubtitle}
      </p>

      {/* List or Empty State */}
      {(!validLoans || validLoans.length === 0) ? (
        <button
          type="button"
          onClick={() => setTypeActionSheetOpen(true)}
          className="w-full min-h-[90px] rounded-2xl border border-dashed border-border/80 bg-white dark:bg-[#121214] py-7 px-4 text-center text-sm font-medium text-muted-foreground hover:border-foreground/40 hover:text-foreground transition-all cursor-pointer flex items-center justify-center shadow-xs"
        >
          {t('add_loan_choice', '+ Add loan or BNPL installment')}
        </button>
      ) : (
        <div className="space-y-2.5">
          {validLoans.map((loan) => {
            // Pemetaan properti yang aman dan kompatibel dengan skema Supabase & modal
            const installmentAmt = Number(
              loan.monthly_installment || 
              loan.installment_amount || 
              loan.monthly_payment || 
              loan.target_amount || 
              loan.amount
            ) || 0

            const isPostpaid = loan.debt_type === 'postpaid' || loan.debt_mode === 'postpaid'
            const tenor = Number(loan.tenure_months || loan.remaining_tenor || loan.tenor_months) || 0
            const totalPrincipal = Number(loan.total_loan_amount || loan.total_amount || loan.target_amount) || 0
            const dueDay = loan.due_day_of_month || loan.due_day || 10
            const Icon = getProviderIcon(loan)

            // Teks Subjudul yang adaptif
            let subtitleText = ''
            if (isPostpaid) {
              subtitleText = `${t('loan_postpaid_title', 'Monthly Postpaid')} · ${t('due_on_day', 'Due day')} ${dueDay}`
            } else if (tenor > 0) {
              subtitleText = `${tenor} ${t('remaining_tenor', 'months left')} · ${t('due_on_day', 'Due day')} ${dueDay}`
            } else {
              subtitleText = `${t('due_on_day', 'Due day')} ${dueDay}`
            }

            return (
              <div
                key={loan.id}
                onClick={() => handleCardClick(loan)}
                className="rounded-2xl border border-border/40 bg-card p-4 flex items-center justify-between hover:bg-muted/20 transition-all cursor-pointer shadow-xs group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-muted/60 text-foreground flex items-center justify-center shrink-0 border border-border/20">
                    <Icon size={18} strokeWidth={1.75} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate group-hover:text-foreground/90">
                      {loan.title || loan.name || loan.provider_name || t('loan_instalment_title', 'Loan')}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {subtitleText}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0 ml-3">
                  <p className="text-sm font-bold text-foreground tabular-nums">
                    {fmt(installmentAmt, loan.currency || home)}
                    <span className="text-[11px] font-normal text-muted-foreground">/mo</span>
                  </p>
                  {totalPrincipal > 0 && !isPostpaid && (
                    <p className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">
                      {t('total_payment', 'Total')}: {fmt(totalPrincipal, loan.currency || home)}
                    </p>
                  )}
                  {isPostpaid && Number(loan.credit_limit) > 0 && (
                    <p className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">
                      Limit: {fmt(Number(loan.credit_limit), loan.currency || home)}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Pilihan jenis utang */}
      <Sheet
        open={typeActionSheetOpen}
        onClose={() => setTypeActionSheetOpen(false)}
        zIndex={70}
        title={t('choose_loan_type', 'Choose Loan / BNPL Type')}
      >
        <div className="space-y-4 pt-1">
          <p className="text-xs text-muted-foreground text-center font-medium">
            {t('choose_loan_type', 'Choose Loan / BNPL Type')}
          </p>

          {/* Action Buttons */}
          <div className="space-y-2.5">
                        <button
              type="button"
              onClick={() => {
                triggerHaptic('light')
                setTypeActionSheetOpen(false)
                setSelectedLoan(null)
                setLoanModalOpen(true)
              }}
              className="w-full p-4 rounded-2xl bg-muted/40 hover:bg-muted/70 active:scale-[0.99] border border-border/40 text-left transition-all cursor-pointer flex items-center justify-between group"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-foreground text-background flex items-center justify-center shrink-0">
                  <CreditCard size={20} strokeWidth={1.75} />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">
                    {t('loan_instalment_title', 'Loan or BNPL Installment')}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t('loan_instalment_desc', 'Cicilan tenor 3–36 bln, KTA, Kartu Kredit, atau PayLater')}
                  </p>
                </div>
              </div>
              <ChevronRight size={18} className="text-muted-foreground group-hover:text-foreground shrink-0" />
            </button>

            {/* Tombol Pilihan 2: Tagihan Bulanan PayLater (SPayLater, GoPay Later, dll.) */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light')
                setTypeActionSheetOpen(false)
                setSelectedPostpaid(null)
                setPostpaidModalOpen(true)
              }}
              className="w-full p-4 rounded-2xl bg-muted/40 hover:bg-muted/70 active:scale-[0.99] border border-border/40 text-left transition-all cursor-pointer flex items-center justify-between group"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-foreground text-background flex items-center justify-center shrink-0">
                  <ShoppingBag size={20} strokeWidth={1.75} />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">
                    {t('loan_postpaid_title', 'Monthly Postpaid / PayLater Plan')}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t('loan_postpaid_desc', 'SPayLater, GoPay Later, Kredivo 30 hari tanpa tenor tetap')}
                  </p>
                </div>
              </div>
              <ChevronRight size={18} className="text-muted-foreground group-hover:text-foreground shrink-0" />
            </button>
          </div>
        </div>
      </Sheet>

      {/* Modal cicilan & pinjaman */}
      <LoanModal
        open={loanModalOpen}
        onClose={() => {
          setLoanModalOpen(false)
          setSelectedLoan(null)
        }}
        loan={selectedLoan}
        onSaved={async () => {
          await onRefresh?.()
          setLoanModalOpen(false)
          setSelectedLoan(null)
        }}
        onDeleted={async () => {
          setSelectedLoan(null)
          setLoanModalOpen(false)
          await onRefresh?.()
        }}
        home={home}
        accounts={accounts}
        store={store}
        t={t}
      />

      {/* Modal tagihan paylater */}
      <PostpaidPlanModal
        open={postpaidModalOpen}
        onClose={() => {
          setPostpaidModalOpen(false)
          setSelectedPostpaid(null)
        }}
        plan={selectedPostpaid}
        onSaved={async () => {
          await onRefresh?.()
          setPostpaidModalOpen(false)
          setSelectedPostpaid(null)
        }}
        onDeleted={async () => {
          setSelectedPostpaid(null)
         setPostpaidModalOpen(false)
          await onRefresh?.()
          }}
        home={home}
        store={store}
        t={t}
      />
    </div>
  )
}

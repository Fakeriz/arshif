'use client'
import { useState } from 'react'
import { Crown, ChevronRight, CreditCard, Bot, Calculator, Tags, Users, HandCoins, Workflow, Repeat, TrendingUp, HeartPulse, Briefcase, Check, ReceiptText, Settings, Cloud } from 'lucide-react'
import { toast } from 'sonner'
import { useApp } from './context'
import { Card, SectionLabel, Sheet, PrimaryButton, SecondaryButton } from './ui'
import { getCurrency } from '@/lib/currencies'
import { LANGUAGES } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import RecurringSheet from './RecurringSheet'
import NetWorthSheet from './NetWorthSheet'
import HealthScoreSheet from './HealthScoreSheet'
import BusinessInvoiceSheet from './BusinessInvoiceSheet'
import AccountSupportSection from './AccountSupportSection'
import AppSettingsSheet from './AppSettingsSheet'

function Row({ icon: Icon, label, onClick, right, testId }) {
  return (
    <button type="button" onClick={onClick} className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-zinc-100 dark:active:bg-zinc-800/60 transition" data-testid={testId}>
      <div className="h-9 w-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white flex items-center justify-center"><Icon size={17} /></div>
      <span className="flex-1 font-semibold text-[15px] text-zinc-950 dark:text-white">{label}</span>
      {right ? <span className="text-sm text-zinc-600 dark:text-zinc-400 font-medium">{right}</span> : null}
      <ChevronRight size={16} className="text-zinc-400 dark:text-zinc-500" />
    </button>
  )
}

export default function MoreTab() {
  const { t, profile, open, home, sheets, close, userTier, isAiAllowed } = useApp()
  const isPremium = userTier === 'premium' || userTier === 'admin'
  const mode = profile?.usage_mode || 'personal'
  const [recurringOpen, setRecurringOpen] = useState(false)
  const [netWorthOpen, setNetWorthOpen] = useState(false)
  const [healthOpen, setHealthOpen] = useState(false)
  const [businessOpen, setBusinessOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [bizCtx, setBizCtxState] = useState(() => { try { return JSON.parse(localStorage.getItem('arshif_bizctx')) || 'personal' } catch { return 'personal' } })
  const setBizCtx = (c) => { setBizCtxState(c); try { localStorage.setItem('arshif_bizctx', JSON.stringify(c)) } catch {} }

  const provider = profile?.cloud_backup_provider
  const providerSubtitle =
    provider === 'google_drive' || provider === 'google'
      ? 'Google Drive'
      : provider === 'icloud'
      ? 'iCloud'
      : 'Local Storage'

  return (
    <div className="px-5 pt-2 pb-36">
      <div className="flex items-center justify-between pt-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-zinc-950 dark:text-white">{t('more')}</h1>
        <div className="flex items-center gap-2">
          {mode === 'both' ? (
            <div className="flex rounded-full bg-zinc-100 dark:bg-zinc-800 p-0.5" data-testid="more-ctx-switch">
              {['personal', 'business'].map((c) => (
                <button key={c} type="button" onClick={() => setBizCtx(c)} className={cn('px-3 py-1 rounded-full text-xs font-semibold transition', bizCtx === c ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 font-bold' : 'text-zinc-600 dark:text-zinc-400')}>{t(c)}</button>
              ))}
            </div>
          ) : null}
          <button type="button" onClick={() => setSettingsOpen(true)} aria-label="settings" className="h-9 w-9 rounded-full flex items-center justify-center text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 active:bg-zinc-200 transition" data-testid="more-settings"><Settings size={22} strokeWidth={1.75} /></button>
        </div>
      </div>

      <button type="button" onClick={() => open('paywall')} className="w-full mt-5 rounded-2xl bg-[#0A0A0B] text-white p-5 text-left relative overflow-hidden border border-white/10" data-testid="premium-card">
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/[0.05]" />
        <div className="flex items-center gap-2"><Crown size={18} /><p className="font-bold">{t('premium_title')}</p></div>
        <p className="text-sm text-white/60 mt-1">{t('current_plan')}: <span className="uppercase font-semibold">{userTier}</span></p>
        <span className="inline-block mt-3 rounded-xl bg-white text-zinc-950 text-sm font-bold px-4 py-2">{isPremium ? t('active', 'Active') : t('upgrade')}</span>
      </button>

      <SectionLabel className="mt-7 mb-2 px-1">{t('everyday')}</SectionLabel>
      <Card className="divide-y divide-zinc-200/60 dark:divide-white/5 overflow-hidden">
        <Row icon={CreditCard} label={t('accounts_cards')} onClick={() => open('accounts')} testId="more-accounts" />
        <Row icon={ReceiptText} label={t('bills_tracker')} onClick={() => open('bills')} testId="more-bills" />
        <Row
          icon={Bot}
          label={t('ai_coach')}
          onClick={() => {
            if (!isAiAllowed) {
              open('aiPremium')
            } else {
              open('coach')
            }
          }}
          testId="more-coach"
        />
        <Row icon={Calculator} label={t('loan_calculator')} onClick={() => open('loan')} testId="more-loan" />
        <Row icon={Tags} label={t('categories_templates')} onClick={() => open('catman')} testId="more-catman" />
        <Row icon={Users} label={t('split_bill')} onClick={() => open('split')} />
        <Row icon={HandCoins} label={t('debt_tracker')} onClick={() => open('debts')} testId="more-debts" />
      </Card>

      <SectionLabel className="mt-7 mb-2 px-1">{t('advanced')}</SectionLabel>
      <Card className="divide-y divide-zinc-200/60 dark:divide-white/5 overflow-hidden">
        <Row icon={Cloud} label={t('cloud_receipt_backup', 'Cloud Receipt Backup')} right={providerSubtitle} onClick={() => open('cloudBackup')} testId="more-cloud-backup" />
        <Row icon={Workflow} label={t('smart_automation')} onClick={() => open('automation')} testId="more-automation" />
        <Row icon={Repeat} label={t('recurring')} onClick={() => setRecurringOpen(true)} testId="more-recurring" />
        <Row icon={TrendingUp} label={t('net_worth')} onClick={() => setNetWorthOpen(true)} testId="more-networth" />
        <Row icon={HeartPulse} label={t('health_score')} onClick={() => setHealthOpen(true)} testId="more-health" />
        <Row icon={Briefcase} label={t('business_invoicing')} onClick={() => setBusinessOpen(true)} testId="more-business" />
      </Card>

      <AccountSupportSection />

      {/* Language sheet */}
      <Sheet open={!!sheets?.language} onClose={() => close('language')} title={t('language')}>
        <div className="space-y-2 pt-2">
          {LANGUAGES.map((l) => (
            <LangRow key={l.code} l={l} />
          ))}
        </div>
      </Sheet>

      <RecurringSheet open={recurringOpen} onClose={() => setRecurringOpen(false)} />
      <NetWorthSheet open={netWorthOpen} onClose={() => setNetWorthOpen(false)} />
      <HealthScoreSheet open={healthOpen} onClose={() => setHealthOpen(false)} />
      <BusinessInvoiceSheet open={businessOpen} onClose={() => setBusinessOpen(false)} />
      <AppSettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}

function LangRow({ l }) {
  const { lang, setLang, close } = useApp()
  const active = lang === l.code
  return (
    <button type="button" onClick={() => { setLang(l.code); close('language') }} className="w-full flex items-center gap-3 rounded-xl bg-white dark:bg-[#1c1c1e] border border-zinc-200 dark:border-white/10 px-4 py-3.5 text-zinc-950 dark:text-white" data-testid={`lang-${l.code}`}>
      <span className="text-2xl">{l.flag}</span>
      <span className="flex-1 text-left font-semibold text-zinc-950 dark:text-white">{l.name}</span>
      {active ? <Check size={18} strokeWidth={2.5} className="text-zinc-950 dark:text-white" /> : null}
    </button>
  )
}

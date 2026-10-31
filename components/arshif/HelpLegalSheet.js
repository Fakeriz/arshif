'use client'
import { useState } from 'react'
import { ChevronLeft, ChevronDown, Mail, Copy, Check, HelpCircle, ShieldCheck, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { useApp } from './context'
import { Sheet } from './ui'
import { cn } from '@/lib/utils'

// Support email - placeholder until the team confirms the public address.
export const SUPPORT_EMAIL = 'support@arshif.biz.id'

const FAQ_ITEMS = [
  { q: 'faq_1q', a: 'faq_1a' },
  { q: 'faq_2q', a: 'faq_2a' },
  { q: 'faq_3q', a: 'faq_3a' },
  { q: 'faq_4q', a: 'faq_4a' },
  { q: 'faq_5q', a: 'faq_5a' },
  { q: 'faq_6q', a: 'faq_6a' },
]

const PRIVACY_CLAUSES = [
  ['privacy_collected_t', 'privacy_collected_b'],
  ['privacy_use_t', 'privacy_use_b'],
  ['privacy_share_t', 'privacy_share_b'],
  ['privacy_security_t', 'privacy_security_b'],
  ['privacy_rights_t', 'privacy_rights_b'],
  ['privacy_contact_t', 'privacy_contact_b'],
  ['privacy_changes_t', 'privacy_changes_b'],
]

const TERMS_CLAUSES = [
  ['terms_accept_t', 'terms_accept_b'],
  ['terms_account_t', 'terms_account_b'],
  ['terms_usage_t', 'terms_usage_b'],
  ['terms_payments_t', 'terms_payments_b'],
  ['terms_ip_t', 'terms_ip_b'],
  ['terms_liability_t', 'terms_liability_b'],
  ['terms_changes_t', 'terms_changes_b'],
  ['terms_contact_t', 'terms_contact_b'],
]

export default function HelpLegalSheet({ open, onClose }) {
  const { t } = useApp()
  const [view, setView] = useState('faq')
  const [openFaq, setOpenFaq] = useState(0)
  const [copied, setCopied] = useState(false)

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(SUPPORT_EMAIL)
      setCopied(true)
      toast.success(t('help_copied'))
      setTimeout(() => setCopied(false), 1600)
    } catch {
      toast.error(t('error'))
    }
  }

  const header = view === 'faq' ? undefined : (
    <button
      type="button"
      onClick={() => setView('faq')}
      className="flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
    >
      <ChevronLeft size={18} />
      {t('help_faq')}
    </button>
  )

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('help_legal')}
      left={header}
      data-testid="help-sheet"
    >
      {view === 'faq' ? (
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setView('faq')}
              className="h-16 rounded-2xl border border-[#FF5F6D]/40 bg-[#FF5F6D]/10 text-[#FF5F6D] flex flex-col items-center justify-center gap-1 text-[11px] font-bold transition-all active:scale-95 cursor-pointer"
            >
              <HelpCircle size={18} />
              {t('help_faq')}
            </button>
            <button
              type="button"
              onClick={() => setView('privacy')}
              className="h-16 rounded-2xl border border-border/70 bg-white dark:bg-[#18181b] text-foreground flex flex-col items-center justify-center gap-1 text-[11px] font-bold transition-all active:scale-95 cursor-pointer"
            >
              <ShieldCheck size={18} />
              {t('help_privacy')}
            </button>
            <button
              type="button"
              onClick={() => setView('terms')}
              className="h-16 rounded-2xl border border-border/70 bg-white dark:bg-[#18181b] text-foreground flex flex-col items-center justify-center gap-1 text-[11px] font-bold transition-all active:scale-95 cursor-pointer"
            >
              <FileText size={18} />
              {t('help_terms')}
            </button>
          </div>

          <div className="rounded-2xl border border-border/70 overflow-hidden divide-y divide-border/60 bg-white dark:bg-[#18181b]">
            {FAQ_ITEMS.map((item, i) => {
              const open = openFaq === i
              return (
                <div key={item.q}>
                  <button
                    type="button"
                    onClick={() => setOpenFaq(open ? -1 : i)}
                    aria-expanded={open}
                    className="w-full flex items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-muted/30 cursor-pointer min-h-[44px]"
                  >
                    <span className="text-sm font-bold text-foreground flex-1">{t(item.q)}</span>
                    <ChevronDown size={18} className={cn('text-muted-foreground shrink-0 transition-transform', open && 'rotate-180')} />
                  </button>
                  {open && (
                    <p className="px-4 pb-4 text-sm text-muted-foreground leading-relaxed">{t(item.a)}</p>
                  )}
                </div>
              )
            })}
          </div>

          <div className="rounded-2xl border border-border/70 bg-white dark:bg-[#18181b] p-4 space-y-3">
            <p className="text-sm font-bold text-foreground">{t('help_contact')}</p>
            <p className="text-sm text-muted-foreground leading-relaxed">{t('help_contact_desc')}</p>
            <div className="flex items-center gap-3 rounded-xl bg-zinc-100 dark:bg-zinc-800/60 px-4 h-12">
              <Mail size={16} className="text-muted-foreground shrink-0" />
              <span className="text-sm font-semibold text-foreground flex-1 truncate">{SUPPORT_EMAIL}</span>
              <button
                type="button"
                onClick={copyEmail}
                aria-label={t('help_copy_email')}
                className="h-10 px-3 rounded-lg bg-black text-white dark:bg-white dark:text-black text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? t('help_copied') : t('help_copy_email')}
              </button>
            </div>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="block w-full text-center rounded-2xl bg-[#0c0c0e] hover:bg-zinc-900 text-white dark:bg-white dark:hover:bg-zinc-100 dark:text-[#0c0c0e] font-bold py-3.5 text-[15px] transition-all"
            >
              {t('help_contact')}
            </a>
          </div>
        </div>
      ) : null}

      {(view === 'privacy' || view === 'terms') && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {view === 'privacy' ? t('privacy_intro') : t('terms_intro')}
          </p>
          <div className="space-y-3">
            {(view === 'privacy' ? PRIVACY_CLAUSES : TERMS_CLAUSES).map(([tk, bk]) => (
              <div key={tk} className="rounded-2xl border border-border/70 bg-white dark:bg-[#18181b] p-4">
                <h4 className="text-sm font-bold text-foreground">{t(tk)}</h4>
                <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{t(bk)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </Sheet>
  )
}

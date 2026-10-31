'use client'
import { useState, useEffect } from 'react'
import { Crown, Check, Loader2, Mail } from 'lucide-react'
import { toast } from 'sonner'
import { useApp } from './context'
import { Sheet, PrimaryButton, SecondaryButton } from './ui'
import { getSupabase } from '@/lib/supabase'
import { getCurrency } from '@/lib/currencies'
import {
  PLAN_LIMITS,
  PLAN_LIMIT_KIND,
  formatLimit,
  USAGE_TRACKED_RESOURCES,
} from '@/lib/plan-limits'

// Label pendek per resource untuk tabel paywall (fallback t() karena key i18n
// belum ditambahkan ke lib/i18n.js, lihat catatan agent).
const RESOURCE_LABELS = {
  accounts_wallets: 'Dompet & Rekening',
  savings_goals: 'Target Tabungan',
  loans_bills: 'Tagihan & Utang',
  subscriptions: 'Langganan',
  smart_automation_per_month: 'Smart Automation / bulan',
  receipt_ocr_per_month: 'Scan Struk (OCR) / bulan',
  statement_import_per_month: 'Impor Rekening Koran / bulan',
  invoices_per_month: 'Faktur / bulan',
  money_tax_tools: 'Fitur Uang & Pajak',
}

const ADMIN_EMAIL = 'support@arshif.biz.id'

export default function PaywallSheet({ open, onClose }) {
  const { t, home, userTier } = useApp()
  const [loading, setLoading] = useState(false)
  const [usage, setUsage] = useState(null)
  const isPremium = userTier === 'premium' || userTier === 'admin'

  useEffect(() => {
    if (!open) {
      document.body.style.removeProperty('overflow')
      document.body.style.removeProperty('pointer-events')
      document.body.style.removeProperty('position')
      document.body.style.removeProperty('touch-action')
      document.documentElement.style.removeProperty('overflow')
      return
    }
    // Pemakaian bulan ini dari RPC get_feature_usage. Gagal (mis. migrasi
    // belum dijalankan) tidak memblokir sheet: tabel limits tetap tampil.
    let active = true
    setUsage(null)
    const supabase = getSupabase()
    Promise.resolve().then(async () => {
      const { data: userData } = await supabase.auth.getUser()
      const uid = userData?.user?.id
      if (!active || !uid) return
      const entries = await Promise.all(
        USAGE_TRACKED_RESOURCES.map(async (resource) => {
          const { data } = await supabase.rpc('get_feature_usage', { p_uid: uid, p_resource: resource })
          return [resource, data?.used ?? 0]
        })
      )
      if (active) setUsage(Object.fromEntries(entries))
    }).catch(() => {})
    return () => { active = false }
  }, [open])

  const handleUpgrade = async () => {
    if (isPremium) {
      toast.info(t('already_premium') || 'Akun Anda sudah berstatus Premium/Admin.')
      onClose?.()
      return
    }

    setLoading(true)
    try {
      toast.info(t('payment_not_configured') || 'Pembayaran Premium belum tersedia. Hubungi admin untuk aktivasi.')
    } finally {
      setLoading(false)
    }
  }

  // Kalimat perbandingan untuk resource bulanan: "12 / 30 bulan ini".
  const usageCell = (resource, tier) => {
    const limit = formatLimit(resource, tier)
    if (!USAGE_TRACKED_RESOURCES.includes(resource) || usage === null) return limit
    const used = usage[resource]
    if (used === undefined) return limit
    return `${used} / ${limit}`
  }

  const cell = (resource, tier) => (
    PLAN_LIMIT_KIND[resource] === 'monthly' ? usageCell(resource, tier) : formatLimit(resource, tier)
  )

  return (
    <Sheet open={open} onClose={onClose} title={t('unlock_premium') || 'Arshif Premium'}>
      <div className="pt-2 pb-2">
        <div className="h-14 w-14 rounded-2xl bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 flex items-center justify-center mx-auto">
          <Crown size={26} />
        </div>
        <h2 className="text-2xl font-extrabold text-center mt-4 text-zinc-950 dark:text-white">
          {t('unlock_premium')}
        </h2>
        <p className="text-center text-zinc-600 dark:text-zinc-400 text-sm mt-1">
          {t('current_plan')}: <span className="font-bold uppercase">{userTier}</span>
        </p>

        <div className="mt-5 rounded-xl bg-white dark:bg-[#1c1c1e] border border-zinc-200 dark:border-white/10 overflow-hidden">
          <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-4 py-2.5 bg-zinc-50 dark:bg-white/5 text-xs font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                {t('paywall_feature')}
            <span className="text-right w-14">{t('free')}</span>
                {t('paywall_premium')}
          </div>
          {Object.keys(PLAN_LIMITS).map((resource) => (
            <div
              key={resource}
              className="grid grid-cols-[1fr_auto_auto] gap-2 px-4 py-2.5 border-t border-zinc-100 dark:border-white/5 text-sm"
            >
              <span className="text-zinc-800 dark:text-zinc-200">{RESOURCE_LABELS[resource]}</span>
              <span className="text-right w-14 text-zinc-600 dark:text-zinc-400">{cell(resource, 'free')}</span>
              <span className="text-right w-16 font-bold text-zinc-950 dark:text-white">{cell(resource, 'premium')}</span>
            </div>
          ))}
        </div>

        <p className="text-center mt-6">
          <span className="text-3xl font-extrabold text-zinc-950 dark:text-white">
            {getCurrency(home).symbol}{' '}
            {home === 'IDR' ? '49.000' : home === 'MYR' ? '14.90' : home === 'TRY' ? '99' : '4.99'}
          </span>
          <span className="text-zinc-600 dark:text-zinc-400 text-sm"> {t('per_month')}</span>
        </p>

        {isPremium ? (
          <div className="mt-5 space-y-2">
            <PrimaryButton onClick={handleUpgrade} disabled={loading} data-testid="paywall-confirm-upgrade">
              'Akun Anda Sudah Aktif'
            </PrimaryButton>
            <SecondaryButton onClick={onClose}>{t('maybe_later')}</SecondaryButton>
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            <a
              href={`mailto:${ADMIN_EMAIL}?subject=${encodeURIComponent('Aktivasi Arshif Premium')}&body=${encodeURIComponent('Halo, saya ingin mengaktifkan Arshif Premium. Email akun saya: ')}`}
              className="block"
              data-testid="paywall-mailto-admin"
            >
              <PrimaryButton className="w-full" disabled={loading} data-testid="paywall-confirm-upgrade">
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                  {t('paywall_opening_email')}
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <Mail size={18} /> {t('upgrade_now')}
                  </span>
                )}
              </PrimaryButton>
            </a>
            <p className="text-center text-xs text-zinc-600 dark:text-zinc-400">
              Pembayaran manual via transfer, hubungi admin di{' '}
              <a href={`mailto:${ADMIN_EMAIL}`} className="underline font-semibold text-zinc-950 dark:text-white">
                {ADMIN_EMAIL}
              </a>
            </p>
            <SecondaryButton onClick={onClose}>{t('maybe_later')}</SecondaryButton>
          </div>
        )}
      </div>
    </Sheet>
  )
}

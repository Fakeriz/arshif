'use client'
import { useState, useEffect } from 'react'
import { Crown, Check, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useApp } from './context'
import { Sheet, PrimaryButton, SecondaryButton } from './ui'
import { getCurrency } from '@/lib/currencies'

export default function PaywallSheet({ open, onClose }) {
  const { t, home, userTier } = useApp()
  const [loading, setLoading] = useState(false)
  const isPremium = userTier === 'premium' || userTier === 'admin'

  useEffect(() => {
    if (!open) {
      document.body.style.removeProperty('overflow')
      document.body.style.removeProperty('pointer-events')
      document.body.style.removeProperty('position')
      document.body.style.removeProperty('touch-action')
      document.documentElement.style.removeProperty('overflow')
    }
    return () => {
      document.body.style.removeProperty('overflow')
      document.body.style.removeProperty('pointer-events')
      document.body.style.removeProperty('position')
      document.body.style.removeProperty('touch-action')
      document.documentElement.style.removeProperty('overflow')
    }
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

        <div className="mt-6 space-y-3">
          {[t('perk_wallets'), t('perk_ocr'), t('perk_invoicing'), t('perk_tax')].map((p) => (
            <div
              key={p}
              className="flex items-center gap-3 rounded-xl bg-white dark:bg-[#1c1c1e] border border-zinc-200 dark:border-white/10 px-4 py-3"
            >
              <div className="h-6 w-6 rounded-full bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 flex items-center justify-center">
                <Check size={14} strokeWidth={3} />
              </div>
              <span className="font-semibold text-zinc-950 dark:text-white">{p}</span>
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

        <div className="mt-5 space-y-2">
          <PrimaryButton onClick={handleUpgrade} disabled={loading} data-testid="paywall-confirm-upgrade">
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 size={18} className="animate-spin" /> Mengupgrade...
              </span>
            ) : isPremium ? (
              'Akun Anda Sudah Aktif'
            ) : (
              t('upgrade_now')
            )}
          </PrimaryButton>
          <SecondaryButton onClick={onClose}>{t('maybe_later')}</SecondaryButton>
        </div>
      </div>
    </Sheet>
  )
}

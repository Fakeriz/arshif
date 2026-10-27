'use client'
import { useEffect } from 'react'
import { Crown, ScanLine, Mic, Bot } from 'lucide-react'
import { useApp } from './context'
import { Sheet, SecondaryButton } from './ui'

export default function AiPremiumSheet({ open, onClose, onUpgrade }) {
  const { t, open: openSheet } = useApp()

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

  const handleUpgrade = () => {
    onClose?.()
    if (onUpgrade) {
      onUpgrade()
    } else {
      openSheet?.('paywall')
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('ai_premium_sheet_title') || 'Arshif AI'}
      left={
        <button
          type="button"
          onClick={onClose}
          className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          data-testid="ai-premium-cancel-header"
        >
          Cancel
        </button>
      }
    >
      <div className="pt-2 pb-4 space-y-4">
        {/* Kartu Informasi (Monokrom Bersih) */}
        <div className="rounded-3xl bg-zinc-50 dark:bg-[#18181b] border border-zinc-200/90 dark:border-white/10 p-5 text-center">
          <div className="h-14 w-14 rounded-2xl bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 flex items-center justify-center mx-auto mb-3 shadow-sm">
            <Crown size={24} className="text-white dark:text-zinc-950" />
          </div>
          <h3 className="text-xl font-extrabold text-zinc-950 dark:text-white tracking-tight">
            Akses Eksklusif Fitur AI
          </h3>
          <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 mt-2 leading-relaxed max-w-sm mx-auto">
            Fitur pemindaian struk otomatis (OCR), pencatatan instan via suara, dan AI Financial Coach ditenagai oleh Google Gemini AI berkecepatan tinggi.
          </p>
        </div>

        {/* Daftar Keuntungan */}
        <div className="space-y-2.5">
          <div className="flex items-start gap-3.5 rounded-2xl bg-white dark:bg-[#1a1a1d] border border-zinc-200/80 dark:border-white/10 p-3.5 shadow-2xs">
            <div className="h-9 w-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white flex items-center justify-center shrink-0">
              <ScanLine size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-zinc-950 dark:text-white">{t('premium_ocr_title')}</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Foto struk kasir langsung jadi transaksi</p>
            </div>
          </div>

          <div className="flex items-start gap-3.5 rounded-2xl bg-white dark:bg-[#1a1a1d] border border-zinc-200/80 dark:border-white/10 p-3.5 shadow-2xs">
            <div className="h-9 w-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white flex items-center justify-center shrink-0">
              <Mic size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-zinc-950 dark:text-white">{t('premium_voice_title')}</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">&ldquo;Catat transaksi hanya dengan berbicara&rdquo;</p>
            </div>
          </div>

          <div className="flex items-start gap-3.5 rounded-2xl bg-white dark:bg-[#1a1a1d] border border-zinc-200/80 dark:border-white/10 p-3.5 shadow-2xs">
            <div className="h-9 w-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white flex items-center justify-center shrink-0">
              <Bot size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-zinc-950 dark:text-white">Personal AI Financial Coach 24/7</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Analisis pengeluaran dan rekomendasi hemat cerdas</p>
            </div>
          </div>
        </div>

        {/* Tombol Utama dan Sekunder */}
        <div className="space-y-2 pt-2">
          <button
            type="button"
            onClick={handleUpgrade}
            data-testid="ai-premium-upgrade"
            className="w-full rounded-2xl bg-zinc-950 hover:bg-zinc-900 text-white dark:bg-white dark:hover:bg-zinc-100 dark:text-zinc-950 font-bold py-3.5 text-[15px] transition-all shadow-md shadow-black/15 active:scale-[0.98] cursor-pointer"
          >
            Upgrade ke Premium
          </button>
          <SecondaryButton
            onClick={onClose}
            data-testid="ai-premium-later"
            className="w-full text-zinc-700 dark:text-zinc-300 font-semibold py-3.5 rounded-2xl"
          >
            Nanti Saja
          </SecondaryButton>
        </div>
      </div>
    </Sheet>
  )
}

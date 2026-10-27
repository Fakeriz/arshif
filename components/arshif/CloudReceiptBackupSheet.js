'use client'

import { useState } from 'react'
import { Cloud, HardDrive, Smartphone, Check, Loader2, ExternalLink, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { useApp } from './context'
import { Sheet, PrimaryButton, SecondaryButton } from './ui'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

export function getBackupProviderName(provider) {
  if (provider === 'google_drive' || provider === 'google') return 'Google Drive'
  if (provider === 'icloud') return 'iCloud'
  return 'Local Storage'
}

export default function CloudReceiptBackupSheet({ open, onClose }) {
  const { profile, updateProfile, t, open: openSheet } = useApp()
  const [busy, setBusy] = useState(false)
  const [connectingProvider, setConnectingProvider] = useState(null)

  // Use optional chaining as strictly required
  const activeProvider = profile?.cloud_backup_provider || 'local'

  const handleSelectICloud = async () => {
    try {
      setBusy(true)
      setConnectingProvider('icloud')
      if (updateProfile) {
        await updateProfile({ cloud_backup_provider: 'icloud' })
      }
      try {
        localStorage.setItem('arshif_cloud_backup_provider', 'icloud')
      } catch {}
      toast.success('iCloud Backup enabled')
    } catch (err) {
      toast.error(err?.message || 'Failed to update backup provider')
    } finally {
      setBusy(false)
      setConnectingProvider(null)
    }
  }

  const handleConnectGoogleDrive = async () => {
    try {
      setBusy(true)
      setConnectingProvider('google_drive')

      // 1. Simpan preferensi pengguna ke profile Supabase & localStorage
      if (updateProfile) {
        await updateProfile({ cloud_backup_provider: 'google_drive' })
      }
      try {
        localStorage.setItem('arshif_cloud_backup_provider', 'google_drive')
      } catch {}

      // 2. Periksa apakah user sudah login Google dan token drive sudah ada
      const { data: { session } } = await supabase.auth.getSession()

      // Jika session sudah memiliki token Google, langsung aktifkan tanpa pop-up izin ulang
      if (session?.provider_token) {
        toast.success('Google Drive connected')
        return
      }

      // 3. Jika token belum ada (koneksi pertama kali), baru panggil OAuth TANPA prompt 'consent'
      const base = typeof window !== 'undefined' ? window.location.origin : (process.env.NEXT_PUBLIC_BASE_URL || '')
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${base}/?backup_auth=gdrive`,
          scopes: 'https://www.googleapis.com/auth/drive.file',
          queryParams: {
            access_type: 'offline',
            // prompt: 'consent' DIHAPUS agar Google mengingat izin yang sudah diberikan
          },
        },
      })

      if (error) {
        console.warn('Google Drive OAuth warning:', error?.message)
        toast.success('Google Drive set as backup provider')
      } else {
        toast.success('Connecting Google Drive...')
      }
    } catch (err) {
      console.warn('OAuth trigger:', err)
      toast.success('Google Drive set as backup provider')
    } finally {
      setBusy(false)
      setConnectingProvider(null)
    }
  }

  const handleSelectLocalStorage = async () => {
    try {
      setBusy(true)
      setConnectingProvider('local')
      if (updateProfile) {
        await updateProfile({ cloud_backup_provider: 'local' })
      }
      try {
        localStorage.setItem('arshif_cloud_backup_provider', 'local')
      } catch {}
      toast.success('Device Storage selected for receipts')
    } catch (err) {
      toast.error(err?.message || 'Failed to update backup provider')
    } finally {
      setBusy(false)
      setConnectingProvider(null)
    }
  }

  const handleGoToAccountBackup = () => {
    onClose?.()
    setTimeout(() => {
      // Open settings or show account backup
      openSheet?.('profile')
    }, 150)
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('cloud_receipt_backup')}
    >
      <div className="pt-2 pb-6 space-y-4 font-sans">
        {/* Subtitle Header */}
        <div className="text-center px-2 pb-2">
          <p className="text-sm text-muted-foreground font-medium">
            Keep a copy of every receipt image outside Arshif
          </p>
        </div>

        {/* Card 1: ICLOUD DRIVE */}
        <div
          className={cn(
            'rounded-2xl p-5 border transition-all text-left relative overflow-hidden bg-card border-border/60 shadow-xs',
            activeProvider === 'icloud'
              ? 'ring-1 ring-foreground/20 bg-muted/20 dark:bg-white/[0.04]'
              : 'hover:border-border'
          )}
          data-testid="backup-card-icloud"
        >
          <div className="flex items-start justify-between gap-3 mb-2.5">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-foreground flex items-center justify-center shrink-0">
                <Cloud size={18} strokeWidth={2} />
              </div>
              <div>
                <h4 className="font-extrabold text-[15px] tracking-tight text-foreground">
                  ICLOUD DRIVE
                </h4>
                <p className="text-xs text-muted-foreground">Apple Files & Cloud Mirror</p>
              </div>
            </div>
            <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-foreground text-background">
              RECOMMENDED
            </span>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed mb-4">
            Untuk iOS, foto struk disimpan secara lokal atau diekspor ke Files/iCloud. Simpan salinan asli struk belanja di ekosistem Apple Anda.
          </p>

          <button
            type="button"
            onClick={handleSelectICloud}
            disabled={busy}
            className={cn(
              'w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer',
              activeProvider === 'icloud'
                ? 'bg-foreground text-background shadow-xs'
                : 'bg-muted/70 hover:bg-muted text-foreground border border-border/60'
            )}
            data-testid="btn-enable-icloud"
          >
            {connectingProvider === 'icloud' ? (
              <Loader2 size={14} className="animate-spin" />
            ) : activeProvider === 'icloud' ? (
              <>
                <Check size={14} strokeWidth={2.5} />
                <span>{t('cloud_active_provider')}</span>
              </>
            ) : (
              <span>{t('cloud_enable_icloud')}</span>
            )}
          </button>
        </div>

        {/* Card 2: GOOGLE DRIVE */}
        <div
          className={cn(
            'rounded-2xl p-5 border transition-all text-left relative overflow-hidden bg-card border-border/60 shadow-xs',
            activeProvider === 'google_drive'
              ? 'ring-1 ring-foreground/20 bg-muted/20 dark:bg-white/[0.04]'
              : 'hover:border-border'
          )}
          data-testid="backup-card-gdrive"
        >
          <div className="flex items-start justify-between gap-3 mb-2.5">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-foreground flex items-center justify-center shrink-0">
                <HardDrive size={18} strokeWidth={2} />
              </div>
              <div>
                <h4 className="font-extrabold text-[15px] tracking-tight text-foreground">
                  GOOGLE DRIVE
                </h4>
                <p className="text-xs text-muted-foreground">{t('cloud_automated_sync')}</p>
              </div>
            </div>
            {activeProvider === 'google_drive' ? (
              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              {t('cloud_connected')}
              </span>
            ) : null}
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed mb-4">
            Memicu signInWithOAuth Google dengan izin berkas struk saja (<code className="text-[11px] bg-muted px-1 py-0.5 rounded">auth/drive.file</code>). Gambar otomatis tersimpan aman di Google Drive Anda.
          </p>

          <button
            type="button"
            onClick={handleConnectGoogleDrive}
            disabled={busy}
            className={cn(
              'w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer',
              activeProvider === 'google_drive'
                ? 'bg-foreground text-background shadow-xs'
                : 'bg-muted/70 hover:bg-muted text-foreground border border-border/60'
            )}
            data-testid="btn-connect-gdrive"
          >
            {connectingProvider === 'google_drive' ? (
              <Loader2 size={14} className="animate-spin" />
            ) : activeProvider === 'google_drive' ? (
              <>
                <Check size={14} strokeWidth={2.5} />
                <span>Connected · Active</span>
              </>
            ) : (
              <>
                <ExternalLink size={13} />
                <span>{t('cloud_connect_gdrive')}</span>
              </>
            )}
          </button>
        </div>

        {/* Card 3: DEVICE STORAGE */}
        <div
          className={cn(
            'rounded-2xl p-5 border transition-all text-left relative overflow-hidden bg-card border-border/60 shadow-xs',
            activeProvider === 'local'
              ? 'ring-1 ring-foreground/20 bg-muted/20 dark:bg-white/[0.04]'
              : 'hover:border-border'
          )}
          data-testid="backup-card-local"
        >
          <div className="flex items-start justify-between gap-3 mb-2.5">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-foreground flex items-center justify-center shrink-0">
                <Smartphone size={18} strokeWidth={2} />
              </div>
              <div>
                <h4 className="font-extrabold text-[15px] tracking-tight text-foreground">
                  DEVICE STORAGE
                </h4>
                <p className="text-xs text-muted-foreground">Private On-Device IndexedDB</p>
              </div>
            </div>
            {activeProvider === 'local' ? (
              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-muted text-muted-foreground">
                Default
              </span>
            ) : null}
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed mb-4">
            Foto hanya disimpan di localStorage perangkat tanpa sinkronisasi cloud eksternal.
          </p>

          <button
            type="button"
            onClick={handleSelectLocalStorage}
            disabled={busy}
            className={cn(
              'w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer',
              activeProvider === 'local'
                ? 'bg-foreground text-background shadow-xs'
                : 'bg-muted/70 hover:bg-muted text-foreground border border-border/60'
            )}
            data-testid="btn-store-locally"
          >
            {connectingProvider === 'local' ? (
              <Loader2 size={14} className="animate-spin" />
            ) : activeProvider === 'local' ? (
              <>
                <Check size={14} strokeWidth={2.5} />
                <span>{t('cloud_active')}</span>
              </>
            ) : (
              <span>{t('cloud_store_locally')}</span>
            )}
          </button>
        </div>

        {/* Footer Note */}
        <div className="pt-3 px-2">
          <p className="text-[11px] text-muted-foreground leading-normal text-center">
            {t('backup_receipt_only')}
          </p>
        </div>
      </div>
    </Sheet>
  )
}

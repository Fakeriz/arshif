'use client'
import { useEffect, useRef, useState } from 'react'
import { Download, UploadCloud, DatabaseBackup, CheckCircle2, FileJson, Loader2, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { useApp } from './context'
import { Sheet, PrimaryButton, SecondaryButton } from './ui'
import { buildBackupPayload, validateBackupPayload, restoreBackupData, BACKUP_LAST_KEY } from '@/lib/backup'
import { APP_VERSION } from '@/lib/version'
import { cn } from '@/lib/utils'

function formatLast(iso) {
  if (!iso) return null
  try { return new Date(iso).toLocaleString() } catch { return iso }
}

export default function AccountBackupSheet({ open, onClose }) {
  const { t, accounts, transactions, goals, store, refresh } = useApp()
  const fileRef = useRef(null)
  const [lastBackup, setLastBackup] = useState(null)
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [confirm, setConfirm] = useState(null)

  useEffect(() => {
    if (!open) return
    try { setLastBackup(localStorage.getItem(BACKUP_LAST_KEY)) } catch { setLastBackup(null) }
  }, [open])

  const doExport = async () => {
    setExporting(true)
    try {
      const payload = buildBackupPayload({ accounts, transactions, goals, version: APP_VERSION })
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
      a.href = url
      a.download = `arshif-backup-${stamp}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      const now = new Date().toISOString()
      try { localStorage.setItem(BACKUP_LAST_KEY, now) } catch {}
      setLastBackup(now)
      toast.success(t('backup_export_done'))
    } catch {
      toast.error(t('error'))
    } finally {
      setExporting(false)
    }
  }

  const handleFile = async (file) => {
    if (!file || importing) return
    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      const res = validateBackupPayload(parsed)
      if (!res.ok) { toast.error(t('backup_invalid')); return }
      setConfirm({ data: res.data, name: file.name || '' })
    } catch {
      toast.error(t('backup_invalid'))
    }
  }

  const executeRestore = async () => {
    if (!confirm) return
    setImporting(true)
    setConfirm(null)
    try {
      await restoreBackupData(store, confirm.data)
      if (refresh) await refresh()
      toast.success(t('backup_success'))
    } catch (e) {
      console.warn('restore failed', e)
      toast.error(e?.message || t('error'))
    } finally {
      setImporting(false)
    }
  }

  const triggerPick = () => fileRef.current?.click()

  return (
    <Sheet open={open} onClose={onClose} title={t('account_backup')} data-testid="backup-sheet">
      <div className="space-y-5">
        <p className="text-sm text-muted-foreground leading-relaxed">{t('account_backup_sub')}</p>

        {/* Export */}
        <div className="rounded-2xl border border-border/70 bg-white dark:bg-[#18181b] p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-[#FF5F6D]/10 text-[#FF5F6D] flex items-center justify-center shrink-0">
              <DatabaseBackup size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-foreground">{t('backup_export')}</p>
              <p className="text-xs text-muted-foreground truncate">
                {accounts?.length || 0} {t('accounts')} · {transactions?.length || 0} {t('transactions')} · {goals?.length || 0} {t('goals')}
              </p>
            </div>
          </div>
          <PrimaryButton onClick={doExport} disabled={exporting} data-testid="backup-export">
            {exporting ? (
              <span className="flex items-center justify-center gap-2"><Loader2 size={16} className="animate-spin" />{t('backup_exporting')}</span>
            ) : (
              <span className="flex items-center justify-center gap-2"><Download size={16} />{t('backup_export')}</span>
            )}
          </PrimaryButton>
        </div>

        {/* Import / upload area */}
        <div className="space-y-2">
          <div
            role="button"
            tabIndex={0}
            aria-label={t('backup_choose_file')}
            onClick={triggerPick}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); triggerPick() } }}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer?.files?.[0]; if (f) handleFile(f) }}
            className={cn(
              'rounded-2xl border-2 border-dashed p-6 flex flex-col items-center justify-center text-center gap-2 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20',
              dragOver ? 'border-[#FF5F6D] bg-[#FF5F6D]/10' : 'border-border/70 hover:border-foreground/30'
            )}
          >
            <UploadCloud size={26} className="text-muted-foreground" />
            <p className="text-sm font-semibold text-foreground">{t('backup_upload_area')}</p>
            <p className="text-xs text-muted-foreground">{t('backup_file_hint')}</p>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              aria-hidden="true"
              tabIndex={-1}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }}
            />
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5 px-1">
            <AlertTriangle size={13} className="shrink-0" />
            {t('backup_will_replace')}
          </p>
        </div>

        {/* Last backup status */}
        <div className="rounded-2xl border border-border/70 bg-white dark:bg-[#18181b] p-4 flex items-center gap-3">
          <CheckCircle2 size={20} className={cn('shrink-0', lastBackup ? 'text-emerald-500' : 'text-muted-foreground/50')} />
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground">{t('backup_last')}</p>
            <p className="text-xs text-muted-foreground truncate">{lastBackup ? formatLast(lastBackup) : t('backup_never')}</p>
          </div>
        </div>

        <div className="h-2" />
      </div>

      {/* Restore confirmation */}
      {confirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-[#1c1c1e] border border-zinc-200 dark:border-white/10 p-6 shadow-2xl text-center space-y-4">
            <div className="h-14 w-14 rounded-2xl bg-[#FF5F6D]/10 text-[#FF5F6D] mx-auto flex items-center justify-center">
              <FileJson size={26} />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-950 dark:text-white">{t('backup_confirm_title')}</h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-2 leading-relaxed break-words">
                {t('backup_confirm_body')}{confirm.name ? `\n${confirm.name}` : ''}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <SecondaryButton onClick={() => setConfirm(null)}>{t('cancel')}</SecondaryButton>
              <PrimaryButton onClick={executeRestore} disabled={importing}>
                {importing ? t('backup_restoring') : t('backup_restore')}
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}
    </Sheet>
  )
}

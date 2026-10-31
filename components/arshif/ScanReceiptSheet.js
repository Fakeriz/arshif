'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, Upload, Loader2, ScanLine } from 'lucide-react'
import { toast } from 'sonner'
import { useApp } from './context'
import { Sheet, PrimaryButton, SecondaryButton, Card } from './ui'
import { QuotaBadge } from './QuotaBadge'
import { fileToDataUrl } from '@/lib/ledger'
import { lineTotal, reconcileItems } from '@/lib/split-bill'
import { consumeFeatureUsage } from '@/lib/feature-usage'
import { cn } from '@/lib/utils'

export default function ScanReceiptSheet({ open, onClose, onUse, initialImage, autoPick }) {
  const { t, home, fmt, session, isAiAllowed, open: openSheet, profile } = useApp()
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(false)
  const [uploadingBackup, setUploadingBackup] = useState(false)
  const [result, setResult] = useState(null)
  // Status auto-reconcile: 'ok' kalau diskon struk sudah ditambahkan otomatis.
  const [reconciled, setReconciled] = useState(false)
  const [quota, setQuota] = useState(null)
  const [quotaLoading, setQuotaLoading] = useState(false)
  const fileRef = useRef(null)
  const camRef = useRef(null)

  const fetchQuota = useCallback(async () => {
    if (!session?.access_token) return
    setQuotaLoading(true)
    try {
      const res = await fetch('/api/ai/usage', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setQuota(data)
      }
    } catch (e) {
      console.warn('Failed to fetch AI quota:', e)
    } finally {
      setQuotaLoading(false)
    }
  }, [session?.access_token])

  // Inti pemrosesan gambar struk: dipakai upload manual (onFile) maupun
  // gambar titipan dari Web Share Target (initialImage).
  const processDataUrl = useCallback(async (dataUrl) => {
    if (!dataUrl) return
    setBusy(true)
    setResult(null)
    setReconciled(false)
    try {
      setPreview(dataUrl)
      const headers = { 'Content-Type': 'application/json' }
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }
      const res = await fetch('/api/ai/ocr', {
        method: 'POST',
        headers,
        body: JSON.stringify({ imageBase64: dataUrl }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 403 || data?.code === 'AI_PREMIUM_REQUIRED') {
          onClose?.()
          openSheet?.('aiPremium')
          return
        }
        if (res.status === 429 || data?.code === 'AI_QUOTA_EXCEEDED') {
          toast.error(data?.error || 'Kuota AI harian Anda telah habis.')
          return
        }
        throw new Error(data?.error || t('error'))
      }

      if (data?.remaining !== undefined) {
        setQuota({
          remaining: data.remaining,
          total: data.total,
          is_unlimited: data.is_unlimited,
        })
      }

      // Konsumsi kuota OCR bulanan hanya setelah scan sukses - gagal OCR
      // tidak boleh memotong jatah. Blokir dari server (RPC P0001) tetap
      // jalan sendiri; di sini hanya feedback plus ke paywall.
      const usage = await consumeFeatureUsage('receipt_ocr_per_month')
      if (usage.allowed === false) {
        setResult(null)
        onClose?.()
        openSheet?.('paywall')
        return
      }

      const receiptData = data?.receipt || data || null
      setResult(receiptData)
    } catch (err) {
      toast.error(err?.message || t('error'))
    } finally { setBusy(false) }
  }, [session?.access_token, t, openSheet])

  // Auto-reconcile: samakan jumlah item dengan total struk (diskon struk
  // otomatis) atau laporkan item kurang. Logika murni ada di lib/split-bill.
  const applyReconcile = () => {
    if (!result) return
    const r = reconcileItems(result.items, result.total)
    if (r.missing) {
      toast.warning(t('reconcile_negative_items'))
      return
    }
    setResult((prev) => ({ ...prev, items: r.items }))
    setReconciled(true)
  }

  // Arahkan ke edit item yang sudah ada di TransactionDetailSheet (sheet
  // txDetail menerima objek transaksi; di sini belum tersimpan, cukup
  // tutup scan - user buka dari daftar transaksi setelah simpan).
  const editItemsManually = () => {
    onClose?.()
    openSheet?.('txDetail')
  }

  const initialRef = useRef(null)
  useEffect(() => {
    if (open) {
      if (!isAiAllowed) {
        onClose?.()
        openSheet?.('aiPremium')
        return
      }
      setPreview(null)
      setResult(null)
      setReconciled(false)
      setBusy(false)
      fetchQuota()
      // Gambar dari Web Share Target: langsung diproses OCR, sekali per buka.
      if (initialImage && initialRef.current !== initialImage) {
        initialRef.current = initialImage
        processDataUrl(initialImage)
      } else if (autoPick && !initialImage) {
        // Share tidak membawa gambar (Chrome tidak melampirkan file):
        // langsung tawarkan pilih foto manual.
        const t = setTimeout(() => { try { fileRef.current?.click() } catch {} }, 500)
        return () => clearTimeout(t)
      }
    } else {
      initialRef.current = null
    }
  }, [open, isAiAllowed, onClose, openSheet, fetchQuota, initialImage, autoPick, processDataUrl])


  const onFile = async (e) => {
    if (!isAiAllowed) {
      onClose?.()
      openSheet?.('aiPremium')
      return
    }
    const f = e.target.files?.[0]
    if (!f) return
    e.target.value = ''
    try {
      const dataUrl = await fileToDataUrl(f, 1600)
      await processDataUrl(dataUrl)
    } catch (err) {
      toast.error(err?.message || t('error'))
    }
  }

  const useIt = async () => {
    if (!result) return
    const now = new Date()
    const pad = (n) => String(n).padStart(2, '0')
    const fallbackTime = `${pad(now.getHours())}:${pad(now.getMinutes())}`
    const finalTime = result.time || fallbackTime
    const finalDate = result.transaction_date || (result.date ? `${result.date}T${finalTime}:00` : now.toISOString())

    const provider = profile?.cloud_backup_provider || 'local'
    let finalReceiptUrl = preview
    let storageProvider = 'local'

    if (provider === 'google_drive') {
      const gToken =
        session?.provider_token ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('arshif_gdrive_token') : null)
      setUploadingBackup(true)
      try {
        const headers = { 'Content-Type': 'application/json' }
        if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`
        if (gToken) headers['x-google-drive-token'] = gToken

        const res = await fetch('/api/backup/gdrive', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            imageBase64: preview,
            merchant: result.merchant || 'Toko',
            date: result.date || now.toISOString().split('T')[0],
            name: `Struk_${(result.merchant || 'Toko').replace(/\s+/g, '_')}_${result.date || now.toISOString().split('T')[0]}.jpg`,
          }),
        })

        if (res.ok) {
          const data = await res.json()
          if (data?.url) {
            finalReceiptUrl = data.url
            storageProvider = 'google_drive'
            toast.success('Foto struk dicadangkan ke Google Drive')
          }
        }
      } catch (err) {
        console.warn('Google Drive backup upload failed, stored locally:', err)
      } finally {
        setUploadingBackup(false)
      }
    } else {
      // provider is 'icloud' or 'local'
      storageProvider = 'local'
    }

    onUse?.({
      type: 'expense',
      amount: result.total,
      currency: result.currency || home,
      category: result.category || 'other',
      payment_method: result.payment_method || 'cash',
      merchant: result.merchant,
      receipt_number: result.receipt_number,
      items: result.items || [],
      receipt_url: finalReceiptUrl,
      receipt_preview: preview,
      // Data URL preview masuk kolom receipt_cache via store (sinkron antar-perangkat).
      receipt_cache: preview?.startsWith('data:') ? preview : null,
      storage_provider: storageProvider,
      note: result.merchant,
      time: finalTime,
      transaction_date: finalDate,
      date: finalDate,
    })
    onClose?.()
  }

  const cur = result?.currency || home

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('scan_receipt')}
      right={<QuotaBadge quota={quota} loading={quotaLoading} />}
      full={!!result}
    >
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} data-testid="scan-file" />
      <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />

      {!preview ? (
        <div className="pt-4 pb-4">
          <div className="rounded-2xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 h-48 flex flex-col items-center justify-center text-zinc-500 dark:text-zinc-400 gap-2">
            <ScanLine size={36} />
            <p className="text-sm font-semibold text-zinc-950 dark:text-white">{t('upload_receipt')}</p>
                {t('scan_gemini_ocr')}
          </div>
          <div className="grid grid-cols-2 gap-3 mt-4">
            <PrimaryButton
              onClick={() => {
                if (!isAiAllowed) {
                  onClose?.()
                  openSheet?.('aiPremium')
                  return
                }
                camRef.current?.click()
              }}
            >
              <Camera size={18} className="inline mr-2" />
              {t('take_photo')}
            </PrimaryButton>
            <SecondaryButton
              onClick={() => {
                if (!isAiAllowed) {
                  onClose?.()
                  openSheet?.('aiPremium')
                  return
                }
                fileRef.current?.click()
              }}
              data-testid="scan-upload"
            >
                {t('scan_upload')}
            </SecondaryButton>
          </div>
        </div>
      ) : (
        <div className="pt-2 pb-6">
          <div className="relative rounded-2xl overflow-hidden bg-zinc-100 dark:bg-zinc-800">
            <img src={preview} alt="receipt" className="w-full max-h-64 object-contain" />
            {busy ? (
              <div className="absolute inset-0 bg-background/70 backdrop-blur-sm flex flex-col items-center justify-center gap-2">
                <Loader2 className="animate-spin text-zinc-950 dark:text-white" size={28} />
                <p className="text-sm font-bold text-zinc-950 dark:text-white">{t('scanning')}</p>
              </div>
            ) : null}
          </div>

          {result ? (
            <div className="mt-5" data-testid="scan-result">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xl font-extrabold text-zinc-950 dark:text-white">{result.merchant || t('merchant')}</p>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 font-medium mt-0.5">
                    {result.receipt_number ? `${t('receipt_no')} ${result.receipt_number}` : ''}
                    {result.date ? ` · ${result.date}` : ''}
                    {result.time ? ` · ${result.time}` : ''}
                  </p>
                </div>
                <span className="text-[10px] font-bold uppercase rounded-md bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 px-2 py-1">{t(`cat_${result.category || 'other'}`)}</span>
              </div>
              <p className="text-4xl font-extrabold mt-4 tabular-nums text-zinc-950 dark:text-white">{fmt(result.total, cur)}</p>
              {result.totals_match === false && !reconciled ? (
                <div className="mt-2 text-xs text-amber-600 dark:text-amber-400 font-medium rounded-xl border border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/10 px-3 py-2">
                  <p>{t('items_sum_mismatch')} · {t('items')}: {fmt(result.items_total, cur)} · {t('total')}: {fmt(result.total, cur)}</p>
                  <div className="flex gap-2 mt-2">
                    <button type="button" onClick={applyReconcile} className="flex-1 rounded-lg bg-amber-600 text-white font-bold px-2 py-1.5 text-xs hover:bg-amber-700 transition-colors">{t('reconcile_apply')}</button>
                    <button type="button" onClick={editItemsManually} className="flex-1 rounded-lg border border-amber-500/60 text-amber-700 dark:text-amber-400 font-bold px-2 py-1.5 text-xs hover:bg-amber-100 dark:hover:bg-amber-500/10 transition-colors">{t('reconcile_manual')}</button>
                  </div>
                </div>
              ) : reconciled ? (
                <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400 font-medium rounded-xl border border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-500/10 px-3 py-2">{t('reconcile_edited')}</p>
              ) : null}
              <Card className="mt-4 overflow-hidden">
                <div className="grid grid-cols-[1fr_auto] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-600 dark:text-zinc-400 border-b border-zinc-200/60 dark:border-white/5"><span>{t('item')}</span><span>{t('price')}</span></div>
                {(result.items || []).map((it, i) => {
                  const qty = Number(it.qty) || 1
                  const disc = Number(it.discount) || 0
                  const notes = []
                  if (it.is_discount) notes.push(t('store_promo'))
                  if (qty > 1) notes.push(`${qty} × ${fmt(it.price, cur)}`)
                  if (disc > 0) notes.push(`−${t('discount')} ${fmt(disc, cur)}`)
                  return (
                    <div key={i} className="grid grid-cols-[1fr_auto] items-start gap-x-3 px-4 py-2.5 text-sm border-b border-zinc-200/40 dark:border-white/5 last:border-0">
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-zinc-950 dark:text-white">{it.name}</span>
                        {notes.length ? <span className="mt-0.5 block truncate text-xs text-zinc-500 dark:text-zinc-400">{notes.join(' · ')}</span> : null}
                      </span>
                      <span className="text-right">
                        {disc > 0 && !it.is_discount ? <span className="block text-xs font-normal tabular-nums text-zinc-400 dark:text-zinc-500 line-through">{fmt(it.price * qty, cur)}</span> : null}
                        <span className={cn('block font-bold tabular-nums', it.is_discount ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-950 dark:text-white')}>{fmt(lineTotal(it), cur)}</span>
                      </span>
                    </div>
                  )
                })}
                {!(result.items || []).length ? <p className="px-4 py-3 text-sm text-zinc-400 dark:text-zinc-500">-</p> : null}
              </Card>
              {Array.isArray(result.discounts) && result.discounts.length ? (
                <div className="mt-2 px-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-600 dark:text-zinc-400">{t('receipt_discounts')}</p>
                  {result.discounts.map((d, i) => (
                    <p key={i} className="text-sm text-emerald-600 dark:text-emerald-400 font-semibold tabular-nums mt-1">
                      {d?.label || d?.name || '-'}: −{fmt(Math.abs(Number(d?.amount)) || 0, cur)}
                    </p>
                  ))}
                </div>
              ) : null}
              <div className="mt-5 space-y-2">
                <PrimaryButton onClick={useIt} disabled={uploadingBackup} data-testid="scan-use">
                  {uploadingBackup ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 size={16} className="animate-spin" />
                      <span>{t('saving') || 'Saving...'}</span>
                    </span>
                  ) : (
                    t('use_this')
                  )}
                </PrimaryButton>
                <SecondaryButton disabled={uploadingBackup} onClick={() => fileRef.current?.click()}>{t('upload_receipt')}</SecondaryButton>
              </div>
            </div>
          ) : !busy ? (
            <div className="mt-4"><SecondaryButton onClick={() => fileRef.current?.click()}>{t('upload_receipt')}</SecondaryButton></div>
          ) : null}
        </div>
      )}
    </Sheet>
  )
}

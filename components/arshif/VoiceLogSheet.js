'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Mic, Square, Loader2, Check, Keyboard } from 'lucide-react'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import { useApp } from './context'
import { Sheet, PrimaryButton, TextInput, CategoryBadge, Card } from './ui'
import { QuotaBadge } from './QuotaBadge'
import { CATEGORIES } from '@/lib/categories'
import { cn } from '@/lib/utils'

export default function VoiceLogSheet({ open, onClose, onResult }) {
  const { t, home, lang, accounts = [], fmt, session, isAiAllowed, open: openSheet, store, refresh } = useApp()
  const [state, setState] = useState('idle') // idle | recording | processing | result
  const [transcript, setTranscript] = useState('')
  const [parsed, setParsed] = useState(null)
  const [typed, setTyped] = useState('')
  const [showTyped, setShowTyped] = useState(false)
  const [quota, setQuota] = useState(null)
  const [quotaLoading, setQuotaLoading] = useState(false)
  const recRef = useRef(null)
  const chunksRef = useRef([])

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

  useEffect(() => {
    if (open) {
      if (!isAiAllowed) {
        onClose?.()
        openSheet?.('aiPremium')
        return
      }
      setState('idle')
      setTranscript('')
      setParsed(null)
      setTyped('')
      setShowTyped(false)
      fetchQuota()
    }
  }, [open, isAiAllowed, onClose, openSheet, fetchQuota])

  const parseText = async (text) => {
    if (!isAiAllowed) {
      onClose?.()
      openSheet?.('aiPremium')
      return
    }
    setState('processing')
    try {
      const headers = { 'Content-Type': 'application/json' }
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }
      const res = await fetch('/api/ai/parse', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          text,
          homeCurrency: home,
          language: lang,
          accounts: accounts.map((a) => ({ id: a.id, name: a.name, currency: a.currency })),
          // Sertakan seluruh kategori pemasukan dan pengeluaran:
          categories: ['salary', 'food', 'groceries', 'transport', 'bills', 'shopping', 'entertainment', 'health', 'travel', 'education', 'business', 'other'],
        }),
      })

      // Cek apakah respons berupa JSON atau halaman HTML error
      const contentType = res.headers.get('content-type') || ''
      let payload = null
      if (contentType.includes('application/json')) {
        payload = await res.json().catch(() => null)
      } else {
        await res.text().catch(() => '')
        throw new Error(`Server error (${res.status}): Endpoint API tidak merespons JSON.`)
      }

      if (!res.ok) {
        if (res.status === 403 || payload?.code === 'AI_PREMIUM_REQUIRED') {
          onClose?.()
          openSheet?.('aiPremium')
          return
        }
        if (res.status === 429 || payload?.code === 'AI_QUOTA_EXCEEDED') {
          toast.error(payload?.error || 'Kuota AI harian Anda telah habis.')
          setState('idle')
          return
        }
        throw new Error(payload?.error || t('error'))
      }

      if (payload?.remaining !== undefined) {
        setQuota({
          remaining: payload.remaining,
          total: payload.total,
          is_unlimited: payload.is_unlimited,
        })
      }

      setTranscript(text)
      setParsed(payload)
      setState('result')
    } catch (e) {
      toast.error(e?.message || t('error'))
      setState('idle')
    }
  }

  const start = async () => {
    if (!isAiAllowed) {
      onClose?.()
      openSheet?.('aiPremium')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find((x) => window.MediaRecorder?.isTypeSupported?.(x)) || ''
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      chunksRef.current = []
      rec.ondataavailable = (e) => { if (e.data?.size) chunksRef.current.push(e.data) }
      rec.onstop = async () => {
        stream.getTracks().forEach((tr) => tr.stop())
        const type = (rec.mimeType || mime || 'audio/webm').split(';')[0]
        const blob = new Blob(chunksRef.current, { type })
        if (!blob.size) { setState('idle'); return }
        setState('processing')
        try {
          const form = new FormData()
          form.append('file', blob, type.includes('mp4') ? 'recording.mp4' : type.includes('ogg') ? 'recording.ogg' : 'recording.webm')
          form.append('language', lang)
          const headers = {}
          if (session?.access_token) {
            headers['Authorization'] = `Bearer ${session.access_token}`
          }
          const res = await fetch('/api/ai/transcribe', { method: 'POST', headers, body: form })
          
          const contentType = res.headers.get('content-type') || ''
          let data = null
          if (contentType.includes('application/json')) {
            data = await res.json().catch(() => null)
          } else {
            const textErr = await res.text().catch(() => '')
            throw new Error(`Transkripsi gagal (${res.status}): Server mengembalikan HTML.`)
          }

          if (!res.ok) {
            if (res.status === 403 || data?.code === 'AI_PREMIUM_REQUIRED') {
              onClose?.()
              openSheet?.('aiPremium')
              return
            }
            if (res.status === 429 || data?.code === 'AI_QUOTA_EXCEEDED') {
              toast.error(data?.error || 'Kuota AI harian Anda telah habis.')
              setState('idle')
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

          if (!data?.text) throw new Error(t('error'))
          await parseText(data.text)
        } catch (e) {
          toast.error(e?.message || t('error'))
          setState('idle')
        }
      }
      recRef.current = rec
      rec.start()
      setState('recording')
    } catch (e) {
      toast.error(e?.message || t('mic_not_available'))
      setShowTyped(true)
    }
  }

  const stop = () => { try { recRef.current?.stop() } catch {} }

  const useIt = async () => {
    if (!parsed) return

    const txList = Array.isArray(parsed?.transactions) && parsed.transactions.length > 0
      ? parsed.transactions
      : (parsed?.amount !== undefined ? [parsed] : [])

    if (txList.length === 0) return

    // KASUS 1: Hanya 1 transaksi (misal: satu toko dengan daftar barang)
    if (txList.length === 1) {
      const first = txList[0]
      onResult?.({
        type: first.type || 'expense',
        amount: first.amount,
        currency: first.currency || home,
        category: first.category || 'food',
        payment_method: first.payment_method || 'cash',
        account_name: first.account_name || null,
        account_id: first.account_id || null,
        merchant: first.merchant || null,
        note: first.note || '',
        items: first.items || [],
      })
      onClose?.()
      return
    }

    // KASUS 2: Lebih dari 1 transaksi (tempat/toko berbeda) -> Langsung simpan ke Database
    setState('processing')
    try {
      let savedCount = 0
      for (const tx of txList) {
        let resolvedAccId = tx.account_id || null
        if (!resolvedAccId && tx.account_name) {
          const matchAcc = accounts.find((a) =>
            a.name?.toLowerCase().includes(String(tx.account_name).toLowerCase()) ||
            String(tx.account_name).toLowerCase().includes(a.name?.toLowerCase())
          )
          resolvedAccId = matchAcc?.id || null
        }
        if (!resolvedAccId) {
          resolvedAccId = accounts[0]?.id || null
        }

        const payload = {
          type: tx.type || 'expense',
          amount: Number(tx.amount) || 0,
          currency: tx.currency || home,
          category: tx.category || 'food',
          payment_method: tx.payment_method || 'cash',
          account_id: resolvedAccId,
          merchant: tx.merchant || null,
          note: tx.note || (tx.items?.length ? tx.items.map((i) => i.name).join(', ') : ''),
          items: tx.items || [],
          date: new Date().toISOString(),
          transaction_date: new Date().toISOString(),
        }

        if (typeof store?.createTransaction === 'function') {
          await store.createTransaction(payload)
          savedCount++
        }
      }

      toast.success(`${savedCount} transaksi berhasil dicatat!`)
      if (typeof refresh === 'function') {
        await refresh()
      }
      onClose?.()
    } catch (err) {
      console.error('Gagal batch insert transaksi suara:', err)
      toast.error('Gagal menyimpan beberapa transaksi')
    } finally {
      setState('result')
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('voice_log')}
      right={<QuotaBadge quota={quota} loading={quotaLoading} />}
    >
      <div className="flex flex-col items-center pt-6 pb-4">
        {state !== 'result' ? (
          <>
            <div className="relative h-40 w-40 flex items-center justify-center">
              {state === 'recording' ? (
                <>
                  <motion.span className="absolute inset-0 rounded-full bg-foreground/10" animate={{ scale: [1, 1.35, 1], opacity: [0.6, 0, 0.6] }} transition={{ repeat: Infinity, duration: 1.6 }} />
                  <motion.span className="absolute inset-4 rounded-full bg-foreground/10" animate={{ scale: [1, 1.25, 1], opacity: [0.6, 0, 0.6] }} transition={{ repeat: Infinity, duration: 1.6, delay: 0.3 }} />
                </>
              ) : null}
              <button
                type="button"
                onClick={state === 'recording' ? stop : state === 'idle' ? start : undefined}
                disabled={state === 'processing'}
                className={cn('relative h-24 w-24 rounded-full flex items-center justify-center shadow-2xl transition active:scale-95', state === 'recording' ? 'bg-destructive text-white' : 'bg-foreground text-background')}
                data-testid="voice-mic"
              >
                {state === 'processing' ? <Loader2 size={32} className="animate-spin" /> : state === 'recording' ? <Square size={28} fill="currentColor" /> : <Mic size={34} />}
              </button>
            </div>
            <p className="font-semibold mt-4">{state === 'recording' ? t('listening') : state === 'processing' ? t('processing') : t('tap_to_speak')}</p>
            <p className="text-sm text-muted-foreground mt-1 text-center">{state === 'recording' ? t('tap_to_stop') : t('say_example')}</p>
            <p className="text-[10px] text-muted-foreground mt-3">Google Gemini 2.0 Flash · Voice & NLP</p>

            <button type="button" onClick={() => setShowTyped(!showTyped)} className="mt-6 text-sm font-semibold flex items-center gap-1.5 text-muted-foreground"><Keyboard size={14} /> {showTyped ? t('close') : 'Type instead'}</button>
            {showTyped ? (
              <div className="w-full flex gap-2 mt-3">
                <TextInput value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={t('say_example').replace('Try: ', '').replace(/"/g, '')} data-testid="voice-text" onKeyDown={(e) => { if (e.key === 'Enter' && typed.trim()) parseText(typed.trim()) }} />
                <button type="button" disabled={!typed.trim() || state === 'processing'} onClick={() => parseText(typed.trim())} className="rounded-xl bg-foreground text-background px-4 font-semibold disabled:opacity-40" data-testid="voice-parse"><Check size={18} /></button>
              </div>
            ) : null}
          </>
        ) : (
          <div className="w-full">
            <p className="label-upper">{t('transcript')}</p>
            <p className="mt-1 text-lg font-medium">“{transcript}”</p>

            {/* List Kartu Transaksi */}
            <div className="mt-4 space-y-2.5 max-h-[300px] overflow-y-auto no-scrollbar">
              {(parsed?.transactions || (parsed ? [parsed] : [])).map((tx, idx) => (
                <Card key={idx} className="p-3.5 flex flex-col gap-2">
                  <div className="flex items-center gap-3">
                    <CategoryBadge id={tx?.category} />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold truncate text-[15px]">
                        {tx?.merchant && !/^(beli|jajan|bayar|pesan)\b/i.test(tx.merchant)
                          ? tx.merchant
                          : (tx?.items?.length ? tx.items.map((i) => i.name).join(' & ') : tx?.note || 'Transaction')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t(`cat_${tx?.category || 'other'}`)} · {t(tx?.payment_method || 'cash')}
                        {tx?.account_name ? ` · ${tx.account_name}` : ''}
                      </p>
                    </div>
                    <p className="font-bold tabular-nums text-base">
                      {tx?.type === 'income' ? '+' : '-'}{fmt(tx?.amount || 0, tx?.currency || home)}
                    </p>
                  </div>

                  {/* List barang jika belanja di toko yang sama */}
                  {Array.isArray(tx?.items) && tx.items.length > 0 ? (
                    <div className="pt-2 border-t border-border/40 space-y-1">
                      {tx.items.map((it, iIdx) => {
                        // Ambil total harga item yang tepat tanpa pelipatgandaan
                        const calcTotal = it.price * (it.qty || 1)
                        const itemSubtotal = calcTotal <= (tx?.amount || 0) && it.qty > 1 ? calcTotal : it.price

                        return (
                          <div key={iIdx} className="flex justify-between items-center text-xs text-muted-foreground pl-1">
                            <span className="truncate">
                              {it.unit && it.unit !== 'x' && it.unit !== 'pcs'
                                ? `${it.qty} ${it.unit} ${it.name}`
                                : (it.qty > 1 ? `${it.qty}x ${it.name}` : it.name)}
                            </span>
                            <span className="tabular-nums font-medium">
                              {fmt(itemSubtotal || 0, tx?.currency || home)}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  ) : null}
                </Card>
              ))}
            </div>

            <p className="text-[11px] text-muted-foreground mt-2 text-right">
              {Math.round((parsed?.confidence || 0.95) * 100)}% · {parsed?.model || 'Gemini'}
            </p>
            <div className="mt-5 space-y-2">
              <PrimaryButton onClick={useIt} data-testid="voice-use">
                {(parsed?.transactions?.length || 1) > 1 ? `Simpan ${parsed.transactions.length} Transaksi` : t('review_and_save')}
              </PrimaryButton>
              <button
                type="button"
                onClick={() => { setState('idle'); setParsed(null) }}
                className="w-full py-3 text-sm font-semibold text-muted-foreground"
              >
                {t('cancel')}
              </button>
            </div>
          </div>
        )}
      </div>
    </Sheet>
  )
}
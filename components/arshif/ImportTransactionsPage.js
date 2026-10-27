'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { UploadCloud, FileSpreadsheet, FileText, Sparkles, CheckCircle2, ChevronLeft, ChevronRight, ChevronDown, Plus, AlertTriangle, Undo2, Check, Search, X, Lock } from 'lucide-react'
import { toast } from 'sonner'
import { useApp } from './context'
import { Sheet, Field, Segmented, CategoryBadge, SectionLabel, TextInput } from './ui'
import CurrencySheet from './CurrencySheet'
import { CATEGORIES } from '@/lib/categories'
import { convert, getRate } from '@/lib/rates'
import { getCurrency, roundMoney } from '@/lib/currencies'
import { LOCALE_MAP } from '@/lib/i18n'
import { cn, triggerHaptic } from '@/lib/utils'
import * as SI from '@/lib/statement-import'

// Statement import wizard. Parsing, normalization, and dedup run client-side;
// the server only receives final rows plus optional batch notes.

const STEPS = ['upload', 'setup', 'review', 'done']

export default function ImportTransactionsPage({ onClose }) {
  const { t, lang, accounts = [], store, refresh, home, rates, session, open: openSheet } = useApp()
  const fileRef = useRef(null)
  const parsedRef = useRef(null) // baris mentah pra-finalize — untuk rebuild review saat dompet diganti
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)
  const [fileName, setFileName] = useState('')
  const [fileSize, setFileSize] = useState(0)
  const [headers, setHeaders] = useState([])
  const [aoa, setAoa] = useState([])
  const [mapping, setMapping] = useState({ date: -1, desc: -1, amount: -1, debit: -1, credit: -1, balance: -1 })
  const [dirMode, setDirMode] = useState('signed')
  // Mode PDF+AI: file PDF dikirim ke AI, kolom sudah berlabel → mapping di-skip
  const [aiMode, setAiMode] = useState(false)
  const [pdfFile, setPdfFile] = useState(null)
  const [aiRows, setAiRows] = useState(null)
  const [walletId, setWalletId] = useState(null)
  const [pickWallet, setPickWallet] = useState(false)
  const [newWallet, setNewWallet] = useState(false)
  const [nwName, setNwName] = useState('')
  const [nwCurrency, setNwCurrency] = useState(home || 'MYR')
  const [pickCur, setPickCur] = useState(false)
  const [rows, setRows] = useState([])
  const [excluded, setExcluded] = useState({})
  const [catEdits, setCatEdits] = useState({})
  const [pickCatFor, setPickCatFor] = useState(null)
  const [catSearch, setCatSearch] = useState('')
  const [caps, setCaps] = useState({ batchTable: false, columns: false })
  const [overlap, setOverlap] = useState([])
  const [balanceCheck, setBalanceCheck] = useState({ checked: false })
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [result, setResult] = useState(null)
  const [batchId, setBatchId] = useState(null)
  const [batchRecId, setBatchRecId] = useState(null)
  const [netDelta, setNetDelta] = useState(0)
  const [showDupes, setShowDupes] = useState(false)

  const wallet = useMemo(() => (accounts || []).find((a) => a.id === walletId) || null, [accounts, walletId])
  const walletCur = wallet?.currency || home || 'MYR'

  const reset = () => {
    setStep(0); setBusy(false); setFileName(''); setFileSize(0); setHeaders([]); setAoa([])
    setMapping({ date: -1, desc: -1, amount: -1, debit: -1, credit: -1, balance: -1 })
    setDirMode('signed'); setWalletId(null); setPickWallet(false); setNewWallet(false); setNwName(''); setNwCurrency(home || 'MYR')
    setRows([]); setExcluded({}); setCatEdits({}); setPickCatFor(null); setCatSearch('')
    setOverlap([]); setBalanceCheck({ checked: false }); setProgress({ done: 0, total: 0 })
    setResult(null); setBatchId(null); setBatchRecId(null); setNetDelta(0); setShowDupes(false)
    setAiMode(false); setPdfFile(null); setAiRows(null)
    parsedRef.current = null
  }

  // Kunci scroll body selama halaman full-page terbuka; probe kapabilitas server sekali saat mount
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    triggerHaptic('success')
    if (store?.getImportCapabilities) {
      store.getImportCapabilities().then(setCaps).catch(() => {})
    }
    return () => { document.body.style.overflow = prev }
  }, [store])

  const close = () => { reset(); onClose?.() }

  // Langkah 1: upload file
  const isPdfFile = (file) => {
    if (!file) return false
    if ((file.type || '').toLowerCase().includes('pdf')) return true
    return /\.pdf$/i.test(file.name || '')
  }

  const handleFile = async (file) => {
    if (!file || busy) return
    // PDF → jalur AI (butuh persetujuan + kuota); parsing di langkah setup
    if (isPdfFile(file)) {
      setFileName(file.name || 'statement.pdf')
      setFileSize(file.size || 0)
      setPdfFile(file)
      setAiMode(true); setAiRows(null)
      setWalletId((accounts || [])[0]?.id || null)
      setStep(1)
      return
    }
    setBusy(true)
    try {
      const { fileName: fn, headers: h, rows: body } = await SI.parseStatementFile(file)
      const { mapping: m, dirMode: dm } = SI.detectMapping(h, body)
      setFileName(fn); setFileSize(file.size || 0); setHeaders(h); setAoa(body)
      setMapping(m); setDirMode(dm)
      setAiMode(false); setPdfFile(null); setAiRows(null)
      setWalletId((accounts || [])[0]?.id || null)
      setStep(1)
    } catch {
      toast.error(t('invalid_file'))
    } finally { setBusy(false) }
  }

  const onDrop = (e) => { e.preventDefault(); const f = e.dataTransfer?.files?.[0]; if (f) handleFile(f) }

  // Buat wallet baru
  const createWallet = async () => {
    const name = nwName.trim()
    if (!name) { toast.error(t('import_wallet_name')); return }
    setBusy(true)
    try {
      const w = await store.createAccount({ name, currency: (nwCurrency || home || 'MYR').toUpperCase(), type: 'bank', balance: 0 })
      if (refresh) await refresh()
      setWalletId(w?.id || null)
      setNewWallet(false); setNwName('')
      toast.success(name)
    } catch { toast.error(t('error')) }
    finally { setBusy(false) }
  }

  // Langkah 2: review mapping
  const mappingValid = () => {
    if (mapping.date < 0 || mapping.desc < 0) return false
    if (dirMode === 'split') return mapping.debit >= 0 && mapping.credit >= 0
    return mapping.amount >= 0
  }

  // Finalisasi baris kanonis → review. Dipakai jalur CSV/XLSX (buildReview)
  // maupun jalur PDF+AI (continueAiReview) — dedup, cek saldo, overlap sama.
  // wid eksplisit agar ganti dompet di layar review bisa rebuild.
  const finalizeParsedRows = async (parsed, wid) => {
    parsed = parsed.map((r, i) => ({
      ...r,
      idx: i,
      fingerprint: SI.rowFingerprint(r),
      category: SI.suggestCategory(r.desc, r.type) || 'other',
    }))
    SI.markInFileDuplicates(parsed)
    // Dedup terhadap data existing di rentang tanggal file
    const range = SI.getDateRange(parsed)
    let existingKeys = new Set()
    if (range && store?.findTransactionsInRange) {
      const from = new Date(range.min); from.setHours(0, 0, 0, 0)
      const to = new Date(range.max); to.setHours(23, 59, 59, 999)
      const existing = await store.findTransactionsInRange(wid, from.toISOString(), to.toISOString())
      existingKeys = new Set((existing || []).map((x) => SI.rowKey({
        dateStr: SI.fmtDateStr(new Date(x.date || x.transaction_date)),
        amount: Math.abs(Number(x.amount) || 0),
        currency: x.currency,
        desc: x.note || x.description || '',
      })))
    }
    for (const r of parsed) r.dupExisting = existingKeys.has(SI.rowKey(r))
    setBalanceCheck(SI.checkBalanceContinuity(parsed))
    // Overlap dengan batch sebelumnya
    if (range && store?.listImportBatches) {
      const batches = await store.listImportBatches(wid, 20)
      setOverlap((batches || []).filter((b) => {
        if (!b.date_from || !b.date_to || b.status === 'undone') return false
        return SI.rangesOverlap(range, { min: new Date(b.date_from), max: new Date(b.date_to) })
      }))
    }
    setRows(parsed)
    setExcluded({}); setCatEdits({}); setShowDupes(false)
    setStep(2)
  }

  const buildReview = async () => {
    if (!walletId) { toast.error(t('import_no_wallet')); return }
    if (!mappingValid()) { toast.error(t('import_map_incomplete')); return }
    setBusy(true)
    try {
      const parsed = SI.normalizeRows(aoa, mapping, dirMode, walletCur)
      if (!parsed.length) throw new Error('empty')
      parsedRef.current = parsed
      await finalizeParsedRows(parsed, walletId)
    } catch {
      toast.error(t('invalid_file'))
    } finally { setBusy(false) }
  }

  // Ganti dompet langsung dari layar review → rebuild dedup/overlap/rekonsiliasi
  const changeWallet = async (id) => {
    setPickWallet(false)
    if (!id || id === walletId) return
    setWalletId(id)
    if (step === 2 && parsedRef.current?.length) {
      setBusy(true)
      try { await finalizeParsedRows(parsedRef.current, id) }
      catch { toast.error(t('error')) }
      finally { setBusy(false) }
    }
  }

  // Konversi ArrayBuffer → base64 per chunk (btoa langsung bisa stack overflow)
  const arrayBufferToBase64 = (buf) => {
    const bytes = new Uint8Array(buf)
    let bin = ''
    const CHUNK = 0x8000
    for (let i = 0; i < bytes.length; i += CHUNK) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK))
    }
    return btoa(bin)
  }

  // Proses PDF via AI
  const processPdfWithAi = async () => {
    if (!pdfFile || busy) return
    if (!walletId) { toast.error(t('import_no_wallet')); return }
    setBusy(true)
    try {
      const buf = await pdfFile.arrayBuffer()
      const b64 = arrayBufferToBase64(buf)
      const headers = { 'Content-Type': 'application/json' }
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`
      const res = await fetch('/api/ai/parse-statement', {
        method: 'POST',
        headers,
        body: JSON.stringify({ pdfBase64: b64, fileName }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (res.status === 403 || data?.code === 'AI_PREMIUM_REQUIRED') {
          close(); openSheet?.('aiPremium'); return
        }
        if (res.status === 429 || data?.code === 'AI_QUOTA_EXCEEDED') {
          toast.error(data?.error || t('import_ai_quota')); return
        }
        throw new Error(data?.error || t('import_pdf_failed'))
      }
      const detectedCur = String(data?.meta?.currency || '').trim().toUpperCase()
      const rows = SI.aiTransactionsToRows(
        data?.transactions,
        /^[A-Z]{3}$/.test(detectedCur) ? detectedCur : walletCur
      )
      if (!rows.length) throw new Error('empty')
      setAiRows(rows)
      toast.success(t('import_pdf_found').replace('{n}', String(rows.length)))
    } catch (e) {
      toast.error(e?.message || t('import_pdf_failed'))
    } finally { setBusy(false) }
  }

  const continueAiReview = async () => {
    if (!walletId) { toast.error(t('import_no_wallet')); return }
    if (!aiRows?.length) return
    setBusy(true)
    try {
      parsedRef.current = aiRows
      await finalizeParsedRows(aiRows, walletId)
    } catch {
      toast.error(t('error'))
    } finally { setBusy(false) }
  }

  const catOf = (r) => catEdits[r.idx] || r.category || 'other'
  const readyRows = useMemo(() => rows.filter((r) => !r.dupInFile && !r.dupExisting && !excluded[r.idx]), [rows, excluded])
  const dupeRows = useMemo(() => rows.filter((r) => r.dupInFile || r.dupExisting), [rows])
  const range = useMemo(() => SI.getDateRange(rows), [rows])

  // Total masuk/keluar di layar review (dikonversi ke mata uang dompet)
  const statSums = useMemo(() => {
    let inn = 0, out = 0
    for (const r of readyRows) {
      let v = Number(r.amount) || 0
      try { v = convert(r.amount, r.currency, walletCur, rates) } catch {}
      if (r.type === 'income') inn += v
      else out += v
    }
    return { inn, out }
  }, [readyRows, walletCur, rates])

  const allSelected = readyRows.length > 0 && readyRows.every((r) => !excluded[r.idx])
  const toggleAll = () => {
    triggerHaptic('light')
    if (allSelected) {
      const e = {}
      for (const r of readyRows) e[r.idx] = true
      setExcluded(e)
    } else setExcluded({})
  }

  // Rekonsiliasi: saldo akhir statement vs saldo wallet
  const recon = useMemo(() => {
    const withBal = rows.filter((r) => r.balanceAfter != null && !r.dupInFile)
    if (!withBal.length || !wallet) return null
    const last = [...withBal].sort((a, b) => b.date - a.date)[0]
    let stmtEnd = last.balanceAfter
    try { stmtEnd = convert(last.balanceAfter, last.currency, walletCur, rates) } catch {}
    const diff = Math.abs(stmtEnd - (Number(wallet.balance) || 0))
    return { stmtEnd, walletBal: Number(wallet.balance) || 0, match: diff < 0.01, cur: walletCur }
  }, [rows, wallet, walletCur, rates])

  // Jalankan impor
  const runImport = async () => {
    if (busy || !readyRows.length || !walletId) return
    setBusy(true)
    const bId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `batch-${Date.now()}`
    setBatchId(bId)
    setProgress({ done: 0, total: readyRows.length })
    let ok = 0, net = 0, failed = 0, recId = null
    try {
      if (caps.batchTable && range) {
        const rec = await store.createImportBatch({
          account_id: walletId,
          file_name: fileName,
          row_count: rows.length,
          date_from: range.min.toISOString(),
          date_to: range.max.toISOString(),
          status: 'importing',
        })
        recId = rec?.id || null
        setBatchRecId(recId)
      }
      const importOne = async (r) => {
        try {
          const homeAmount = roundMoney(convert(r.amount, r.currency, home, rates), home)
          const homeRate = getRate(r.currency, home, rates)
          const payload = {
            type: r.type,
            amount: r.amount,
            currency: r.currency,
            home_currency: home,
            home_currency_amount: homeAmount,
            rate: homeRate,
            category: catOf(r),
            account_id: walletId,
            date: r.date.toISOString(),
            transaction_date: r.date.toISOString(),
            payment_method: 'bank',
            note: r.desc,
            description: r.desc,
            ...(caps.columns ? { import_batch_id: bId, fingerprint: r.fingerprint } : {}),
          }
          await store.createTransaction(payload)
          const delta = convert(r.amount, r.currency, walletCur, rates)
          net += r.type === 'income' ? delta : -delta
          // Pelajari kategori pilihan user untuk file berikutnya
          if (catEdits[r.idx]) SI.learnCategory(r.desc, catEdits[r.idx])
          else if (r.category !== 'other') SI.learnCategory(r.desc, r.category)
          ok += 1
        } catch { /* baris gagal dilewati, dihitung di akhir */ failed += 1 }
      }
      const CONC = 8
      for (let i = 0; i < readyRows.length; i += CONC) {
        await Promise.all(readyRows.slice(i, i + CONC).map(importOne))
        setProgress({ done: Math.min(i + CONC, readyRows.length), total: readyRows.length })
      }
      // Satu update saldo di akhir (bukan per baris)
      const w = (accounts || []).find((a) => a.id === walletId)
      if (w && net !== 0) {
        try { await store.updateAccount(walletId, { balance: roundMoney((Number(w.balance) || 0) + net, walletCur) }) } catch {}
      }
      setNetDelta(net)
      if (recId) await store.updateImportBatch(recId, { imported_count: ok, skipped_count: rows.length - ok, failed_count: failed, status: 'completed' })
      if (refresh) await refresh()
      setResult({ ok, skipped: rows.length - ok, failed })
      setStep(3)
    } catch {
      toast.error(t('error'))
    } finally { setBusy(false) }
  }

  const undoImport = async () => {
    if (busy || !batchId) return
    setBusy(true)
    try {
      if (caps.columns) await store.deleteTransactionsByImportBatch(batchId)
      const w = (accounts || []).find((a) => a.id === walletId)
      if (w && netDelta !== 0) {
        try { await store.updateAccount(walletId, { balance: roundMoney((Number(w.balance) || 0) - netDelta, walletCur) }) } catch {}
      }
      if (batchRecId) await store.updateImportBatch(batchRecId, { status: 'undone' })
      if (refresh) await refresh()
      toast.success(t('import_undone'))
      close()
    } catch { toast.error(t('error')) }
    finally { setBusy(false) }
  }

  // Render helpers
  const card = 'rounded-3xl bg-zinc-100 border border-zinc-200/60 dark:bg-[#121214] dark:border-white/5'
  const tile = 'flex items-center justify-center shrink-0 bg-zinc-200/70 dark:bg-white/[0.06]'

  // Nominal ala preview: "RM 8.420" / "-RM 142,80"
  const fmtAmt = (n, cur, signed = false) => {
    const sym = (getCurrency(cur)?.symbol || cur || '').trim()
    const v = Number(n) || 0
    const num = Math.abs(v).toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
    const sign = signed ? (v < 0 ? '−' : v > 0 ? '+' : '') : ''
    return `${sign}${sym} ${num}`
  }
  // Stats values can overflow their column on large amounts — compact them (e.g. "Rp 88,3 jt")
  const fmtStat = (n, cur) => {
    const v = Number(n) || 0
    if (Math.abs(v) >= 1000000) {
      const sym = (getCurrency(cur)?.symbol || cur || '').trim()
      const body = new Intl.NumberFormat(LOCALE_MAP[lang] || 'en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(Math.abs(v))
      return `${sym ? sym + ' ' : ''}${body}`
    }
    return fmtAmt(v, cur)
  }
  const fmtSize = (b) => {
    if (!b) return ''
    return b >= 1048576
      ? `${(b / 1048576).toLocaleString('id-ID', { maximumFractionDigits: 1 })} MB`
      : `${Math.max(1, Math.round(b / 1024))} KB`
  }
  const walletInitials = (name) => (name || '?').trim().slice(0, 2).toUpperCase()

  // Kepala halaman ala Arshif: judul kompak + deskripsi singkat
  const PageHead = ({ title, desc }) => (
    <div>
      <h1 className="text-[20px] leading-tight font-bold tracking-tight text-foreground">{title}</h1>
      {desc ? <p className="text-[14px] text-muted-foreground leading-relaxed mt-1">{desc}</p> : null}
    </div>
  )

  // Tombol primer putih ala preview — hanya di bottom bar
  const PrimaryBarButton = ({ onClick, disabled, children, testId }) => (
    <motion.button
      type="button"
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      className="w-full rounded-2xl bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 font-bold py-4 text-[15px] disabled:opacity-40 flex items-center justify-center gap-2"
    >
      {children}
    </motion.button>
  )

  // Navigasi header: mundur selangkah, atau tutup halaman di langkah awal/akhir
  const goBack = () => {
    triggerHaptic('light')
    if (step > 0 && step < 3) setStep((s) => s - 1)
    else close()
  }

  const MapRow = ({ role, label, required }) => {
    const show = role === 'date' || role === 'desc' || role === 'balance'
      || (dirMode === 'signed' && role === 'amount')
      || (dirMode === 'split' && (role === 'debit' || role === 'credit'))
    if (!show) return null
    const colCount = Math.max(headers.length, ...aoa.map((r) => (r || []).length), 0)
    const sampleRow = aoa[0] || []
    return (
      <div className="mb-3">
        <p className="text-xs font-semibold text-muted-foreground px-1 mb-1.5">{label}{required ? ' *' : ''}</p>
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar items-stretch">
          <button
            type="button"
            onClick={() => setMapping((m) => ({ ...m, [role]: -1 }))}
            className={cn('shrink-0 rounded-xl border px-3 py-2 text-sm font-medium self-center', mapping[role] === -1 ? 'bg-foreground text-background border-foreground' : 'bg-background border-border/60 text-muted-foreground')}
          >—</button>
          {Array.from({ length: colCount }, (_, i) => {
            const colLabel = (headers[i] || '').trim() || t('import_col_n').replace('{n}', i + 1)
            const sample = String(sampleRow[i] ?? '').trim()
            const active = mapping[role] === i
            return (
              <button
                key={i}
                type="button"
                onClick={() => setMapping((m) => ({ ...m, [role]: i }))}
                className={cn('shrink-0 min-w-[136px] max-w-[220px] rounded-xl border px-3 py-2 text-left', active ? 'bg-foreground text-background border-foreground' : 'bg-background border-border/60')}
              >
                <span className="block text-[13px] font-semibold truncate">{colLabel}</span>
                {sample ? <span className={cn('block text-[11px] truncate mt-0.5', active ? 'opacity-70' : 'text-muted-foreground')}>{sample}</span> : null}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  const filteredCats = useMemo(() => {
    const q = catSearch.trim().toLowerCase()
    return CATEGORIES.filter((c) => !q || (t(`cat_${c.id}`) || c.id).toLowerCase().includes(q))
  }, [catSearch, t])

  // Konfigurasi bottom bar per langkah: [label, handler, disabled]
  const barAction = (() => {
    if (step === 0) return { label: busy ? t('processing') : t('import_choose_file'), onClick: () => fileRef.current?.click(), disabled: busy }
    if (step === 1 && !aiMode) return { label: busy ? t('processing') : t('import_continue'), onClick: buildReview, disabled: busy || !walletId || !mappingValid() }
    if (step === 1 && aiMode) {
      return aiRows
        ? { label: busy ? t('processing') : t('import_continue'), onClick: continueAiReview, disabled: busy }
        : { label: busy ? t('processing') : t('import_pdf_process'), onClick: processPdfWithAi, disabled: busy || !pdfFile }
    }
    if (step === 2) return { label: busy ? t('import_importing') : t('import_import_n').replace('{n}', String(readyRows.length)), onClick: runImport, disabled: busy || !readyRows.length, testId: 'import-execute' }
    return { label: t('import_back_start'), onClick: close, disabled: false }
  })()

  // Pilih dompet — dipakai langkah setup CSV maupun persetujuan PDF+AI
  const WalletPicker = () => (
    <>
      <Field label={t('import_choose_wallet')}>
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {(accounts || []).map((a) => (
            <button key={a.id} type="button" onClick={() => { setWalletId(a.id); setNewWallet(false) }}
              className={cn('shrink-0 rounded-xl border px-3 py-2 text-sm font-medium whitespace-nowrap', walletId === a.id && !newWallet ? 'bg-foreground text-background border-foreground' : 'bg-background border-border/60')}>
              {a.name} <span className="opacity-60">· {a.currency}</span>
            </button>
          ))}
          <button type="button" onClick={() => { setNewWallet(true); setWalletId(null) }}
            className={cn('shrink-0 rounded-xl border px-3 py-2 text-sm font-medium flex items-center gap-1', newWallet ? 'bg-foreground text-background border-foreground' : 'bg-background border-border/60 border-dashed')}>
            <Plus size={14} /> {t('import_new_wallet')}
          </button>
        </div>
      </Field>

      {newWallet && (
        <div className={cn(card, 'p-4 space-y-3')}>
          <Field label={t('import_wallet_name')}>
            <TextInput value={nwName} onChange={(e) => setNwName(e.target.value)} placeholder={t('import_wallet_name_ph')} />
          </Field>
          <Field label={t('import_currency')}>
            <button
              type="button"
              onClick={() => setPickCur(true)}
              className="w-full rounded-xl border border-border/60 bg-background px-3 py-3 text-sm font-semibold flex items-center justify-between"
            >
              <span>{getCurrency(nwCurrency).symbol} {nwCurrency}</span>
              <ChevronDown size={16} className="text-muted-foreground" />
            </button>
          </Field>
          <button type="button" onClick={createWallet} disabled={busy} className="w-full rounded-xl bg-foreground text-background font-semibold py-2.5 text-sm disabled:opacity-40">
            {t('import_create')}
          </button>
        </div>
      )}
    </>
  )

  return (
    <>
      <motion.div
        initial={{ y: 48, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 32, mass: 0.9 }}
        className="fixed inset-0 z-[80] bg-background"
        data-testid="import-page"
      >
        <div className="h-full w-full max-w-md mx-auto flex flex-col">
          {/* header halaman */}
          <div className="shrink-0 bg-background safe-top">
            <div className="flex items-center justify-between px-4 pt-3 pb-2">
              <button
                type="button"
                onClick={goBack}
                aria-label={t('import_back')}
                className="h-10 w-10 rounded-full bg-zinc-100 dark:bg-white/[0.06] flex items-center justify-center"
              >
                <ChevronLeft size={20} />
              </button>
              <h2 className="text-[15px] font-bold text-foreground">{t('import_data')}</h2>
              <button
                type="button"
                onClick={close}
                aria-label={t('close')}
                className="h-10 w-10 rounded-full bg-zinc-100 dark:bg-white/[0.06] flex items-center justify-center"
              >
                <X size={18} />
              </button>
            </div>
            {/* hairline progress */}
            <div className="h-[2px] bg-zinc-200/60 dark:bg-white/5">
              <div
                className="h-full bg-foreground transition-all duration-300"
                style={{ width: `${((step + 1) / 4) * 100}%` }}
              />
            </div>
          </div>

          {/* konten scroll */}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 pt-5 pb-8">
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls,.pdf" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} data-testid="import-file" />

          {/* ============ STEP 0: pilih sumber data ============ */}
          {step === 0 && (
            <div className="space-y-5">
              <PageHead title={t('import_src_title')} desc={t('import_src_sub')} />

              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={onDrop}
                className="w-full rounded-3xl border-[1.5px] border-dashed border-zinc-300 dark:border-zinc-700 p-8 text-center"
                data-testid="import-dropzone"
              >
                <div className={cn(tile, 'h-16 w-16 rounded-3xl mx-auto')}>
                  <UploadCloud size={26} className="text-muted-foreground" strokeWidth={1.5} />
                </div>
                <p className="font-bold text-[17px] mt-4">{busy ? t('processing') : t('import_drop_title')}</p>
                <p className="text-sm text-muted-foreground mt-1">{t('import_drop_sub')}</p>
              </button>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className={cn(card, 'p-4 text-left')}
                >
                  <div className={cn(tile, 'h-11 w-11 rounded-2xl')}>
                    <FileSpreadsheet size={20} strokeWidth={1.75} />
                  </div>
                  <p className="font-bold text-[15px] mt-3">{t('import_opt_csv')}</p>
                  <p className="text-[13px] text-muted-foreground mt-1 leading-snug">{t('import_opt_csv_desc')}</p>
                </button>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className={cn(card, 'p-4 text-left relative')}
                >
                  <span className="absolute top-4 right-4 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-[#6A92FC] text-white">{t('import_pdf_badge')}</span>
                  <div className={cn(tile, 'h-11 w-11 rounded-2xl')}>
                    <FileText size={20} strokeWidth={1.75} />
                  </div>
                  <p className="font-bold text-[15px] mt-3">{t('import_opt_pdf')}</p>
                  <p className="text-[13px] text-muted-foreground mt-1 leading-snug">{t('import_opt_pdf_desc')}</p>
                </button>
              </div>

              <div className="rounded-2xl bg-zinc-100 dark:bg-[#1D1D20] px-4 py-3.5 flex items-start gap-2.5">
                <Lock size={16} className="text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-[13px] text-muted-foreground leading-snug">{t('import_privacy_note')}</p>
              </div>
            </div>
          )}

          {/* ============ STEP 1: setup ============ */}
          {step === 1 && !aiMode && (
            <div className="space-y-5">
              <PageHead title={t('import_setup_title')} desc={t('import_setup_sub')} />

              <div className={cn(card, 'p-4 flex items-center gap-3')}>
                <div className={cn(tile, 'h-12 w-12 rounded-2xl')}>
                  <FileSpreadsheet size={20} strokeWidth={1.75} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[15px] truncate">{fileName}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {aoa.length} {t('import_rows_unit')}{fmtSize(fileSize) ? ` · ${fmtSize(fileSize)}` : ''}
                  </p>
                </div>
                <button type="button" onClick={() => fileRef.current?.click()} className="text-sm font-medium text-muted-foreground shrink-0">{t('edit')}</button>
              </div>

              <WalletPicker />

              <div>
                <SectionLabel>{t('import_map_title')}</SectionLabel>
                <p className="text-xs text-muted-foreground px-1 -mt-1 mb-2">{t('import_map_hint')}</p>
                <MapRow role="date" label={t('import_col_date')} required />
                <MapRow role="desc" label={t('import_col_desc')} required />
                <MapRow role="amount" label={t('import_col_amount')} required={dirMode === 'signed'} />
                <MapRow role="debit" label={t('import_col_debit')} required={dirMode === 'split'} />
                <MapRow role="credit" label={t('import_col_credit')} required={dirMode === 'split'} />
                <MapRow role="balance" label={t('import_col_balance')} />
              </div>

              <Field label={t('import_direction')}>
                <Segmented
                  value={dirMode}
                  onChange={setDirMode}
                  options={[
                    { id: 'signed', label: t('import_dir_signed') },
                    { id: 'split', label: t('import_dir_split') },
                    { id: 'type_col', label: t('import_dir_type') },
                  ]}
                />
              </Field>
            </div>
          )}

          {/* ============ STEP 1: persetujuan PDF+AI ============ */}
          {step === 1 && aiMode && (
            <div className="space-y-5">
              <PageHead title={t('import_ai_consent_title')} desc={t('import_ai_consent_sub')} />

              <div className={cn(card, 'p-4 flex items-center gap-3')}>
                <div className={cn(tile, 'h-12 w-12 rounded-2xl text-[11px] font-bold text-muted-foreground')}>PDF</div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[15px] truncate">{fileName}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{fmtSize(fileSize)}</p>
                </div>
                <div className="h-7 w-7 rounded-full bg-foreground text-background flex items-center justify-center shrink-0">
                  <Check size={15} strokeWidth={3} />
                </div>
              </div>

              <WalletPicker />

              <div className="rounded-3xl border border-[#6A92FC]/50 bg-[#6A92FC]/[0.06] p-5">
                <div className="flex items-start gap-3.5">
                  <div className="h-12 w-12 rounded-2xl bg-[#6A92FC] text-white flex items-center justify-center shrink-0">
                    <Sparkles size={22} strokeWidth={1.75} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[16px]">{t('import_ai_secure_title')}</p>
                    <p className="text-[13.5px] text-muted-foreground mt-1 leading-relaxed">{t('import_ai_secure_desc')}</p>
                  </div>
                </div>
                <div className="mt-4 space-y-2.5">
                  {[t('import_ai_b1'), t('import_ai_b2'), t('import_ai_b3')].map((line) => (
                    <div key={line} className="flex items-center gap-2.5">
                      <Check size={16} strokeWidth={2.5} className="text-foreground shrink-0" />
                      <p className="text-[14px] font-medium">{line}</p>
                    </div>
                  ))}
                </div>
                {aiRows && (
                  <p className="text-[13px] font-bold text-emerald-500 mt-4">
                    {t('import_pdf_found').replace('{n}', String(aiRows.length))}
                  </p>
                )}
              </div>

              <p className="text-[12.5px] leading-relaxed text-muted-foreground px-1">
                {t('import_ai_fineprint')}
              </p>
            </div>
          )}

          {/* ============ STEP 2: review ============ */}
          {step === 2 && (
            <div className="space-y-5">
              <PageHead title={t('import_review_title')} desc={t('import_review_sub').replace('{n}', String(rows.length))} />

              {/* dompet tujuan — bisa diganti, review di-rebuild */}
              <button type="button" onClick={() => setPickWallet(true)} className={cn(card, 'w-full p-4 flex items-center gap-3 text-left')}>
                <div className={cn(tile, 'h-12 w-12 rounded-2xl text-[15px] font-bold')}>
                  {wallet ? walletInitials(wallet.name) : '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-[16px] truncate">{wallet?.name || '—'}</p>
                  <p className="text-[13px] text-muted-foreground mt-0.5">{t('import_target_wallet')} · {walletCur}</p>
                </div>
                <ChevronRight size={18} className="text-muted-foreground shrink-0" />
              </button>

              {/* statistik */}
              <div className={cn(card, 'py-4 px-2 grid grid-cols-3 divide-x divide-zinc-200/70 dark:divide-white/5')}>
                <div className="text-center px-2 min-w-0">
                  <p className="text-[17px] font-bold tabular-nums truncate">{readyRows.length}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">{t('import_stat_tx')}</p>
                </div>
                <div className="text-center px-2 min-w-0">
                  <p className="text-[17px] font-bold tabular-nums truncate">{fmtStat(statSums.inn, walletCur)}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">{t('import_stat_in')}</p>
                </div>
                <div className="text-center px-2 min-w-0">
                  <p className="text-[17px] font-bold tabular-nums truncate">{fmtStat(statSums.out, walletCur)}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">{t('import_stat_out')}</p>
                </div>
              </div>

              {/* peringatan validasi */}
              {(balanceCheck.checked && !balanceCheck.ok) || overlap.length > 0 || (recon && !recon.match) ? (
                <div className="space-y-2">
                  {balanceCheck.checked && !balanceCheck.ok && (
                    <div className="rounded-2xl bg-amber-500/10 border border-amber-500/20 px-4 py-3 flex items-start gap-2.5">
                      <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                      <p className="text-[13px] font-medium leading-snug">{t('import_balance_warn')}</p>
                    </div>
                  )}
                  {overlap.length > 0 && (
                    <div className="rounded-2xl bg-amber-500/10 border border-amber-500/20 px-4 py-3 flex items-start gap-2.5">
                      <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                      <div>
                        {overlap.map((b) => (
                          <p key={b.id} className="text-[13px] font-medium leading-snug">{t('import_overlap_warn').replace('{name}', b.file_name || '').replace('{range}', `${SI.fmtDateStr(new Date(b.date_from))} → ${SI.fmtDateStr(new Date(b.date_to))}`)}</p>
                        ))}
                      </div>
                    </div>
                  )}
                  {recon && !recon.match && (
                    <div className="rounded-2xl bg-amber-500/10 border border-amber-500/20 px-4 py-3 flex items-start gap-2.5">
                      <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                      <p className="text-[13px] font-medium leading-snug">{t('import_recon_diff').replace('{a}', `${recon.stmtEnd.toLocaleString()} ${recon.cur}`).replace('{b}', `${recon.walletBal.toLocaleString()} ${recon.cur}`)}</p>
                    </div>
                  )}
                </div>
              ) : null}

              {/* daftar transaksi */}
              <div>
                <div className="flex items-center justify-between mb-2.5 px-1">
                  <p className="font-bold text-[15px]">{t('import_recent')}</p>
                  <button
                    type="button"
                    onClick={toggleAll}
                    className="text-[13px] font-medium text-muted-foreground"
                  >
                    {allSelected ? t('import_all_selected') : t('import_none_selected')}
                  </button>
                </div>
                <div className="space-y-2.5">
                  {readyRows.map((r) => {
                    const off = !!excluded[r.idx]
                    return (
                      <div key={r.idx} className={cn(card, 'p-3.5 flex items-center gap-3', off && 'opacity-40')}>
                        <button
                          type="button"
                          onClick={() => setExcluded((e) => ({ ...e, [r.idx]: !e[r.idx] }))}
                          className={cn('h-6 w-6 rounded-full border flex items-center justify-center shrink-0', off ? 'border-zinc-300 dark:border-zinc-600 text-transparent' : 'bg-foreground border-foreground text-background')}
                          aria-label={off ? t('import_include') : t('import_exclude')}
                        ><Check size={14} strokeWidth={3} /></button>
                        <button
                          type="button"
                          onClick={() => { setPickCatFor(r.idx); setCatSearch('') }}
                          className="shrink-0"
                          aria-label={t('select_category')}
                        >
                          <CategoryBadge id={catOf(r)} size="md" />
                        </button>
                        <button
                          type="button"
                          onClick={() => { setPickCatFor(r.idx); setCatSearch('') }}
                          className="flex-1 min-w-0 text-left"
                        >
                          <p className="text-[15px] font-semibold truncate">{r.desc}</p>
                          <p className="text-[12px] text-muted-foreground mt-0.5 truncate">
                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-current mr-1.5 align-middle" />
                            {t(`cat_${catOf(r)}`)}
                          </p>
                        </button>
                        <div className="text-right shrink-0">
                          <p className="text-[15px] font-bold tabular-nums">
                            {r.type === 'expense' ? '−' : '+'}{fmtAmt(r.amount, r.currency)}
                          </p>
                          <p className="text-[11px] text-muted-foreground tabular-nums mt-0.5">{r.dateStr}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {dupeRows.length > 0 && (
                  <button type="button" onClick={() => setShowDupes((v) => !v)} className={cn(card, 'w-full mt-2.5 p-3.5 flex items-center justify-between')}>
                    <p className="text-sm font-semibold text-muted-foreground">{t('import_dup_title').replace('{n}', String(dupeRows.length))}</p>
                    <ChevronDown size={16} className={cn('text-muted-foreground transition-transform', showDupes && 'rotate-180')} />
                  </button>
                )}
                {showDupes && dupeRows.length > 0 && (
                  <div className="space-y-2.5 mt-2.5 opacity-60">
                    {dupeRows.map((r) => (
                      <div key={r.idx} className={cn(card, 'p-3.5 flex items-center gap-3')}>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{r.desc}</p>
                          <p className="text-xs text-muted-foreground tabular-nums">{r.dateStr} · {r.dupInFile ? t('import_dup_infile') : t('import_dup_exists')}</p>
                        </div>
                        <p className="text-sm font-bold tabular-nums">
                          {r.type === 'expense' ? '−' : '+'}{fmtAmt(r.amount, r.currency)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {busy && (
                <div>
                  <div className="h-1.5 rounded-full bg-zinc-200/70 dark:bg-white/5 overflow-hidden">
                    <div className="h-full bg-foreground rounded-full transition-all" style={{ width: `${progress.total ? Math.round((progress.done / progress.total) * 100) : 0}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground text-center mt-1.5 tabular-nums">{progress.done}/{progress.total}</p>
                </div>
              )}
            </div>
          )}

          {/* ============ STEP 3: selesai ============ */}
          {step === 3 && result && (
            <div className="pt-6">
              <div className={cn(tile, 'h-20 w-20 rounded-[28px] mx-auto')}>
                <Check size={34} strokeWidth={2.5} className="text-foreground" />
              </div>
              <h1 className="text-[24px] font-bold tracking-tight text-center mt-5">{t('import_done2_title')}</h1>
              <p className="text-[15px] text-muted-foreground text-center leading-relaxed mt-2 px-4">
                {t('import_done_sub').replace('{n}', String(result.ok)).replace('{wallet}', wallet?.name || '')}
              </p>

              <div className={cn(card, 'mt-6 px-5 divide-y divide-zinc-200/70 dark:divide-white/5')}>
                <div className="flex items-center justify-between py-4">
                  <p className="text-[14px] text-muted-foreground">{t('import_sum_ok')}</p>
                  <p className="text-[15px] font-bold">{result.ok} {t('import_tx_unit')}</p>
                </div>
                <div className="flex items-center justify-between py-4">
                  <p className="text-[14px] text-muted-foreground">{t('import_sum_dup')}</p>
                  <p className="text-[15px] font-bold">{result.skipped} {t('import_tx_unit')}</p>
                </div>
                {(result.failed || 0) > 0 ? (
                  <div className="flex items-center justify-between py-4">
                    <p className="text-[14px] text-rose-600 dark:text-rose-400">{t('import_sum_failed', 'Gagal (kurs tidak tersedia / error)')}</p>
                    <p className="text-[15px] font-bold text-rose-600 dark:text-rose-400">{result.failed} {t('import_tx_unit')}</p>
                  </div>
                ) : null}
                <div className="flex items-center justify-between py-4">
                  <p className="text-[14px] text-muted-foreground">{t('import_sum_balance')}</p>
                  <p className="text-[15px] font-bold tabular-nums text-right break-words">{fmtStat(Number(wallet?.balance) || 0, walletCur)}</p>
                </div>
              </div>

              {caps.columns && batchId && (
                <button
                  type="button"
                  onClick={undoImport}
                  disabled={busy}
                  className="w-full mt-4 rounded-2xl border border-zinc-200/70 dark:border-white/10 py-3.5 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  <Undo2 size={16} /> {t('import_undo')}
                </button>
              )}
            </div>
          )}

          <div className="h-2" />
          </div>

          {/* bottom bar: satu tombol aksi primer */}
          <div className="shrink-0 px-5 pt-3 pb-6 bg-gradient-to-t from-background via-background/95 to-transparent">
            <PrimaryBarButton onClick={barAction.onClick} disabled={barAction.disabled} testId={barAction.testId}>
              {barAction.label}
              {!busy && <ChevronRight size={18} strokeWidth={2.5} />}
            </PrimaryBarButton>
          </div>
        </div>
      </motion.div>

      {/* picker dompet (layar review) */}
      <Sheet open={pickWallet} onClose={() => setPickWallet(false)} title={t('import_choose_wallet')} zIndex={90}>
        <div className="px-4 pb-6 space-y-2">
          {(accounts || []).map((a) => {
            const active = a.id === walletId
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => changeWallet(a.id)}
                className={cn(card, 'w-full p-4 flex items-center gap-3 text-left', active && 'border-foreground/40')}
              >
                <div className={cn(tile, 'h-11 w-11 rounded-2xl text-[14px] font-bold')}>{walletInitials(a.name)}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[15px] truncate">{a.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{a.currency}</p>
                </div>
                {active && <Check size={18} strokeWidth={2.5} className="text-foreground shrink-0" />}
              </button>
            )
          })}
        </div>
      </Sheet>

      {/* picker kategori */}
      <Sheet open={pickCatFor != null} onClose={() => { setPickCatFor(null); setCatSearch('') }} title={t('select_category')} zIndex={90} noPadding>
        <div className="px-4 pt-2 pb-6">
          <div className="relative mb-3">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={catSearch}
              onChange={(e) => setCatSearch(e.target.value)}
              placeholder={t('search')}
              className="w-full rounded-xl border border-border/60 bg-background pl-9 pr-3 py-2.5 text-sm outline-none"
            />
          </div>
          <div className="grid grid-cols-4 gap-2 max-h-[50dvh] overflow-y-auto">
            {filteredCats.map((c) => {
              const active = pickCatFor != null && catOf(rows.find((r) => r.idx === pickCatFor) || {}) === c.id
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => { setCatEdits((e) => ({ ...e, [pickCatFor]: c.id })); setPickCatFor(null); setCatSearch('') }}
                  className="flex flex-col items-center gap-1.5 py-2"
                >
                  <div className={cn('h-14 w-14 rounded-2xl flex items-center justify-center border transition-all', active ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 border-zinc-950 dark:border-white' : 'bg-white dark:bg-[#1c1c1e] text-zinc-900 dark:text-zinc-100 border-zinc-200 dark:border-white/10')}>
                    <CategoryBadge id={c.id} size="md" />
                  </div>
                  <span className="text-[11px] font-semibold text-center leading-tight">{t(`cat_${c.id}`)}</span>
                </button>
              )
            })}
          </div>
        </div>
      </Sheet>

      {/* picker mata uang untuk wallet baru */}
      <CurrencySheet
        open={pickCur}
        onClose={() => setPickCur(false)}
        value={nwCurrency}
        onSelect={(c) => { setNwCurrency(c); setPickCur(false) }}
        zIndex={90}
      />
    </>
  )
}

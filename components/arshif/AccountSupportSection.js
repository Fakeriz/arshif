'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { FolderX, LogOut, Trash2, MessageSquareDot, ChevronRight, AlertTriangle, Bug, MessageSquare, HelpCircle, Download, Upload, Paperclip, Image as ImageIcon, X, Loader2, Sparkles, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { useApp } from './context'
import { Card, SectionLabel, Sheet, Field, TextInput, Segmented, PrimaryButton } from './ui'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { sendTelegramSupportNotification } from '@/lib/telegram'
import { FULL_VERSION_LABEL } from '@/lib/version'

const uid = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `rp_${Date.now()}_${Math.random().toString(36).slice(2)}`)
const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d } catch { return d } }
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} }

function MenuRow({ icon: Icon, label, onClick, danger, testId }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-zinc-100 dark:active:bg-zinc-800/60 transition"
      data-testid={testId}
    >
      <div
        className={cn(
          'h-9 w-9 rounded-xl flex items-center justify-center shrink-0',
          danger
            ? 'bg-rose-500/10 text-rose-500 dark:bg-rose-500/20'
            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white'
        )}
      >
        <Icon size={17} strokeWidth={1.75} />
      </div>
      <span
        className={cn(
          'flex-1 font-semibold text-[15px]',
          danger ? 'text-rose-500 dark:text-rose-400' : 'text-zinc-950 dark:text-white'
        )}
      >
        {label}
      </span>
      <ChevronRight size={16} className="text-zinc-400 dark:text-zinc-500 shrink-0" />
    </button>
  )
}

export default function AccountSupportSection() {
  const { t, session, isGuest, store, refresh, signOut, open, transactions = [], accounts = [] } = useApp()
  const scope = session?.user?.id || 'guest'
  const REPORTS_KEY = `arshif_reports_${scope}`

  // Clear transactions
  const [clearOpen, setClearOpen] = useState(false)
  const [clearScope, setClearScope] = useState('all')
  const [accId, setAccId] = useState(null)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [clearStep, setClearStep] = useState(0)
  const [busy, setBusy] = useState(false)

  // Sign out
  const [signOutOpen, setSignOutOpen] = useState(false)

  // Delete account
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteText, setDeleteText] = useState('')

  // Reports & support ticket
  const [reportsOpen, setReportsOpen] = useState(false)
  const [reports, setReports] = useState([])
  const [rptType, setRptType] = useState('bug') // 'bug' | 'feature' | 'question'
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [file, setFile] = useState(null)
  const [filePreview, setFilePreview] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const fileInputRef = useRef(null)

  useEffect(() => { if (reportsOpen) setReports(lsGet(REPORTS_KEY, []) || []) }, [reportsOpen]) // eslint-disable-line

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0]
    if (!selected) return
    if (selected.size > 5 * 1024 * 1024) {
      toast.error(t('file_size_max_5mb', 'Ukuran file maksimal 5MB'))
      return
    }
    setFile(selected)
    if (selected.type?.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = () => setFilePreview(reader.result)
      reader.readAsDataURL(selected)
    } else {
      setFilePreview(null)
    }
  }

  const handleRemoveFile = () => {
    setFile(null)
    setFilePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSubmitReport = async (e) => {
    e?.preventDefault?.()
    if (!subject.trim()) {
      toast.error(t('please_fill_subject', 'Mohon isi subjek laporan'))
      return
    }
    if (!description.trim()) {
      toast.error(t('please_fill_description', 'Mohon isi deskripsi kendala'))
      return
    }

    setIsSubmitting(true)
    let attachment_url = null

    try {
      // 1. Kirim langsung ke Telegram Admin via FormData (Native multipart/form-data)
      await sendTelegramSupportNotification({
        type: rptType,
        subject: subject.trim(),
        description: description.trim(),
        userEmail: session?.user?.email || null,
        userId: session?.user?.id || null,
        file: file || null,
        accessToken: session?.access_token || '',
      })

      // 2. Upload opsional ke Supabase Storage untuk riwayat aplikasi
      if (file && session?.user?.id) {
        const sanitized = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        const fileName = `${session.user.id}/${Date.now()}_${sanitized}`
        try {
          const { error: uploadError } = await supabase.storage
            .from('support_attachments')
            .upload(fileName, file, { cacheControl: '3600', upsert: false })

          if (uploadError) {
            console.warn('Storage upload notice:', uploadError)
          } else {
            const { data: urlData, error: signedUrlError } = await supabase.storage
              .from('support_attachments')
              .createSignedUrl(fileName, 60 * 60)
            if (signedUrlError) console.warn('Signed URL notice:', signedUrlError)
            attachment_url = urlData?.signedUrl || null
          }
        } catch (uploadEx) {
          console.warn('Upload exception:', uploadEx)
        }
      }

      // 3. Simpan ke database Supabase jika tersedia
      const ticketPayload = {
        user_id: session?.user?.id || null,
        user_email: session?.user?.email || null,
        type: rptType,
        subject: subject.trim(),
        description: description.trim(),
        attachment_url: attachment_url || null,
      }

      try {
        const { error: dbError } = await supabase
          .from('support_tickets')
          .insert([ticketPayload])
        if (dbError) {
          console.warn('Database insert notice:', dbError)
        }
      } catch (dbEx) {
        console.warn('DB insert exception:', dbEx)
      }

      // 4. Simpan ke riwayat lokal
      const localEntry = {
        id: uid(),
        type: rptType,
        subject: subject.trim(),
        description: description.trim(),
        attachment_url,
        status: 'open',
        created_at: new Date().toISOString()
      }
      const next = [localEntry, ...(reports || [])]
      setReports(next)
      lsSet(REPORTS_KEY, next)

      // 5. Berikan feedback sukses dan reset formulir
      toast.success(t('report_success_toast', 'Laporan berhasil dikirim! Tim Arshif akan segera memeriksanya.'))
      setSubject('')
      setDescription('')
      setRptType('bug')
      handleRemoveFile()
      setReportsOpen(false)
    } catch (err) {
      console.error('Submit report to Telegram error:', err)
      toast.error(t('report_error_toast', 'Gagal mengirim laporan. Silakan periksa koneksi.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const matched = useMemo(() => {
    const list = transactions || []
    if (clearScope === 'account') return list.filter((tx) => tx?.account_id === accId)
    if (clearScope === 'range') {
      return list.filter((tx) => {
        const d = new Date(tx?.date || tx?.created_at || 0)
        if (isNaN(d.getTime())) return false
        const day = new Date(d).setHours(0, 0, 0, 0)
        if (from) { const f = new Date(from).setHours(0, 0, 0, 0); if (day < f) return false }
        if (to) { const tt = new Date(to).setHours(0, 0, 0, 0); if (day > tt) return false }
        return true
      })
    }
    return list
  }, [transactions, clearScope, accId, from, to])

  const openClear = () => { setClearScope('all'); setAccId((accounts || [])[0]?.id || null); setFrom(''); setTo(''); setClearStep(0); setClearOpen(true) }

  const doClear = async () => {
    setBusy(true)
    try {
      for (const tx of (matched || [])) { try { await store?.deleteTransaction?.(tx.id) } catch {} }
      if (refresh) await refresh()
      toast.success(t('cleared_msg'))
    } catch { toast.error(t('error')) }
    setBusy(false); setClearOpen(false); setClearStep(0)
  }

  const doSignOut = async () => { setSignOutOpen(false); try { await signOut?.() } catch {} }

  const doDelete = async () => {
    if (deleteText.trim().toUpperCase() !== 'DELETE') return
    setBusy(true)
    try {
      for (const tx of (transactions || [])) { try { await store?.deleteTransaction?.(tx.id) } catch {} }
      for (const a of (accounts || [])) { try { await store?.deleteAccount?.(a.id) } catch {} }
      try { const goals = (await store?.listGoals?.()) || []; for (const g of goals) { try { await store?.deleteGoal?.(g.id) } catch {} } } catch {}
      // wipe device-local modules
      ;['arshif_recurring', 'arshif_networth_assets', 'arshif_networth_liabs', `arshif_invoices_${scope}`, `arshif_bills_${scope}`, REPORTS_KEY, 'arshif_business_cfg'].forEach((k) => { try { localStorage.removeItem(k) } catch {} })
    } catch {}
    setBusy(false); setDeleteOpen(false); setDeleteText('')
    toast.success(t('account_deleted'))
    try { await signOut?.() } catch {}
  }

  const typeLabels = {
    bug: t('report_bug', 'Masalah / Bug'),
    feature: t('report_feature', 'Saran Fitur'),
    question: t('report_question', 'Pertanyaan Umum'),
  }
  const typeIcons = {
    bug: Bug,
    feature: Sparkles,
    question: HelpCircle
  }
  const canDelete = deleteText.trim().toUpperCase() === 'DELETE'

  return (
    <>
      {/* ACCOUNT */}
      <SectionLabel className="text-xs font-semibold tracking-wider text-muted-foreground uppercase px-1 mb-2 mt-7">
        {t('account_section')}
      </SectionLabel>
      <Card className="divide-y divide-zinc-200/60 dark:divide-white/5 overflow-hidden rounded-2xl">
        <MenuRow icon={Download} label={t('export_transactions')} onClick={() => open?.('exportTx')} testId="acc-export" />
        <MenuRow icon={Upload} label={t('import_transactions')} onClick={() => open?.('importTx')} testId="acc-import" />
        <MenuRow icon={FolderX} label={t('clear_tx')} onClick={openClear} testId="acc-clear-tx" />
        <MenuRow icon={LogOut} label={t('sign_out')} onClick={() => setSignOutOpen(true)} testId="acc-signout" />
        <MenuRow icon={Trash2} label={t('delete_account')} onClick={() => { setDeleteText(''); setDeleteOpen(true) }} danger testId="acc-delete" />
      </Card>

      {/* SUPPORT */}
      <SectionLabel className="text-xs font-semibold tracking-wider text-muted-foreground uppercase px-1 mb-2 mt-4">
        {t('support_section')}
      </SectionLabel>
      <Card className="divide-y divide-zinc-200/60 dark:divide-white/5 overflow-hidden rounded-2xl">
        <MenuRow icon={MessageSquareDot} label={t('reports_support')} onClick={() => setReportsOpen(true)} testId="acc-reports" />
      </Card>

      {/* Footer */}
      <p className="text-center text-[11px] font-medium text-zinc-400 dark:text-zinc-600 mt-4 mb-2 select-none tracking-tight">
        {FULL_VERSION_LABEL}
      </p>

      {/* Clear Transactions sheet */}
      <Sheet open={clearOpen} onClose={() => { setClearOpen(false); setClearStep(0) }} title={t('clear_tx')}>
        {clearStep === 0 ? (
          <div className="pt-1 space-y-4">
            <Field label={t('filter')}>
              <Segmented value={clearScope} onChange={(v) => setClearScope(v)} options={[{ id: 'all', label: t('clear_scope_all') }, { id: 'range', label: t('clear_scope_range') }, { id: 'account', label: t('clear_scope_account') }]} />
            </Field>
            {clearScope === 'range' ? (
              <div className="grid grid-cols-2 gap-2">
                <Field label={t('from')}><TextInput type="date" value={from} onChange={(e) => setFrom(e.target.value)} data-testid="clear-from" /></Field>
                <Field label={t('to')}><TextInput type="date" value={to} onChange={(e) => setTo(e.target.value)} data-testid="clear-to" /></Field>
              </div>
            ) : null}
            {clearScope === 'account' ? (
              <Field label={t('source_account')}>
                <div className="flex gap-2 overflow-x-auto no-scrollbar">
                  {(accounts || []).length === 0 ? <p className="text-sm text-muted-foreground">{t('no_account_opt')}</p> : null}
                  {(accounts || []).map((a) => (
                    <button key={a.id} type="button" onClick={() => setAccId(a.id)} className={cn('shrink-0 rounded-xl border px-3 py-2 text-sm font-medium whitespace-nowrap', accId === a.id ? 'bg-foreground text-background border-foreground' : 'bg-background border-border/60')}>{a.name}</button>
                  ))}
                </div>
              </Field>
            ) : null}
            <div className="rounded-xl bg-muted/60 px-4 py-3 text-sm">
              <span className="font-semibold tabular-nums">{(matched || []).length}</span> {t('clear_count_suffix')}
            </div>
            <button type="button" disabled={(matched || []).length === 0} onClick={() => setClearStep(1)} className={cn('w-full rounded-xl bg-rose-500 text-white font-semibold py-3.5 text-[15px]', (matched || []).length === 0 && 'opacity-40')} data-testid="clear-next">{t('clear_now')}</button>
          </div>
        ) : (
          <div className="pt-1">
            <div className="h-12 w-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto"><AlertTriangle size={24} strokeWidth={1.75} /></div>
            <h3 className="text-lg font-bold text-center mt-3">{t('clear_confirm_title')}</h3>
            <p className="text-sm text-muted-foreground text-center mt-1.5 px-4">{t('clear_confirm_body')}</p>
            <div className="mt-5 space-y-2">
              <button type="button" disabled={busy} onClick={doClear} className="w-full rounded-xl bg-rose-500 text-white font-semibold py-3.5 text-[15px] disabled:opacity-50" data-testid="clear-confirm">{t('confirm_again')}</button>
              <button type="button" onClick={() => setClearStep(0)} className="w-full rounded-xl bg-card border border-border/60 font-semibold py-3.5 text-[15px]">{t('cancel')}</button>
            </div>
          </div>
        )}
      </Sheet>

      {/* Sign Out sheet */}
      <Sheet open={signOutOpen} onClose={() => setSignOutOpen(false)} title={t('sign_out')}>
        <div className="pt-1">
          <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center mx-auto"><LogOut size={22} strokeWidth={1.75} /></div>
          <h3 className="text-lg font-bold text-center mt-3">{t('sign_out_confirm')}</h3>
          <p className="text-sm text-muted-foreground text-center mt-1.5">{t('sign_out_confirm_body')}</p>
          <div className="mt-5 space-y-2">
            <PrimaryButton onClick={doSignOut} data-testid="signout-confirm">{t('sign_out')}</PrimaryButton>
            <button type="button" onClick={() => setSignOutOpen(false)} className="w-full rounded-xl bg-card border border-border/60 font-semibold py-3.5 text-[15px]">{t('cancel')}</button>
          </div>
        </div>
      </Sheet>

      {/* Delete Account sheet */}
      <Sheet open={deleteOpen} onClose={() => { setDeleteOpen(false); setDeleteText('') }} title={t('delete_account')}>
        <div className="pt-1">
          <div className="h-12 w-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto"><AlertTriangle size={24} strokeWidth={1.75} /></div>
          <h3 className="text-lg font-bold text-center mt-3">{t('delete_danger_title')}</h3>
          <p className="text-sm text-muted-foreground text-center mt-1.5 px-2">{t('delete_danger_body')}</p>
          <div className="mt-4">
            <Field label={t('delete_type_hint')}>
              <TextInput value={deleteText} onChange={(e) => setDeleteText(e.target.value)} placeholder="DELETE" autoCapitalize="characters" data-testid="delete-input" />
            </Field>
          </div>
          <div className="mt-5 space-y-2">
            <button type="button" disabled={!canDelete || busy} onClick={doDelete} className={cn('w-full rounded-xl bg-rose-500 text-white font-semibold py-3.5 text-[15px]', (!canDelete || busy) && 'opacity-40')} data-testid="delete-confirm">{t('delete_confirm_btn')}</button>
            <button type="button" onClick={() => { setDeleteOpen(false); setDeleteText('') }} className="w-full rounded-xl bg-card border border-border/60 font-semibold py-3.5 text-[15px]">{t('cancel')}</button>
          </div>
        </div>
      </Sheet>

      {/* Reports & Support sheet */}
      <Sheet
        open={reportsOpen}
        onClose={() => { if (!isSubmitting) setReportsOpen(false) }}
        full
        title={t('report_issue_title', 'Laporkan Masalah / Bantuan')}
        left={
          <button
            type="button"
            onClick={() => setReportsOpen(false)}
            className="text-sm font-semibold text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white transition-colors"
          >
            {t('cancel')}
          </button>
        }
      >
        <div className="pt-1 space-y-4">
          <div className="rounded-3xl bg-zinc-100/80 border border-zinc-200/60 dark:bg-[#141416] dark:border-white/5 p-4 space-y-4">
            {/* Pilihan Tipe */}
            <div>
              <Segmented
                value={rptType}
                onChange={setRptType}
                options={[
                  { id: 'bug', label: t('report_bug', 'Masalah / Bug') },
                  { id: 'feature', label: t('report_feature', 'Saran Fitur') },
                  { id: 'question', label: t('report_question', 'Pertanyaan Umum') }
                ]}
              />
            </div>

            {/* Subjek */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase block mb-1.5 px-0.5">
                {t('subject_label', 'SUBJEK')}
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder={t('support_subject_ph', 'e.g. Saldo tidak sinkron, error kamera saat scan struk...')}
                className="w-full rounded-2xl bg-muted/40 border border-border/40 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-border transition-colors"
                data-testid="support-subject"
              />
            </div>

            {/* Deskripsi */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase block mb-1.5 px-0.5">
                {t('description_label', 'DESKRIPSI')}
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('support_desc_ph', 'Jelaskan langkah terjadinya kendala secara mendetail...')}
                className="w-full min-h-[110px] rounded-2xl bg-muted/40 p-4 text-sm text-foreground border border-border/40 outline-none focus:border-border transition-colors resize-none placeholder:text-muted-foreground"
                data-testid="support-description"
              />
            </div>

            {/* Lampiran Berkas / Foto */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase block mb-1.5 px-0.5">
                {t('attachment_optional', 'LAMPIRAN BUKTI (OPSIONAL)')}
              </label>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept="image/*,.pdf,.doc,.docx,.txt"
                data-testid="support-file-input"
              />
              {!file ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full rounded-2xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-muted/40 transition-colors border border-dashed border-border/60 bg-muted/10 text-center"
                  data-testid="support-upload-box"
                >
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Paperclip size={18} />
                    <ImageIcon size={18} />
                  </div>
                  <p className="text-xs font-medium text-foreground">{t('upload_attachment_hint', 'Klik untuk unggah berkas atau tangkapan layar')}</p>
                  <p className="text-[11px] text-muted-foreground">PNG, JPG, PDF ({t('file_size_max_5mb', 'Maks. 5MB')})</p>
                </div>
              ) : (
                <div className="relative flex items-center gap-3 p-3 rounded-2xl bg-muted/40 border border-border/40">
                  {filePreview ? (
                    <img
                      src={filePreview}
                      alt="Preview"
                      className="w-14 h-14 object-cover rounded-xl border border-border/50 shrink-0"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                      <Paperclip size={22} />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{file?.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {file?.size ? `${(file.size / 1024).toFixed(1)} KB` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveFile}
                    className="h-8 w-8 rounded-full bg-background border border-border/60 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
                    aria-label={t('remove_file', 'Hapus berkas')}
                  >
                    <X size={15} />
                  </button>
                </div>
              )}
            </div>

            {/* Tombol Kirim Laporan */}
            <button
              type="button"
              disabled={isSubmitting || !subject.trim() || !description.trim()}
              onClick={handleSubmitReport}
              className="w-full bg-foreground text-background font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.99] transition-all disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
              data-testid="report-submit"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{file ? t('sending_file', 'Mengirim berkas...') : t('sending', 'Mengirim...')}</span>
                </>
              ) : (
                <span>{t('report_submit', 'Kirim Laporan')}</span>
              )}
            </button>
          </div>

          <div>
            <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase mb-2 px-1">
              {t('your_reports', 'Riwayat Laporan Anda')}
            </p>
            <div className="space-y-2">
              {(reports || []).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div className="h-12 w-12 rounded-2xl bg-zinc-100 dark:bg-white/[0.06] flex items-center justify-center mb-3">
                    <MessageSquareDot size={22} className="text-muted-foreground" strokeWidth={1.5} />
                  </div>
                  <p className="font-semibold">{t('report_none')}</p>
                  <p className="text-sm text-muted-foreground mt-1">{t('report_none_sub')}</p>
                </div>
              ) : null}
              {(reports || []).map((r) => {
                const Ic = typeIcons[r?.type] || MessageSquare
                return (
                  <div key={r?.id} className="rounded-2xl bg-zinc-100/80 border border-zinc-200/60 dark:bg-[#141416] dark:border-white/5 p-3.5 space-y-2" data-testid="report-row">
                    <div className="flex items-start gap-3">
                      <div className="h-9 w-9 rounded-xl bg-background flex items-center justify-center text-foreground shrink-0 mt-0.5">
                        <Ic size={16} strokeWidth={1.75} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-bold text-[14px] truncate text-foreground">{r?.subject || r?.message}</p>
                          <span className="rounded-full border border-border/70 bg-background/50 text-muted-foreground px-2 py-0.5 text-[10px] font-semibold shrink-0">
                            {r?.status === 'resolved' ? t('status_resolved', 'Selesai') : t('status_in_progress', 'Dalam Proses')}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground font-medium mt-0.5">
                          {typeLabels[r?.type] || r?.type || t('reports_support', 'Laporan')}
                          {r?.created_at ? ` · ${new Date(r.created_at).toLocaleDateString()}` : ''}
                        </p>
                        {r?.description ? (
                          <p className="text-xs text-foreground/80 mt-1 line-clamp-2">{r.description}</p>
                        ) : null}
                      </div>
                    </div>

                    {r?.attachment_url ? (
                      <div className="pt-1 pl-12">
                        <a
                          href={r.attachment_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/60 hover:bg-muted text-[11px] font-semibold text-foreground border border-border/40 transition-colors"
                        >
                          <Paperclip size={12} />
                          <span>{t('view_attachment', 'Lihat Lampiran Bukti')}</span>
                          <ExternalLink size={11} className="text-muted-foreground" />
                        </a>
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
        <div className="h-6" />
      </Sheet>
    </>
  )
}

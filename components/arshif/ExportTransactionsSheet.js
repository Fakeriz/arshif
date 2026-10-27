'use client'
import { useMemo, useState } from 'react'
import { Download, FileSpreadsheet } from 'lucide-react'
import { toast } from 'sonner'
import { useApp } from './context'
import { Sheet, Field, TextInput, Segmented } from './ui'
import { cn } from '@/lib/utils'

const COLUMNS = ['Date', 'Type', 'Category', 'Amount', 'Currency', 'Account', 'Payment Method', 'Note']

const toISODate = (d) => {
  try { const x = new Date(d); if (isNaN(x.getTime())) return ''; return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}` } catch { return '' }
}

export default function ExportTransactionsSheet({ open, onClose }) {
  const { t, transactions = [], accounts = [] } = useApp()
  const [format, setFormat] = useState('xlsx')
  const [range, setRange] = useState('current')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [accountId, setAccountId] = useState('all')
  const [busy, setBusy] = useState(false)

  const filtered = useMemo(() => {
    const list = Array.isArray(transactions) ? transactions : []
    const now = new Date()
    let start = null, end = null
    if (range === 'current') start = new Date(now.getFullYear(), now.getMonth(), 1)
    else if (range === '3m') start = new Date(now.getFullYear(), now.getMonth() - 2, 1)
    else if (range === 'custom') { if (from) start = new Date(from); if (to) { end = new Date(to); end.setHours(23, 59, 59, 999) } }
    return list.filter((tx) => {
      if (accountId !== 'all' && tx?.account_id !== accountId) return false
      const d = new Date(tx?.date || tx?.created_at || 0)
      if (isNaN(d.getTime())) return range === 'all'
      if (start && d < start) return false
      if (end && d > end) return false
      return true
    })
  }, [transactions, range, from, to, accountId])

  const accName = (id) => (accounts || []).find((a) => a?.id === id)?.name || ''

  const download = async () => {
    if (busy) return
    if (!(filtered || []).length) { toast.error(t('export_empty')); return }
    setBusy(true)
    try {
      const XLSX = await import('xlsx')
      const aoa = [COLUMNS]
      ;(filtered || []).forEach((tx) => {
        aoa.push([
          toISODate(tx?.date || tx?.created_at),
          tx?.type || '',
          tx?.category || '',
          Number(tx?.amount) || 0,
          tx?.currency || '',
          accName(tx?.account_id),
          tx?.payment_method || '',
          tx?.note || '',
        ])
      })
      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.aoa_to_sheet(aoa)
      XLSX.utils.book_append_sheet(wb, ws, 'Transactions')
      const stamp = toISODate(new Date()).replace(/-/g, '')
      const name = `arshif_transactions_${stamp}`
      if (format === 'csv') XLSX.writeFile(wb, `${name}.csv`, { bookType: 'csv' })
      else XLSX.writeFile(wb, `${name}.xlsx`)
      toast.success(t('exported_msg'))
      onClose?.()
    } catch (e) {
      toast.error(t('error'))
    } finally { setBusy(false) }
  }

  const card = 'rounded-2xl bg-zinc-100 border border-zinc-200/60 dark:bg-[#141416] dark:border-white/5 p-4'

  return (
    <Sheet open={open} onClose={onClose} title={t('export_data')}>
      <div className="pt-1 space-y-4">
        <Field label={t('file_format')}>
          <Segmented value={format} onChange={setFormat} options={[{ id: 'xlsx', label: t('fmt_excel') }, { id: 'csv', label: t('fmt_csv') }]} />
        </Field>

        <Field label={t('time_range')}>
          <Segmented size="sm" value={range} onChange={setRange} options={[{ id: 'current', label: t('range_current') }, { id: '3m', label: t('range_3m') }, { id: 'all', label: t('range_all') }, { id: 'custom', label: t('range_custom') }]} />
        </Field>
        {range === 'custom' ? (
          <div className="grid grid-cols-2 gap-2">
            <Field label={t('from')}><TextInput type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
            <Field label={t('to')}><TextInput type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
          </div>
        ) : null}

        <Field label={t('accounts')}>
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            <button type="button" onClick={() => setAccountId('all')} className={cn('shrink-0 rounded-xl border px-3 py-2 text-sm font-medium', accountId === 'all' ? 'bg-foreground text-background border-foreground' : 'bg-background border-border/60')}>{t('all_accounts')}</button>
            {(accounts || []).map((a) => (
              <button key={a.id} type="button" onClick={() => setAccountId(a.id)} className={cn('shrink-0 rounded-xl border px-3 py-2 text-sm font-medium whitespace-nowrap', accountId === a.id ? 'bg-foreground text-background border-foreground' : 'bg-background border-border/60')}>{a.name}</button>
            ))}
          </div>
        </Field>

        <div className={cn(card, 'flex items-center gap-3')}>
          <div className="h-10 w-10 rounded-xl bg-background flex items-center justify-center text-foreground shrink-0"><FileSpreadsheet size={18} strokeWidth={1.75} /></div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-[15px]">{(filtered || []).length} {t('transactions').toLowerCase()}</p>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{COLUMNS.join(' · ')}</p>
          </div>
        </div>

        <button type="button" onClick={download} disabled={busy || !(filtered || []).length} className={cn('w-full rounded-xl bg-foreground text-background font-semibold py-3.5 text-[15px] flex items-center justify-center gap-2', (busy || !(filtered || []).length) && 'opacity-40')} data-testid="export-download">
          <Download size={18} /> {t('download_file')}
        </button>
        <div className="h-2" />
      </div>
    </Sheet>
  )
}

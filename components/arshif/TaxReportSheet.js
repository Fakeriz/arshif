'use client'
import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Download, FileSpreadsheet, Landmark } from 'lucide-react'
import { toast } from 'sonner'
import { useApp } from './context'
import { Sheet, Segmented, EmptyState } from './ui'
import { buildTaxReport, taxReportRows } from '@/lib/tax-report'
import { safeConvert } from '@/lib/rates'
import { LOCALE_MAP } from '@/lib/i18n'
import { getCategory } from '@/lib/categories'
import { cn } from '@/lib/utils'

// Sheet ringkasan pajak: agregasi transaksi bertanda tax_deductible
// untuk satu bulan atau satu tahun, plus export CSV/XLSX.
export default function TaxReportSheet({ open, onClose }) {
  const { t, lang, profile, transactions = [], home, rates, fmt } = useApp()
  const now = new Date()
  const [mode, setMode] = useState('month') // 'month' | 'year'
  const [cursor, setCursor] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const toHome = (amount, currency) => safeConvert(amount, currency || home, home, rates) ?? 0

  const report = useMemo(() => {
    try {
      return buildTaxReport(transactions, {
        year: cursor.getFullYear(),
        month: mode === 'month' ? cursor.getMonth() : null,
        toHome,
      })
    } catch (e) {
      // Data tidak valid (bukan array, dsb.) tetap tampil sebagai laporan kosong,
      // bukan crash; state error ditandai agar user tahu hasilnya belum final.
      setError(e?.message || t('error'))
      return { total: 0, count: 0, byCategory: [], transactions: [] }
    }
  }, [transactions, cursor, mode, home, rates]) // eslint-disable-line react-hooks/exhaustive-deps

  const periodLabel = mode === 'month'
    ? cursor.toLocaleDateString(LOCALE_MAP[lang] || 'en-US', { month: 'long', year: 'numeric' })
    : String(cursor.getFullYear())

  const bump = (delta) => {
    setError(null)
    setCursor((c) => (mode === 'month' ? new Date(c.getFullYear(), c.getMonth() + delta, 1) : new Date(c.getFullYear() + delta, c.getMonth(), 1)))
  }

  const switchMode = (m) => {
    setError(null)
    setMode(m)
  }

  const download = async (format) => {
    if (busy) return
    if (!report.count) { toast.error(t('tax_report_empty', 'No deductible transactions')); return }
    setBusy(true)
    try {
      const XLSX = await import('xlsx')
      const stamp = `${cursor.getFullYear()}${mode === 'month' ? String(cursor.getMonth() + 1).padStart(2, '0') : ''}`
      const aoa = taxReportRows(report, { label: periodLabel, currency: home })
      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.aoa_to_sheet(aoa)
      XLSX.utils.book_append_sheet(wb, ws, 'Tax Report')
      const name = `arshif_tax_report_${stamp}`
      if (format === 'csv') XLSX.writeFile(wb, `${name}.csv`, { bookType: 'csv' })
      else XLSX.writeFile(wb, `${name}.xlsx`)
      toast.success(t('exported_msg'))
    } catch (e) {
      toast.error(t('error'))
    } finally { setBusy(false) }
  }

  const card = 'rounded-2xl bg-zinc-100 border border-zinc-200/60 dark:bg-[#141416] dark:border-white/5 p-4'
  const hasData = report.count > 0

  return (
    <Sheet open={open} onClose={onClose} title={t('tax_report', 'Tax Report')}>
      <div className="pt-1 space-y-4">
        <Segmented value={mode} onChange={switchMode} options={[{ id: 'month', label: t('period_month') }, { id: 'year', label: t('period_year') }]} />

        {/* Navigasi periode: tombol icon dengan aria-label, semua bisa dikeyboard */}
        <div className="flex items-center justify-between gap-2">
          <button type="button" onClick={() => bump(-1)} aria-label={t('tax_prev_period', 'Previous period')} className="h-11 w-11 rounded-xl bg-background border border-border/60 flex items-center justify-center text-foreground hover:bg-muted/40 transition">
            <ChevronLeft size={18} />
          </button>
          <p className="flex-1 text-center font-bold text-[15px] text-foreground truncate" aria-live="polite">{periodLabel}</p>
          <button type="button" onClick={() => bump(1)} aria-label={t('tax_next_period', 'Next period')} className="h-11 w-11 rounded-xl bg-background border border-border/60 flex items-center justify-center text-foreground hover:bg-muted/40 transition">
            <ChevronRight size={18} />
          </button>
        </div>

        {error ? (
          <div role="alert" className={cn(card, 'text-sm font-medium text-foreground')}>
            {t('tax_report_error', 'Report data could not be processed, totals may be incomplete')}
          </div>
        ) : null}

        {/* Ringkasan: kartu utama total deductible, fokus satu layar */}
        <div className="rounded-2xl bg-[#0c0c0e] dark:bg-[#141416] border border-white/10 p-5" data-testid="tax-summary">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/50">{t('tax_total_deductible', 'Total deductible')}</p>
          <p className="text-2xl font-extrabold text-white mt-1 truncate">{fmt(report.total, home)}</p>
          <p className="text-sm text-white/60 mt-1">{report.count} {t('transactions').toLowerCase()}</p>
        </div>

        {/* Breakdown per kategori */}
        {hasData ? (
          <div className="space-y-2">
            {report.byCategory.map((c) => (
              <div key={c.category} className={cn(card, 'flex items-center gap-3')}>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[15px] text-foreground truncate">{t(`cat_${c.category}`, c.category)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{c.count} {t('transactions').toLowerCase()}</p>
                </div>
                <p className="font-bold text-[15px] text-foreground shrink-0">{fmt(c.total, home)}</p>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Landmark}
            title={t('tax_report_empty', 'No deductible transactions')}
            subtitle={t('tax_report_empty_sub', 'Mark a transaction as tax deductible to see it here')}
          />
        )}

        {hasData ? (
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => download('csv')} disabled={busy} className="rounded-xl bg-white dark:bg-[#121214] border border-border/80 text-foreground font-semibold py-3.5 text-[15px] flex items-center justify-center gap-2 hover:bg-muted/40 transition disabled:opacity-40" data-testid="tax-export-csv">
              <Download size={17} /> CSV
            </button>
            <button type="button" onClick={() => download('xlsx')} disabled={busy} className="rounded-xl bg-foreground text-background font-semibold py-3.5 text-[15px] flex items-center justify-center gap-2 transition disabled:opacity-40" data-testid="tax-export-xlsx">
              <FileSpreadsheet size={17} /> {t('fmt_excel')}
            </button>
          </div>
        ) : null}

        {profile?.taxStatus === 'pkp' || profile?.taxStatus === 'nonpkp' ? (
          <p className="text-xs text-muted-foreground text-center pb-2">{t('tax_status')}: {profile.taxStatus === 'pkp' ? t('pkp_label') : t('non_pkp')}</p>
        ) : null}
      </div>
    </Sheet>
  )
}

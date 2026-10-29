'use client'
import { useEffect, useState } from 'react'
import { Minus, Plus, Check, CalendarDays } from 'lucide-react'
import { toast } from 'sonner'
import { useApp } from './context'
import { Sheet, PrimaryButton, SectionLabel } from './ui'
import { clampMonthStartDay, MONTH_START_DEFAULT, MONTH_START_KEY, readMonthStartDay, monthRangeLabel } from '@/lib/month-cycle'
import { LOCALE_MAP } from '@/lib/i18n'
import { cn } from '@/lib/utils'

const PRESETS = [1, 5, 10, 15, 20, 25, 31]

export default function MonthStartSheet({ open, onClose }) {
  const { t, lang, profile, updateProfile } = useApp()
  const [day, setDay] = useState(MONTH_START_DEFAULT)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setDay(readMonthStartDay(
      (k) => { try { return localStorage.getItem(k) } catch { return null } },
      profile
    ))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const now = new Date()
  const preview = monthRangeLabel(day, now.getFullYear(), now.getMonth(), {
    locale: LOCALE_MAP[lang] || 'en-US',
  })

  const bump = (delta) => setDay((d) => clampMonthStartDay((d || MONTH_START_DEFAULT) + delta))

  const save = async () => {
    const value = clampMonthStartDay(day)
    setSaving(true)
    try {
      try { localStorage.setItem(MONTH_START_KEY, String(value)) } catch {}
      await updateProfile?.({ month_start_day: value })
      toast.success(t('month_start_saved'))
      onClose?.()
    } catch (e) {
      toast.error(e?.message || t('error'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={t('month_start_date')}>
      <div className="space-y-5">
        <p className="text-sm text-muted-foreground leading-relaxed">{t('month_start_desc')}</p>

        {/* Stepper */}
        <div className="rounded-2xl border border-border/70 bg-white dark:bg-[#18181b] p-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <SectionLabel>{t('month_start_day_label')}</SectionLabel>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label={t('month_start_decrease')}
                disabled={day <= 1}
                onClick={() => bump(-1)}
                className="h-11 w-11 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-foreground flex items-center justify-center transition-all active:scale-95 disabled:opacity-35 cursor-pointer"
              >
                <Minus size={18} />
              </button>
              <div className="h-11 min-w-[64px] px-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-xl font-extrabold text-foreground">
                {day}
              </div>
              <button
                type="button"
                aria-label={t('month_start_increase')}
                disabled={day >= 31}
                onClick={() => bump(1)}
                className="h-11 w-11 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-foreground flex items-center justify-center transition-all active:scale-95 disabled:opacity-35 cursor-pointer"
              >
                <Plus size={18} />
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <SectionLabel>{t('month_start_presets')}</SectionLabel>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setDay(p)}
                  aria-pressed={day === p}
                  className={cn(
                    'h-11 min-w-11 px-3 rounded-xl border text-sm font-bold transition-all active:scale-95 cursor-pointer',
                    day === p
                      ? 'bg-[#FF5F6D] border-[#FF5F6D] text-white'
                      : 'border-border/70 bg-white dark:bg-zinc-800/60 text-foreground hover:bg-muted/40'
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="rounded-2xl bg-[#FF5F6D]/10 border border-[#FF5F6D]/20 p-4 flex items-start gap-3">
          <CalendarDays size={18} className="text-[#FF5F6D] shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-foreground">{t('month_start_range')}</p>
            <p className="text-sm text-muted-foreground mt-0.5">{preview}</p>
          </div>
        </div>

        <PrimaryButton onClick={save} disabled={saving} data-testid="monthstart-save">
          {saving ? t('saving') : t('save')}
        </PrimaryButton>
      </div>
    </Sheet>
  )
}

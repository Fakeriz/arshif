'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Receipt, Wallet, ScanLine, Sparkles, SkipForward } from 'lucide-react'
import { toast } from 'sonner'
import { useApp } from './context'
import { Sheet, PrimaryButton, SecondaryButton } from './ui'
import { cn } from '@/lib/utils'

const TUTORIAL_DONE_KEY = 'arshif_tutorial_done'

const STEPS = [
  { Icon: Receipt, titleKey: 'tutorial_step1_title', descKey: 'tutorial_step1_desc' },
  { Icon: Wallet, titleKey: 'tutorial_step2_title', descKey: 'tutorial_step2_desc' },
  { Icon: ScanLine, titleKey: 'tutorial_step3_title', descKey: 'tutorial_step3_desc' },
  { Icon: Sparkles, titleKey: 'tutorial_step4_title', descKey: 'tutorial_step4_desc' },
]

export default function TutorialSheet({ open, onClose }) {
  const { t } = useApp()
  const [index, setIndex] = useState(0)
  const last = index === STEPS.length - 1
  const step = STEPS[index]

  const finish = () => {
    try { localStorage.setItem(TUTORIAL_DONE_KEY, '1') } catch {}
    if (last) toast.success(t('tutorial_done'))
    onClose?.()
  }

  const next = () => {
    if (last) { finish(); return }
    setIndex((i) => i + 1)
  }

  return (
    <Sheet open={open} onClose={onClose} title={t('tutorial')}>
      <div
        className="space-y-5"
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') { e.preventDefault(); next() }
          else if (e.key === 'ArrowLeft') { e.preventDefault(); setIndex((i) => Math.max(0, i - 1)) }
        }}
      >
        <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-white dark:bg-[#18181b]">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={index}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.18 }}
              className="p-6 flex flex-col items-center text-center gap-4"
            >
              <div className="h-16 w-16 rounded-3xl bg-[#FF5F6D]/10 text-[#FF5F6D] flex items-center justify-center shrink-0">
                <step.Icon size={28} />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-foreground">{t(step.titleKey)}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{t(step.descKey)}</p>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Dots pagination */}
        <div className="flex items-center justify-center gap-1.5" role="group" aria-label={t('tutorial_pagination')}>
          {STEPS.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`${i + 1} / ${STEPS.length}`}
              aria-current={i === index ? 'true' : undefined}
              onClick={() => setIndex(i)}
              className={cn(
                'h-2.5 rounded-full transition-all cursor-pointer',
                i === index ? 'w-6 bg-[#FF5F6D]' : 'w-2.5 bg-zinc-300 dark:bg-zinc-700'
              )}
            />
          ))}
        </div>

        <div className="space-y-2.5">
          <PrimaryButton onClick={next} data-testid="tutorial-next">
            {last ? t('tutorial_finish') : t('next')}
          </PrimaryButton>
          <SecondaryButton onClick={finish} data-testid="tutorial-skip">
            <span className="flex items-center justify-center gap-2"><SkipForward size={16} />{last ? t('tutorial_close') : t('skip')}</span>
          </SecondaryButton>
        </div>
      </div>
    </Sheet>
  )
}

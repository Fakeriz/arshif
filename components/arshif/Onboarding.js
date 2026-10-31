'use client'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { useApp } from './context'
import { PrimaryButton } from './ui'
import { LANGUAGES } from '@/lib/i18n'
import { ONBOARD_DEMO } from '@/lib/onboard-demo'
import { cn } from '@/lib/utils'
import { Mic, Receipt, Globe2 } from 'lucide-react'

function Illustration({ step, t, lang }) {
  // Abstract monochrome card illustrations - konten demo mengikuti bahasa aktif
  const demo = ONBOARD_DEMO[lang] || ONBOARD_DEMO.en
  if (step === 0) {
    return (
      <div className="relative h-64 w-full flex items-center justify-center">
        <motion.div initial={{ rotate: -8, y: 20, opacity: 0 }} animate={{ rotate: -8, y: 0, opacity: 1 }} className="absolute w-56 h-36 rounded-2xl bg-muted border border-border/50" />
        <motion.div initial={{ rotate: 4, y: 30, opacity: 0 }} animate={{ rotate: 4, y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="absolute w-60 h-36 rounded-2xl bg-foreground text-background p-5 shadow-2xl">
          <p className="label-upper !text-background/60">{demo.voice.item}</p>
          <p className="text-3xl font-bold mt-2">{demo.voice.price}</p>
          <div className="flex items-center gap-2 mt-3 text-xs opacity-80"><Mic size={14} /> {t('onboard_say_it')}</div>
        </motion.div>
      </div>
    )
  }
  if (step === 1) {
    return (
      <div className="relative h-64 w-full flex items-center justify-center">
        <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="w-64 rounded-2xl bg-card border border-border/50 p-5 shadow-xl">
          <div className="flex items-center justify-between"><p className="font-bold">{demo.receipt.merchant}</p><span className="text-[10px] font-semibold uppercase rounded-md bg-foreground text-background px-2 py-0.5">{t('demo_tag_groceries')}</span></div>
          <div className="mt-3 space-y-2 text-sm">
            {demo.receipt.items.map(([n, p]) => (
              <div key={n} className="flex justify-between text-muted-foreground"><span>{n}</span><span>{p}</span></div>
            ))}
            <div className="flex justify-between font-bold border-t border-border/50 pt-2"><span>{t('total')}</span><span>{demo.receipt.total}</span></div>
          </div>
          <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground"><Receipt size={14} /> {t('demo_receipt_note')}</div>
        </motion.div>
      </div>
    )
  }
  return (
    <div className="relative h-64 w-full flex items-center justify-center">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-64 rounded-2xl bg-foreground text-background p-5 shadow-2xl">
        <p className="label-upper !text-background/60">{t('onboard_total_balance')}</p>
        <p className="text-3xl font-bold mt-2">{demo.balance.amount}</p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          {demo.conversions.map(([flag, from, to]) => (
            <span key={flag} className="rounded-lg bg-background/15 px-2 py-1">{flag} {from} → {to}</span>
          ))}
        </div>
        <div className="flex items-center gap-2 mt-3 text-xs opacity-80"><Globe2 size={14} /> {t('onboard_currencies')}</div>
      </motion.div>
    </div>
  )
}

export default function Onboarding({ onDone }) {
  const { t, lang, setLang } = useApp()
  const [step, setStep] = useState(0)
  const slides = [
    { title: t('ob1_title'), desc: t('ob1_desc') },
    { title: t('ob2_title'), desc: t('ob2_desc') },
    { title: t('ob3_title'), desc: t('ob3_desc') },
  ]
  const last = step === slides.length - 1

  return (
    <div className="min-h-dvh bg-background flex flex-col max-w-md mx-auto px-6 safe-top">
      <div className="flex items-center justify-between pt-6">
        <p className="text-xl font-extrabold tracking-tight">Arshif</p>
        <div className="flex gap-1">
          {LANGUAGES.map((l) => (
            <button key={l.code} onClick={() => setLang(l.code)} className={cn('rounded-lg flex flex-col items-center justify-center py-1.5 min-w-11', lang === l.code ? 'bg-foreground' : 'bg-muted')} aria-label={l.name}>
              <span className="text-base leading-none">{l.flag}</span>
              <span className={cn('text-[10px] font-semibold uppercase leading-none mt-1', lang === l.code ? 'text-background' : 'text-muted-foreground')}>{l.code}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-center">
        <motion.div key={step} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25 }}>
          <Illustration step={step} t={t} lang={lang} />
          <h1 className="text-3xl font-extrabold tracking-tight mt-6 text-center">{slides[step].title}</h1>
          <p className="text-muted-foreground text-center mt-3 leading-relaxed">{slides[step].desc}</p>
        </motion.div>
      </div>

      <div className="pb-10 space-y-6">
        <div className="flex justify-center gap-2">
          {slides.map((_, i) => (
            <span key={i} className={cn('h-2 rounded-full transition-all', i === step ? 'w-6 bg-foreground' : 'w-2 bg-muted-foreground/30')} />
          ))}
        </div>
        <div className="flex items-center gap-3">
          {!last ? (
            <button onClick={onDone} className="px-5 py-3.5 text-muted-foreground font-medium">{t('skip')}</button>
          ) : null}
          <PrimaryButton onClick={() => (last ? onDone() : setStep(step + 1))}>{last ? t('lets_go') : t('next')}</PrimaryButton>
        </div>
      </div>
    </div>
  )
}

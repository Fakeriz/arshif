'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Apple, Share2, ScanLine, Mic, Smartphone, ChevronDown, FlaskConical, Link2, Download, Wifi } from 'lucide-react'
import { toast } from 'sonner'
import { useApp } from './context'
import { matchAlert } from '@/lib/smart-alerts'
import { consumeFeatureUsage } from '@/lib/feature-usage'
import { Sheet, Pill, Segmented, Field } from './ui'
import { cn } from '@/lib/utils'

function Steps({ items = [] }) {
  return (
    <ol className="space-y-2.5 mt-3">
      {items.map((s, i) => (
        <li key={i} className="flex gap-3 items-start">
          <span className="h-6 w-6 rounded-full bg-foreground text-background text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
          <span className="text-sm text-muted-foreground leading-relaxed pt-0.5">{s}</span>
        </li>
      ))}
    </ol>
  )
}

function Callout({ children, icon: Icon = Wifi }) {
  return (
    <div className="mt-4 rounded-xl bg-muted px-3.5 py-3 flex items-start gap-2.5 text-xs text-muted-foreground">
      <Icon size={14} className="mt-0.5 shrink-0" />
      <span className="leading-relaxed">{children}</span>
    </div>
  )
}

function ChannelCard({ id, icon: Icon, title, desc, expanded, onToggle, children }) {
  return (
    <div className="rounded-2xl bg-card border border-border/40 dark:border-white/5 overflow-hidden">
      <button type="button" onClick={onToggle} className="w-full flex items-center gap-3 p-4 text-left" data-testid={`channel-${id}`}>
        <div className="h-11 w-11 rounded-2xl bg-foreground text-background flex items-center justify-center shrink-0"><Icon size={20} /></div>
        <div className="flex-1 min-w-0">
          <p className="font-bold">{title}</p>
          <p className="text-xs text-muted-foreground truncate">{desc}</p>
        </div>
        <ChevronDown size={18} className={cn('text-muted-foreground transition-transform', expanded && 'rotate-180')} />
      </button>
      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }} className="overflow-hidden">
            <div className="px-4 pb-4 pt-1 border-t border-border/40">{children}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

// Instruksi Shortcut iOS untuk file yang di-download: langkah nyata yang bisa
// diikuti di aplikasi Shortcuts, bukan file biner .shortcut.
function buildShortcutText(t) {
  return [
    'Arshif - Setup Shortcut iOS',
    '==============================',
    '',
    'Ikuti langkah berikut di aplikasi Shortcuts (iOS):',
    '',
    '1. Buka aplikasi Shortcuts, tap + untuk shortcut baru.',
    '2. Tap nama shortcut, ganti jadi "Log to Arshif".',
    '3. Add Action > cari "Ask for Input" > Ask for Text.',
    '    Prompt: "Catat transaksi" (atau biarkan kosong).',
    '4. Add Action > cari "Share" > Share dengan teks dari langkah 3.',
    '    Pilih target share: Arshif.',
    '5. (Opsional) Add Action > "Show Result" supaya konfirmasi terlihat.',
    '6. Selesai. Jalankan shortcut dari Home Screen, Share Sheet,',
    '    Action Button, atau Back Tap (Settings > Accessibility > Touch).',
    '',
    t('share_autofill_desc'),
  ].join('\n')
}

export default function SmartAutomationSheet({ open, onClose }) {
  const { t, accounts = [], open: openSheet } = useApp()
  const [expanded, setExpanded] = useState('applepay')
  const [defaultAcc, setDefaultAcc] = useState('unassigned')
  const [iosVer, setIosVer] = useState('new')
  const [setupMode, setSetupMode] = useState('steps')
  const [askMode, setAskMode] = useState('shortcuts')
  const [connected, setConnected] = useState(true)
  const [testText, setTestText] = useState('')
  const [testResult, setTestResult] = useState(null)
  const [ran, setRan] = useState(false)

  const toggle = (id) => setExpanded((e) => (e === id ? null : id))

  const runTest = async () => {
    const parsed = matchAlert(testText)
    setTestResult(parsed)
    setRan(true)
    // Sinyal yang dikenali = satu eksekusi otomatis (free 30 / premium 500
    // per bulan). Uji sinyal yang gagal match tidak dihitung.
    if (parsed) {
      const usage = await consumeFeatureUsage('smart_automation_per_month')
      if (usage.allowed === false) {
        toast.error(usage.error || t('plan_limit_automation_reached'))
        openSheet?.('paywall')
      }
    }
  }

  const editTestText = (v) => {
    setTestText(v)
    if (ran) {
      setRan(false)
      setTestResult(null)
    }
  }

  const downloadShortcut = () => {
    const blob = new Blob([buildShortcutText(t)], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'arshif-shortcut-setup.txt'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <Sheet open={open} onClose={onClose} full noPadding title={t('smart_automation')}>
      <div className="px-5 pt-1 pb-3">
        <p className="text-sm text-muted-foreground">{t('automation_subtitle')}</p>
      </div>

      <div className="px-5 pb-10 space-y-4">
        {/* Default account */}
        <div className="rounded-2xl bg-card border border-border/40 dark:border-white/5 p-4">
          <p className="label-upper">{t('default_account')}</p>
          <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 mt-2">
            <Pill active={defaultAcc === 'unassigned'} onClick={() => setDefaultAcc('unassigned')}>{t('unassigned')}</Pill>
            {accounts.map((a) => <Pill key={a.id} active={defaultAcc === a.id} onClick={() => setDefaultAcc(a.id)}>{a.name}</Pill>)}
          </div>
          {defaultAcc === 'unassigned' ? <p className="text-xs text-muted-foreground mt-3 leading-relaxed">{t('unassigned_hint')}</p> : null}
        </div>

        {/* Status bar */}
        <div className="rounded-2xl bg-card border border-border/40 dark:border-white/5 p-3 flex items-center gap-2">
          <span className={cn('flex items-center gap-1.5 text-sm font-semibold', connected ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground')}>
            <span className={cn('h-2 w-2 rounded-full', connected ? 'bg-emerald-500' : 'bg-muted-foreground')} /> {connected ? t('connected') : t('disconnect')}
          </span>
          <div className="flex-1" />
          <button type="button" onClick={() => setConnected((c) => !c)} className="inline-flex items-center gap-1.5 rounded-xl border border-border/60 px-3 py-1.5 text-xs font-semibold"><Link2 size={13} /> {connected ? t('disconnect') : t('connected')}</button>
        </div>

        {/* Signal tester */}
        <div className="rounded-2xl bg-card border border-border/40 dark:border-white/5 p-4">
          <p className="label-upper">{t('test_signal', 'Test signal')}</p>
          <textarea
            value={testText}
            onChange={(e) => editTestText(e.target.value)}
            placeholder={t('test_signal_ph', 'Paste a bank notification here, e.g. RM50.00 DuitNow QR Pay to MCD 123 on 23/10/26')}
            rows={3}
            data-testid="signal-input"
            className="mt-2 w-full rounded-xl bg-background border border-border/60 px-3 py-2.5 text-base placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/20 resize-none"
          />
          <button
            type="button"
            onClick={runTest}
            disabled={testText.trim() === ''}
            data-testid="signal-run"
            className="mt-2 w-full rounded-xl bg-foreground text-background font-semibold py-2.5 text-sm flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <FlaskConical size={14} /> {t('test')}
          </button>
          {testResult ? (
            <div className="mt-3 rounded-xl bg-muted px-3.5 py-3 text-sm" data-testid="signal-result">
              <p className="font-bold">{testResult.type === 'income' ? '+' : '-'} {testResult.amount ?? '?'} {testResult.currency ?? ''}</p>
              <p className="text-muted-foreground">{testResult.merchant ? `${testResult.merchant} · ` : ''}{testResult.type} · {testResult.direction} · {t('rule', 'rule')} #{testResult.ruleId}</p>
            </div>
          ) : ran ? (
            <div className="mt-3 rounded-xl bg-muted px-3.5 py-3 text-sm" data-testid="signal-result">
              <p className="text-muted-foreground">{t('test_signal_nomatch', 'No rule matched this text. It will not be logged automatically.')}</p>
            </div>
          ) : testText.trim() !== '' ? (
            <p className="mt-3 text-xs text-muted-foreground">{t('test_signal_ready', 'Tap Test to parse this notification.')}</p>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">{t('test_signal_empty', 'No notification yet. Paste one above to see what the detector reads.')}</p>
          )}
        </div>

        {/* 1. Apple Pay */}
        <ChannelCard id="applepay" icon={Apple} title={t('apple_pay')} desc={t('apple_pay_desc')} expanded={expanded === 'applepay'} onToggle={() => toggle('applepay')}>
          <Field label={`iOS`} className="mt-3">
            <Segmented size="sm" value={iosVer} onChange={setIosVer} options={[{ id: 'new', label: t('ios_new') }, { id: 'old', label: t('ios_old') }]} />
          </Field>
          <Field label={t('setup_mode')} className="mt-3">
            <Segmented size="sm" value={setupMode} onChange={setSetupMode} options={[{ id: 'steps', label: t('step_by_step') }, { id: 'video', label: t('watch_video') }]} />
          </Field>
          {setupMode === 'steps' ? <Steps items={[t('ap_step1'), t('ap_step2'), t('ap_step3')]} /> : (
            <ol className="space-y-2.5 mt-3">
              {[
                t('ap_vid1', 'In Wallet, turn on card transaction notifications.'), t('ap_vid2', 'After each payment, copy the notification text.'), t('ap_vid3', 'Open the Arshif shortcut and paste, or use Share to Arshif.'), t('ap_vid4', 'The transaction is filled in automatically, then saved.'),
              ].map((s, i) => (
                <li key={i} className="flex gap-3 items-start">
                  <span className="h-6 w-6 rounded-full bg-foreground text-background text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                  <span className="text-sm text-muted-foreground leading-relaxed pt-0.5">{s}</span>
                </li>
              ))}
            </ol>
          )}
          <Callout icon={Apple}>{iosVer === 'new' ? 'iOS 27+ supports instant payment prompts natively.' : 'On iOS 26 or earlier, use the Shortcut automation instead.'}</Callout>
        </ChannelCard>

        {/* 2. Share to Arshif */}
        <ChannelCard id="share" icon={Share2} title={t('share_to_arshif')} desc={t('share_to_desc')} expanded={expanded === 'share'} onToggle={() => toggle('share')}>
          <Steps items={[t('share_step1'), t('share_step2'), t('share_step3')]} />
          <Callout icon={Share2}>Auto-account & category rules keep every share consistent.</Callout>
        </ChannelCard>

        {/* 3. Screenshot Scan */}
        <ChannelCard id="screenshot" icon={ScanLine} title={t('screenshot_scan')} desc={t('screenshot_scan_desc')} expanded={expanded === 'screenshot'} onToggle={() => toggle('screenshot')}>
          <button type="button" onClick={downloadShortcut} data-testid="shortcut-download" className="mt-3 w-full rounded-xl bg-foreground text-background font-semibold py-3 flex items-center justify-center gap-2"><Download size={16} /> {t('download_shortcut')}</button>
          <Field label={t('ask_mode')} className="mt-4">
            <Segmented size="sm" value={askMode} onChange={setAskMode} options={[{ id: 'shortcuts', label: t('in_shortcuts') }, { id: 'arshif', label: t('in_arshif') }]} />
          </Field>
        </ChannelCard>

        {/* 4. Say it */}
        <ChannelCard id="sayit" icon={Mic} title={t('say_it')} desc={t('say_it_desc')} expanded={expanded === 'sayit'} onToggle={() => toggle('sayit')}>
          <Steps items={[t('sy_step1'), t('sy_step2'), t('sy_step3'), t('sy_step4')]} />
          <Callout icon={Mic}>{t('siri_callout')}</Callout>
        </ChannelCard>

        {/* 5. Back Tap */}
        <ChannelCard id="backtap" icon={Smartphone} title={t('back_tap')} desc={t('back_tap_desc')} expanded={expanded === 'backtap'} onToggle={() => toggle('backtap')}>
          <Steps items={[t('bt_step1'), t('bt_step2'), t('bt_step3')]} />
          <Callout icon={Smartphone}>{t('automation_back_tap_callout')}</Callout>
        </ChannelCard>
      </div>
    </Sheet>
  )
}

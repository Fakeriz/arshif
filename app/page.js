'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { createStore, DEFAULT_PROFILE } from '@/lib/store'
import { translate, LOCALE_MAP } from '@/lib/i18n'
import { formatMoney } from '@/lib/currencies'
import { safeConvert, FALLBACK_RATES } from '@/lib/rates'
import { applyTransactionReplacement, applyTxToBalances, buildTransferWithFeeTransactions, computeBalanceDelta, fileToDataUrl, signedAccountBalance } from '@/lib/ledger'
import { initSyncListener } from '@/lib/sync'
import { AppContext } from '@/components/arshif/context'

import Onboarding from '@/components/arshif/Onboarding'
import Login from '@/components/arshif/Login'
import NewPasswordSheet from '@/components/arshif/NewPasswordSheet'
import BottomNav from '@/components/arshif/BottomNav'
import HomeTab from '@/components/arshif/HomeTab'
import TransactionsTab from '@/components/arshif/TransactionsTab'
import GoalsTab from '@/components/arshif/GoalsTab'
import MoreTab from '@/components/arshif/MoreTab'
import AddTransactionSheet from '@/components/arshif/AddTransactionSheet'
import QuickActionsSheet from '@/components/arshif/QuickActionsSheet'
import ProfileSheet from '@/components/arshif/ProfileSheet'
import NewAccountSheet from '@/components/arshif/NewAccountSheet'
import VoiceLogSheet from '@/components/arshif/VoiceLogSheet'
import ScanReceiptSheet from '@/components/arshif/ScanReceiptSheet'
import TransactionDetailSheet from '@/components/arshif/TransactionDetailSheet'
import CoachSheet from '@/components/arshif/CoachSheet'
import SplitBillSheet from '@/components/arshif/SplitBillSheet'
import AccountsSheet from '@/components/arshif/AccountsSheet'
import AnalyticsSheet from '@/components/arshif/AnalyticsSheet'
import CurrencySheet from '@/components/arshif/CurrencySheet'
import NotificationsSheet from '@/components/arshif/NotificationsSheet'
import NotificationSettingsSheet from '@/components/arshif/NotificationSettingsSheet'
import SmartAutomationSheet from '@/components/arshif/SmartAutomationSheet'
import BillsTrackerSheet from '@/components/arshif/BillsTrackerSheet'
import LoanCalculatorSheet from '@/components/arshif/LoanCalculatorSheet'
import CategoriesTemplatesSheet from '@/components/arshif/CategoriesTemplatesSheet'
import DebtTrackerSheet from '@/components/arshif/DebtTrackerSheet'
import ExportTransactionsSheet from '@/components/arshif/ExportTransactionsSheet'
import ImportTransactionsPage from '@/components/arshif/ImportTransactionsPage'
import AiPremiumSheet from '@/components/arshif/AiPremiumSheet'
import PaywallSheet from '@/components/arshif/PaywallSheet'
import CloudReceiptBackupSheet from '@/components/arshif/CloudReceiptBackupSheet'
import ReceiptGallerySheet from '@/components/arshif/ReceiptGallerySheet'
import MonthStartSheet from '@/components/arshif/MonthStartSheet'
import AccountBackupSheet from '@/components/arshif/AccountBackupSheet'
import TutorialSheet from '@/components/arshif/TutorialSheet'
import HelpLegalSheet from '@/components/arshif/HelpLegalSheet'
import TaxReportSheet from '@/components/arshif/TaxReportSheet'

const GUEST_KEY = 'arshif_guest_mode'
const ONBOARD_KEY = 'arshif_onboarded'
const LANG_KEY = 'arshif_lang'

export default function App() {
  const [booting, setBooting] = useState(true)
  const [session, setSession] = useState(null)
  const [isGuest, setIsGuest] = useState(false)
  const [onboarded, setOnboarded] = useState(true)
  const [lang, setLangState] = useState('en')
  const [recovery, setRecovery] = useState(false)

  const [profile, setProfile] = useState({ ...DEFAULT_PROFILE })
  const [accounts, setAccounts] = useState([])
  const [transactions, setTransactions] = useState([])
  const [goals, setGoals] = useState([])
  const [bills, setBills] = useState([])
  const [budgets, setBudgets] = useState([])
  const [rates, setRates] = useState(FALLBACK_RATES)

  const [tab, setTab] = useState('home')
  const [sheets, setSheets] = useState({})
  const [hideBalance, setHideBalance] = useState(false)

  const store = useMemo(() => createStore(session), [session])
  const home = profile?.home_currency || 'USD'

  const t = useCallback((key, vars, fallback) => translate(lang, key, vars, fallback), [lang])
  const fmt = useCallback((amount, code) => formatMoney(amount, code, { locale: LOCALE_MAP[lang] || 'en-US' }), [lang])
  const convertToHome = useCallback((amount, code) => safeConvert(amount, code, home, rates) ?? 0, [home, rates])

  useEffect(() => {
    try {
      setIsGuest(localStorage.getItem(GUEST_KEY) === '1')
      setOnboarded(localStorage.getItem(ONBOARD_KEY) === '1')
      const savedLang = localStorage.getItem(LANG_KEY)
      if (savedLang) setLangState(savedLang)
    } catch {}

    let active = true
    // Safety: never stay stuck on the splash even if auth is slow/unreachable.
    const failsafe = setTimeout(() => { if (active) setBooting(false) }, 2500)
    supabase.auth.getSession()
      .then(({ data }) => { if (active) setSession(data?.session || null) })
      .catch(() => {})
      .finally(() => { if (active) setBooting(false) })
    const { data: listener } = supabase.auth.onAuthStateChange((_e, next) => {
      // Password recovery link opened — show the "Set new password" screen instead of Home.
      if (_e === 'PASSWORD_RECOVERY') { setRecovery(true); setSession(next || null); return }
      setSession(next || null)
      if (next?.user) { setIsGuest(false); try { localStorage.removeItem(GUEST_KEY) } catch {} }
    })
    return () => { active = false; clearTimeout(failsafe); listener?.subscription?.unsubscribe?.() }
  }, [])

  useEffect(() => {
    fetch('/api/rates').then((r) => r.json()).then((d) => { if (d?.rates) setRates(d.rates) }).catch(() => {})
  }, [])

  const authed = !!session?.user || isGuest

  useEffect(() => {
    const uid = session?.user?.id
    if (!uid) return
    try {
      const raw = localStorage.getItem(`arshif_state_cache_${uid}`)
      if (raw) {
        const cached = JSON.parse(raw)
        if (cached?.profile) setProfile((p) => ({ ...p, ...cached.profile }))
        if (Array.isArray(cached?.accounts) && cached.accounts.length) setAccounts(cached.accounts)
        if (Array.isArray(cached?.transactions) && cached.transactions.length) setTransactions(cached.transactions)
        if (Array.isArray(cached?.goals) && cached.goals.length) setGoals(cached.goals)
        if (Array.isArray(cached?.bills) && cached.bills.length) setBills(cached.bills)
        if (Array.isArray(cached?.budgets) && cached.budgets.length) setBudgets(cached.budgets)
      }
    } catch {}
  }, [session?.user?.id])

  const refresh = useCallback(async () => {
    if (!authed) return
    try {
      const [p, a, tx, g, b, bg] = await Promise.all([
        store.getProfile(),
        store.listAccounts(),
        store.listTransactions(),
        store.listGoals(),
        store.listBills ? store.listBills() : Promise.resolve([]),
        store.listBudgets ? store.listBudgets() : Promise.resolve([]),
      ])
      const nextProfile = { ...DEFAULT_PROFILE, ...(p || {}) }
      const nextAccounts = Array.isArray(a) ? a : []
      const nextTransactions = Array.isArray(tx) ? tx : []
      const nextGoals = Array.isArray(g) ? g : []
      const nextBills = Array.isArray(b) ? b : []
      const nextBudgets = Array.isArray(bg) ? bg : []

      setProfile(nextProfile)
      setAccounts(nextAccounts)
      setTransactions(nextTransactions)
      setGoals(nextGoals)
      setBills(nextBills)
      setBudgets(nextBudgets)

      const uid = session?.user?.id
      if (uid) {
        try {
          localStorage.setItem(`arshif_state_cache_${uid}`, JSON.stringify({
            profile: nextProfile,
            accounts: nextAccounts,
            transactions: nextTransactions,
            goals: nextGoals,
            bills: nextBills,
            budgets: nextBudgets,
          }))
        } catch {}
      }

      const savedLang = (() => { try { return localStorage.getItem(LANG_KEY) } catch { return null } })()
      if (!savedLang && p?.language) setLangState(p.language)
    } catch (e) {
      console.warn('refresh failed', e?.message)
    }
  }, [authed, store, session?.user?.id])

  useEffect(() => { if (authed) refresh() }, [authed, refresh])

  useEffect(() => {
    if (!authed) return
    const cleanup = initSyncListener(supabase, () => {
      refresh()
    })
    return cleanup
  }, [authed, refresh])

  const setLang = useCallback((l) => {
    setLangState(l)
    try { localStorage.setItem(LANG_KEY, l) } catch {}
  }, [])

  const updateProfile = useCallback(async (patch) => {
    const saved = await store.saveProfile(patch)
    setProfile((p) => ({ ...p, ...(saved || {}) }))
    return saved
  }, [store])

  const userTier = (!session || isGuest) ? 'free' : (profile?.plan_tier || 'free')
  const isAiAllowed = userTier === 'premium' || userTier === 'admin'

  const open = useCallback((name, payload = true) => {
    if ((name === 'scan' || name === 'voice' || name === 'coach') && !isAiAllowed) {
      setSheets((s) => ({ ...s, aiPremium: true }))
      return
    }
    setSheets((s) => ({ ...s, [name]: payload }))
  }, [isAiAllowed])
  const close = useCallback((name) => setSheets((s) => ({ ...s, [name]: null })), [])

  // Deep link dari PWA app shortcuts (?shortcut=add-expense / scan-receipt).
  // Shortcut selalu buka URL baru; efek ini menerjemahkannya jadi sheet yang tepat.
  const shortcutHandled = useRef(false)
  useEffect(() => {
    if (!authed || shortcutHandled.current) return
    shortcutHandled.current = true
    let q = null
    try { q = new URLSearchParams(window.location.search).get('shortcut') } catch {}
    if (!q) return
    const t = setTimeout(() => {
      if (q === 'add-expense') open('addTx')
      else if (q === 'scan-receipt') open('scan')
      try {
        const url = new URL(window.location.href)
        url.searchParams.delete('shortcut')
        window.history.replaceState(null, '', url.pathname + url.search + url.hash)
      } catch {}
    }, 400)
    return () => clearTimeout(t)
  }, [authed, open])

  // Shared receipt image comes from Cache Storage, with a sessionStorage fallback.
  useEffect(() => {
    if (!authed) return
    let want = false
    try { want = new URLSearchParams(window.location.search).get('sharedReceipt') === '1' } catch {}
    if (!want) return
    try {
      const url = new URL(window.location.href)
      url.searchParams.delete('sharedReceipt')
      window.history.replaceState(null, '', url.pathname + url.search + url.hash)
    } catch {}
    let cancelled = false
    let toastId = null
    try { toastId = toast.loading('Menerima gambar struk…') } catch {}
    const readSharedImage = async () => {
      try {
        if ('caches' in window) {
          const cache = await caches.open('arshif-share-v1')
          const res = await cache.match('/__arshif_shared_receipt__')
          if (res) {
            const blob = await res.blob()
            await cache.delete('/__arshif_shared_receipt__')
            if (blob && blob.size > 0) {
              // samakan dengan pipeline upload manual: downscale max 1600px
              const file = new File([blob], 'shared-receipt.jpg', { type: blob.type || 'image/jpeg' })
              return await fileToDataUrl(file, 1600)
            }
          }
        }
      } catch {}
      try {
        const v = sessionStorage.getItem('arshif_shared_receipt')
        sessionStorage.removeItem('arshif_shared_receipt')
        return v || null
      } catch {}
      return null
    }
    const t = setTimeout(async () => {
      const dataUrl = await readSharedImage()
      if (cancelled) return
      try { if (toastId) toast.dismiss(toastId) } catch {}
      // open('scan', { image }) -> ScanReceiptSheet menerima initialImage.
      // Kalau gambar tidak ketemu (Chrome tidak melampirkan file),
      // buka sheet dengan autoPick agar user bisa pilih foto manual.
      if (dataUrl) open('scan', { image: dataUrl })
      else {
        try { toast.info('Gambar tidak terbawa — pilih foto struk ya') } catch {}
        open('scan', { autoPick: true })
      }
    }, 400)
    return () => {
      cancelled = true
      clearTimeout(t)
      try { if (toastId) toast.dismiss(toastId) } catch {}
    }
  }, [authed, open])

  const signOut = useCallback(async () => {
    try { await supabase.auth.signOut() } catch {}
    try { localStorage.removeItem(GUEST_KEY) } catch {}
    setIsGuest(false); setSession(null)
    setProfile({ ...DEFAULT_PROFILE }); setAccounts([]); setTransactions([]); setGoals([]); setBills([]); setBudgets([])
    setTab('home'); setSheets({})
  }, [])

  const enterGuest = () => { try { localStorage.setItem(GUEST_KEY, '1') } catch {}; setIsGuest(true) }
  const finishOnboarding = () => { try { localStorage.setItem(ONBOARD_KEY, '1') } catch {}; setOnboarded(true) }

  // High-performance optimistic transaction mutations
  const saveTransaction = useCallback(async (txData, editId) => {
    const prevTxList = transactions
    const prevAccList = accounts

    // Optimistic update dulu, revert bila persist gagal
    let nextAccounts = accounts
    if (editId) {
      const old = transactions.find((x) => x.id === editId)
      if (old) {
        nextAccounts = computeBalanceDelta(nextAccounts, old, -1, rates)
      }
    }
    nextAccounts = computeBalanceDelta(nextAccounts, txData, 1, rates)
    setAccounts(nextAccounts)

    const tempId = editId || txData.id || `tx_${Date.now()}`
    const optimisticTx = { ...txData, id: tempId, created_at: txData.created_at || new Date().toISOString() }

    if (editId) {
      setTransactions((prev) => prev.map((t) => (t.id === editId ? { ...t, ...optimisticTx } : t)))
    } else {
      setTransactions((prev) => [optimisticTx, ...prev])
    }

    try {
      let saved
      if (editId) {
        const old = prevTxList.find((x) => x.id === editId)
        // Update the transaction only after the balance replacement succeeds.
        // If the transaction write fails, the helper already restored balances.
        const replacedAccounts = await applyTransactionReplacement(store, prevAccList, { oldTx: old, newTx: txData, rates })
        try {
          saved = await store.updateTransaction(editId, txData)
        } catch (transactionError) {
          try {
            await applyTransactionReplacement(store, replacedAccounts, { oldTx: txData, newTx: old, rates })
          } catch {}
          try { await store.updateTransaction(editId, old) } catch {}
          throw transactionError
        }
      } else {
        // Persist first, then update balances; a failed balance write removes the transaction.
        // Transfer fees are split into a separate expense so they stay visible in the ledger.
        const [transferTx, feeTx] = buildTransferWithFeeTransactions(txData)
        saved = await store.createTransaction(transferTx)
        try {
          await applyTxToBalances(store, prevAccList, transferTx, 1, rates)
        } catch (balanceError) {
          if (saved?.id) {
            try { await store.deleteTransaction(saved.id) } catch {}
          }
          throw balanceError
        }
        if (feeTx) {
          try {
            await store.createTransaction(feeTx)
            await applyTxToBalances(store, prevAccList, feeTx, 1, rates)
          } catch (feeError) {
            console.warn('Transfer fee transaction failed:', feeError?.message || feeError)
          }
        }
        // If created has real ID, swap it in transactions
        if (saved?.id && saved.id !== tempId) {
          setTransactions((prev) => prev.map((t) => (t.id === tempId ? { ...t, id: saved.id } : t)))
        }
      }

      refresh()
      return saved
    } catch (err) {
      console.error('saveTransaction error, reverting:', err)
      setTransactions(prevTxList)
      setAccounts(prevAccList)
      throw err
    }
  }, [transactions, accounts, rates, store, refresh])

  const deleteTransaction = useCallback(async (tx) => {
    if (!tx?.id) return
    const txId = tx.id
    const prevTxList = transactions
    const prevAccList = accounts

    // Optimistic update dulu, revert bila persist gagal
    setTransactions((prev) => prev.filter((item) => item.id !== txId))
    const deltaAccounts = computeBalanceDelta(accounts, tx, -1, rates)
    if (deltaAccounts) {
      setAccounts(deltaAccounts)
    }

    try {
      // Work on a defensive snapshot. applyTxToBalances never mutates the
      // caller-owned array, so React rollback remains a true pre-delete state.
      const persistedAccounts = prevAccList.map((account) => ({ ...account }))
      await applyTxToBalances(store, persistedAccounts, tx, -1, rates)
      try {
        await store.deleteTransaction(txId)
      } catch (deleteError) {
        try { await applyTxToBalances(store, prevAccList.map((account) => ({ ...account })), tx, 1, rates) } catch {}
        throw deleteError
      }
      refresh()
      return true
    } catch (err) {
      console.error('deleteTransaction error, reverting:', err)
      setTransactions(prevTxList)
      setAccounts(prevAccList)
      throw err
    }
  }, [transactions, accounts, rates, store, refresh])

  // Stats bulan berjalan untuk Home
  const stats = useMemo(() => {
    const totalBalance = accounts.reduce((s, a) => s + (safeConvert(signedAccountBalance(a), a.currency, home, rates) ?? 0), 0)
    const now = new Date()
    const inMonth = transactions.filter((tx) => { const d = new Date(tx.date || tx.transaction_date); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() })
    const income = inMonth.filter((tx) => tx.type === 'income').reduce((s, tx) => s + (safeConvert(tx.amount, tx.currency, home, rates) ?? 0), 0)
    const spending = inMonth.filter((tx) => tx.type === 'expense').reduce((s, tx) => s + (safeConvert(tx.amount, tx.currency, home, rates) ?? 0), 0)
    return { totalBalance, income, spending }
  }, [accounts, transactions, home, rates])

  const editTx = useCallback((tx) => {
    close('txDetail')
    setTimeout(() => open('addTx', { ...tx, editId: tx.id }), 150)
  }, [close, open])

  const handleQuickAction = useCallback((action) => {
    close('quickActions')
    close('quick')
    setTimeout(() => {
      if (action === 'addTx') {
        open('addTx')
      } else if (action === 'scanReceipt') {
        if (!isAiAllowed) {
          open('aiPremium')
        } else {
          open('scan')
        }
      } else if (action === 'savings') {
        setTab('goals')
      } else if (action === 'voiceLog') {
        if (!isAiAllowed) {
          open('aiPremium')
        } else {
          open('voice')
        }
      }
    }, 120)
  }, [close, open, isAiAllowed, setTab])

  const ctx = {
    t, lang, setLang, fmt, home, rates, convertToHome,
    session, user: session?.user || null, isGuest, profile, updateProfile, signOut,
    userTier, isAiAllowed,
    accounts, transactions, goals, bills, budgets, stats, store, refresh,
    addTransaction: saveTransaction, saveTransaction, deleteTransaction,
    tab, setTab, sheets, open, close,
    hideBalance, setHideBalance,
    editTx, handleQuickAction,
  }

  if (booting) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background">
        <div className="h-14 w-14 rounded-2xl bg-foreground text-background flex items-center justify-center text-2xl font-extrabold animate-pulse">P</div>
      </div>
    )
  }

  if (recovery) {
    return (
      <AppContext.Provider value={ctx}>
        <NewPasswordSheet onDone={() => setRecovery(false)} />
      </AppContext.Provider>
    )
  }

  if (!authed) {
    return (
      <AppContext.Provider value={ctx}>
        {!onboarded ? <Onboarding onDone={finishOnboarding} /> : <Login onGuest={enterGuest} />}
      </AppContext.Provider>
    )
  }

  return (
    <AppContext.Provider value={ctx}>
      <main className="min-h-dvh bg-background max-w-md mx-auto relative safe-top">
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
          {tab === 'home' ? <HomeTab /> : null}
          {tab === 'transactions' ? <TransactionsTab /> : null}
          {tab === 'goals' ? <GoalsTab /> : null}
          {tab === 'more' ? <MoreTab /> : null}
        </motion.div>

        <BottomNav tab={tab} onTab={setTab} onPlus={() => open('quickActions')} />

        {/* Sheets */}
        <QuickActionsSheet
          open={Boolean(sheets?.quickActions || sheets?.quick)}
          onClose={() => {
            close('quickActions')
            close('quick')
          }}
          onSelectAction={handleQuickAction}
        />
        <AddTransactionSheet open={!!sheets.addTx} onClose={() => close('addTx')} initial={sheets.addTx && typeof sheets.addTx === 'object' ? sheets.addTx : {}} />
        <ProfileSheet open={!!sheets.profile} onClose={() => close('profile')} />
        <NewAccountSheet open={!!sheets.newAccount} onClose={() => close('newAccount')} />
        <VoiceLogSheet open={!!sheets.voice} onClose={() => close('voice')} onResult={(data) => { close('voice'); setTimeout(() => open('addTx', data), 150) }} />
        <ScanReceiptSheet open={Boolean(sheets?.scan || sheets?.scanReceipt)} initialImage={sheets?.scan && typeof sheets.scan === 'object' ? sheets.scan.image || null : null} autoPick={sheets?.scan && typeof sheets.scan === 'object' ? Boolean(sheets.scan.autoPick) : false} onClose={() => { close('scan'); close('scanReceipt') }} onUse={(data) => { close('scan'); close('scanReceipt'); setTimeout(() => open('addTx', data), 150) }} />
        <TransactionDetailSheet open={!!sheets.txDetail} onClose={() => close('txDetail')} tx={sheets.txDetail && typeof sheets.txDetail === 'object' ? sheets.txDetail : null} onEdit={editTx} />
        <CoachSheet open={!!sheets.coach} onClose={() => close('coach')} />
        <SplitBillSheet open={!!sheets.split} onClose={() => close('split')} />
        <AccountsSheet open={!!sheets.accounts} onClose={() => close('accounts')} />
        <AnalyticsSheet open={!!sheets.analytics} onClose={() => close('analytics')} />
        <NotificationsSheet open={!!sheets.notifications} onClose={() => close('notifications')} />
        <SmartAutomationSheet open={!!sheets.automation} onClose={() => close('automation')} />
        <BillsTrackerSheet open={!!sheets.bills} onClose={() => close('bills')} />
        <LoanCalculatorSheet open={!!sheets.loan} onClose={() => close('loan')} />
        <CategoriesTemplatesSheet open={!!sheets.catman} onClose={() => close('catman')} />
        <DebtTrackerSheet open={!!sheets.debts} onClose={() => close('debts')} />
        <ExportTransactionsSheet open={!!sheets.exportTx} onClose={() => close('exportTx')} />
        {sheets.importTx ? <ImportTransactionsPage onClose={() => close('importTx')} /> : null}
        <ReceiptGallerySheet
          open={Boolean(sheets?.receiptGallery)}
          onClose={() => close('receiptGallery')}
          onOpenScanner={() => {
            close('receiptGallery')
            setTimeout(() => {
              if (!isAiAllowed) {
                open('aiPremium')
              } else {
                open('scan')
              }
            }, 120)
          }}
        />
        <CurrencySheet
          open={!!sheets.currency}
          onClose={() => close('currency')}
          value={home}
          title={t('home_currency')}
          onSelect={(code) => updateProfile({ home_currency: code })}
        />
        <AiPremiumSheet
          open={!!sheets.aiPremium}
          onClose={() => close('aiPremium')}
          onUpgrade={() => {
            close('aiPremium')
            open('paywall')
          }}
        />
        <PaywallSheet open={!!sheets.paywall} onClose={() => close('paywall')} />
        <CloudReceiptBackupSheet open={!!sheets.cloudBackup} onClose={() => close('cloudBackup')} />
        <NotificationSettingsSheet open={Boolean(sheets?.notifSettings || sheets?.notificationSettings)} onClose={() => { close('notifSettings'); close('notificationSettings') }} />
        <MonthStartSheet open={!!sheets.monthStart} onClose={() => close('monthStart')} />
        <AccountBackupSheet open={!!sheets.backup} onClose={() => close('backup')} />
        <TutorialSheet open={!!sheets.tutorial} onClose={() => close('tutorial')} />
        <HelpLegalSheet open={!!sheets.help} onClose={() => close('help')} />
        <TaxReportSheet open={!!sheets.taxReport} onClose={() => close('taxReport')} />
      </main>
    </AppContext.Provider>
  )
}

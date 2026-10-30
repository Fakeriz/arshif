import { convert } from './rates'
import { CATEGORIES } from './categories'

/**
 * Derives smart notifications from bills, budgets, goals, and transactions.
 *
 * @param {Array} bills - Active bills checklist
 * @param {Array} budgets - Active budgets list
 * @param {Array} goals - Active goals list (may contain type='budget')
 * @param {Array} transactions - List of transactions
 * @param {string} home - Home currency code (e.g. 'IDR', 'USD')
 * @param {Object} rates - Exchange rates
 * @param {Function} fmt - Currency formatting function
 * @param {Function} t - Translation function
 * @returns {{ notifications: Array, hasUrgent: boolean, urgentCount: number }}
 */
export function deriveNotifications({
  bills = [],
  budgets = [],
  goals = [],
  transactions = [],
  home = 'USD',
  rates = {},
  fmt = (amt, code) => `${code || home} ${amt}`,
  t = (k) => k,
}) {
  const notifications = []
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth()
  const currentDay = now.getDate()
  const currentMonthKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`

  // Warn about unpaid bills approaching or past their due date.
  ;(bills || []).forEach((b) => {
    if (!b) return
    // Periksa apakah sudah dibayar pada bulan berjalan
    const isPaidThisMonth = Boolean(b?.paid_months?.[currentMonthKey])
    if (isPaidThisMonth) return

    const dueDay = Number(b?.due_day) || 1
    // Munculkan peringatan jika hari ini >= (due_day - 3)
    if (currentDay >= (dueDay - 3)) {
      const isOverdue = currentDay > dueDay
      const title = isOverdue ? 'Tagihan Terlewat' : 'Tagihan Jatuh Tempo'
      const formattedAmount = fmt(b?.amount || 0, b?.currency || home)
      const desc = `${b?.title || 'Tagihan'} sebesar ${formattedAmount} jatuh tempo tanggal ${dueDay}.`

      notifications.push({
        id: `bill-${b.id || dueDay}-${currentMonthKey}`,
        type: 'bill',
        isUrgent: true,
        isOverdue,
        dueDay,
        iconType: isOverdue ? 'clock' : 'calendar',
        title,
        description: desc,
        action: 'bills',
        meta: b,
      })
    }
  })

  // Warn when category spending approaches its budget limit.
  // Gabungkan budgets dari store.listBudgets() dan goals dengan type='budget'
  const allBudgets = [...(budgets || [])]
  ;(goals || []).forEach((g) => {
    if (g?.type === 'budget' && !allBudgets.some((b) => b?.id === g?.id)) {
      allBudgets.push({
        id: g.id,
        category: g.category || g.name,
        limit_amount: g.target_amount,
        currency: g.currency,
      })
    }
  })

  allBudgets.forEach((bg) => {
    if (!bg) return
    const catId = bg?.category
    const limit = Number(bg?.limit_amount || bg?.target_amount) || 0
    if (limit <= 0 || !catId) return

    // Hitung pengeluaran kategori tersebut pada bulan berjalan
    const spent = (transactions || [])
      .filter((tx) => {
        if (!tx || tx?.type !== 'expense') return false
        if (tx?.category !== catId) return false
        const txDateStr = tx?.date || tx?.transaction_date || ''
        return txDateStr.slice(0, 7) === currentMonthKey
      })
      .reduce((sum, tx) => {
        const rawAmt = Number(tx?.amount) || 0
        const converted = convert ? convert(rawAmt, tx?.currency || home, home, rates) : rawAmt
        return sum + (typeof converted === 'number' && !isNaN(converted) ? converted : rawAmt)
      }, 0)

    const pct = Math.round((spent / limit) * 100)

    // Jika pengeluaran >= 85% dari limit:
    if (pct >= 85) {
      const catObj = CATEGORIES.find((c) => c.id === catId)
      const catName = t(`cat_${catId}`) || catObj?.name || catId
      const isExceeded = pct >= 100
      const title = isExceeded ? 'Pagu Anggaran Terlampaui' : 'Peringatan Batas Anggaran'
      const desc = `Pagu anggaran ${catName} telah terpakai ${pct}%.`

      notifications.push({
        id: `budget-${bg.id || catId}-${currentMonthKey}`,
        type: 'budget',
        isUrgent: true,
        pct,
        isExceeded,
        iconType: 'alert-triangle',
        title,
        description: desc,
        action: 'goals',
        meta: bg,
      })
    }
  })

  notifications.sort((a, b) => {
    if (a.isOverdue && !b.isOverdue) return -1
    if (!a.isOverdue && b.isOverdue) return 1
    if (a.isExceeded && !b.isExceeded) return -1
    if (!a.isExceeded && b.isExceeded) return 1
    return 0
  })

  const urgentCount = notifications.filter((n) => n.isUrgent).length
  const hasUrgent = urgentCount > 0

  // Tidak ada yang darurat -> satu pesan selamat datang statis
  if (!hasUrgent) {
    notifications.push({
      id: 'static-welcome',
      type: 'welcome',
      isUrgent: false,
      iconType: 'sparkles',
      title: 'Arshif',
      description: 'Selamat datang di Arshif — Seluruh akun dan tagihan Anda terpantau rapi.',
      action: null,
    })
  }

  return {
    notifications,
    hasUrgent,
    urgentCount,
  }
}

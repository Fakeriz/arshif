import { convert, safeConvert } from './rates'
import { roundMoney } from './currencies'

// A transfer with a fee is persisted as the transfer itself plus a separate
// expense transaction for the fee, so the charge is visible in the ledger and
// analytics instead of silently vanishing between two account balances.
export function buildTransferWithFeeTransactions(tx) {
  const fee = roundMoney(Number(tx?.fee) || 0, tx?.currency)
  if (!fee) return [tx]
  const baseAmount = Number(tx?.amount) || 1
  const feeTx = {
    ...tx,
    id: tx.fee_id || (tx.id ? `${tx.id}_fee` : null),
    type: 'expense',
    category: 'transfer',
    amount: fee,
    to_account_id: null,
    fee: 0,
    note: `${tx.note || tx.description || 'Transfer'} fee`,
    home_currency_amount: tx.home_currency_amount != null
      ? roundMoney((Number(tx.home_currency_amount) / baseAmount) * fee, tx.home_currency || tx.currency)
      : null,
  }
  return [{ ...tx, fee: 0 }, feeTx]
}

// Synchronously compute the updated accounts array with new balances
export function isLiabilityAccount(account) {
  return ['card', 'credit', 'credit_card', 'creditcard', 'loan', 'debt'].includes(String(account?.type || '').toLowerCase())
}

export function signedAccountBalance(account) {
  const balance = Number(account?.balance) || 0
  return isLiabilityAccount(account) ? -Math.abs(balance) : balance
}

function accountDelta(acc, tx, sign, rates) {
  const amount = tx.type === 'transfer' && acc.id === tx.account_id
    ? (Number(tx.amount) || 0) + (Number(tx.fee) || 0)
    : Number(tx.amount) || 0
  // safeConvert: kalau kurs untuk mata uang tx tidak diketahui, kembalikan null
  // dan pakai amount apa adanya — satu transaksi dengan mata uang tak dikenal
  // tidak boleh menggagalkan seluruh perhitungan saldo (fail-safe, bukan fail-hard).
  const converted = safeConvert(amount, tx.currency, acc.currency, rates) ?? amount
  const liability = isLiabilityAccount(acc)

  if (tx.type === 'expense' && acc.id === tx.account_id) return sign * (liability ? converted : -converted)
  if (tx.type === 'income' && acc.id === tx.account_id) return sign * (liability ? -converted : converted)
  if (tx.type === 'transfer' && acc.id === tx.account_id) return sign * (liability ? converted : -converted)
  if (tx.type === 'transfer' && acc.id === tx.to_account_id) return sign * (liability ? -converted : converted)
  return 0
}

export function computeBalanceDelta(accounts = [], tx, sign = 1, rates) {
  if (!Array.isArray(accounts) || !tx) return accounts
  return accounts.map((acc) => {
    const delta = accountDelta(acc, tx, sign, rates)
    return delta === 0 ? acc : { ...acc, balance: roundMoney((Number(acc.balance) || 0) + delta, acc.currency) }
  })
}

// Apply (sign=+1) or revert (sign=-1) a transaction's effect on account balances.
export async function applyTxToBalances(store, accounts = [], tx, sign = 1, rates) {
  if (!store || !tx) return Array.isArray(accounts) ? accounts.map((a) => ({ ...a })) : []
  const working = (accounts || []).map((account) => ({ ...account }))
  const find = (id) => working.find((a) => a?.id === id)
  const updated = []
  try {
    const targets = tx.type === 'transfer'
      ? [find(tx.account_id), find(tx.to_account_id)]
      : [find(tx.account_id)]
    for (const account of targets) {
      if (!account) continue
      const previous = Number(account.balance) || 0
      const next = roundMoney(previous + accountDelta(account, tx, sign, rates), account.currency)
      if (next === previous) continue
      await store.updateAccount(account.id, { balance: next })
      account.balance = next
      updated.push({ account, previous })
    }
  } catch (error) {
    for (const { account, previous } of updated.reverse()) {
      try {
        await store.updateAccount(account.id, { balance: previous })
        account.balance = previous
      } catch {}
    }
    throw error
  }
  return working
}

// Replace an existing transaction's persisted balance effect atomically in order.
// The caller supplies the account snapshot currently stored in the database.
export async function applyTransactionReplacement(store, accounts = [], { oldTx, newTx, rates } = {}) {
  const persistedAccounts = (accounts || []).map((account) => ({ ...account }))
  let oldReverted = false
  let newApplied = false
  try {
    if (oldTx) {
      const reverted = await applyTxToBalances(store, persistedAccounts, oldTx, -1, rates)
      persistedAccounts.splice(0, persistedAccounts.length, ...reverted)
      oldReverted = true
    }
    if (newTx) {
      const applied = await applyTxToBalances(store, persistedAccounts, newTx, 1, rates)
      persistedAccounts.splice(0, persistedAccounts.length, ...applied)
      newApplied = true
    }
    return persistedAccounts
  } catch (error) {
    // Restore the original persisted balance before surfacing the failure.
    try {
      if (newApplied && newTx) await applyTxToBalances(store, persistedAccounts, newTx, -1, rates)
      if (oldReverted && oldTx) await applyTxToBalances(store, persistedAccounts, oldTx, 1, rates)
    } catch {}
    throw error
  }
}

// Safe arithmetic evaluator for the calculator keypad: supports + - * / and decimals
export function evaluateExpression(expr) {
  const s = String(expr || '').replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/,/g, '.').replace(/\s/g, '')
  if (!s) return 0
  const tokens = s.match(/(\d+\.?\d*|\.\d+|[+\-*/])/g) || []
  const out = []
  const ops = []
  const prec = { '+': 1, '-': 1, '*': 2, '/': 2 }
  let prevWasOp = true
  for (const tk of tokens) {
    if (/[+\-*/]/.test(tk)) {
      if (prevWasOp) { if (tk === '-') { out.push(0) } else continue }
      while (ops.length && prec[ops[ops.length - 1]] >= prec[tk]) out.push(ops.pop())
      ops.push(tk)
      prevWasOp = true
    } else {
      out.push(parseFloat(tk))
      prevWasOp = false
    }
  }
  while (ops.length) out.push(ops.pop())
  const st = []
  for (const tk of out) {
    if (typeof tk === 'number') st.push(tk)
    else {
      const b = st.pop() ?? 0
      const a = st.pop() ?? 0
      st.push(tk === '+' ? a + b : tk === '-' ? a - b : tk === '*' ? a * b : b === 0 ? 0 : a / b)
    }
  }
  const r = st.pop() ?? 0
  return Number.isFinite(r) ? r : 0
}

export function toLocalDatetimeValue(d) {
  const pad = (n) => String(n).padStart(2, '0')
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const now = new Date()
    return `${d}T${pad(now.getHours())}:${pad(now.getMinutes())}`
  }
  const x = d ? new Date(d) : new Date()
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}T${pad(x.getHours())}:${pad(x.getMinutes())}`
}

// Downscale an image file to a data URL (keeps receipt previews small)
export function fileToDataUrl(file, maxSize = 1000) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve(null)
    if (!file.type?.startsWith('image/')) {
      const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(file); return
    }
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale)
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(url)
      resolve(c.toDataURL('image/jpeg', 0.82))
    }
    img.onerror = reject
    img.src = url
  })
}

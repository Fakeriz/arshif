import { convert, safeConvert } from './rates'
import { roundMoney } from './currencies'

// A transfer with a fee is persisted as the transfer itself plus a separate
// expense transaction, so the charge stays visible in the ledger and analytics.
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
  // safeConvert: kurs tak dikenal -> null, pakai amount apa adanya - satu mata
  // uang asing tidak boleh menggagalkan seluruh perhitungan saldo (fail-safe).
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
// Primary path: the Supabase RPC apply_transaction_balance_delta, one atomic
// statement for all accounts, idempotent per (tx_id, sign), closing the
// read-modify-write race across devices. Falls back to per-account
// store.updateAccount when the RPC is missing (404/PGRST202), the network is
// down, or the store is guest/localStorage.
const BALANCE_RPC_NAME = 'apply_transaction_balance_delta'

// Klien RPC bisa di-inject (dipakai test & lingkungan tanpa Supabase).
let balanceRpcClient = null
export function setBalanceRpcClient(client) {
  balanceRpcClient = client || null
}

async function loadSupabaseRpcClient() {
  try {
    const mod = await import('./supabase')
    return mod?.supabase || null
  } catch {
    // supabase.js melempar error kalau env belum dikonfigurasi, itu wajar
    // di mode guest / test, cukup jatuh ke jalur fallback.
    return null
  }
}

// Delta per akun TANPA tanda; tanda dikirim terpisah sebagai p_sign supaya
// penanda idempotensi di server bisa membedakan apply (+1) dan revert (-1).
function collectAccountDeltas(accounts, tx, rates) {
  const targetIds = tx.type === 'transfer'
    ? [tx.account_id, tx.to_account_id]
    : [tx.account_id]
  const deltas = []
  const seen = new Set()
  for (const id of targetIds) {
    if (!id || seen.has(id)) continue
    seen.add(id)
    const account = (accounts || []).find((a) => a?.id === id)
    if (!account) continue
    const delta = accountDelta(account, tx, 1, rates)
    if (!delta) continue
    deltas.push({ account_id: id, delta })
  }
  return deltas
}

async function applyBalancesViaRpc(working, tx, sign, rates) {
  const txId = tx.id || tx.fee_id || null
  if (!txId) return { attempted: false }
  const deltas = collectAccountDeltas(working, tx, rates)
  if (!deltas.length) return { attempted: false }

  const client = balanceRpcClient || (await loadSupabaseRpcClient())
  if (!client?.rpc) return { attempted: false }

  const { data, error } = await client.rpc(BALANCE_RPC_NAME, {
    p_tx_id: txId,
    p_account_deltas: deltas,
    p_sign: sign,
  })

  // 404 / PGRST202 = fungsi belum ada di DB -> fallback ke updateAccount.
  if (error) return { attempted: true, ok: false, error }
  if (!data || data.ok !== true) return { attempted: true, ok: false, error: data }

  // No-op idempoten: server sudah pernah menerapkan (tx_id, sign) yang sama,
  // jadi saldo di DB SUDAH termasuk delta ini. Menambahkannya lagi ke saldo
  // lokal akan menghasilkan double-apply, biarkan snapshot apa adanya.
  if (data.applied === false) return { attempted: true, ok: true, applied: false }

  // Sukses: sinkronkan saldo lokal dengan delta yang baru ditulis server.
  for (const d of deltas) {
    const account = working.find((a) => a?.id === d.account_id)
    if (account) {
      account.balance = roundMoney((Number(account.balance) || 0) + d.delta * sign, account.currency)
    }
  }
  return { attempted: true, ok: true, applied: true }
}

export async function applyTxToBalances(store, accounts = [], tx, sign = 1, rates) {
  if (!store || !tx) return Array.isArray(accounts) ? accounts.map((a) => ({ ...a })) : []
  const working = (accounts || []).map((account) => ({ ...account }))
  const find = (id) => working.find((a) => a?.id === id)
  const updated = []

  // Jalur RPC hanya untuk store Supabase; guest/localStorage tidak punya RPC.
  if (store?.mode === 'supabase') {
    try {
      const result = await applyBalancesViaRpc(working, tx, sign, rates)
      if (result.attempted && result.ok) return working
    } catch {
      // Jaringan/error tak terduga -> jatuh ke jalur fallback di bawah.
    }
  }

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
  let negateNext = false
  for (const tk of tokens) {
    if (/[+\-*/]/.test(tk)) {
      if (prevWasOp) {
        // Tanda unary: '-' membalik tanda angka berikutnya (toggle untuk "--"),
        // '+' diabaikan. Versi lama push 0 di sini sehingga presedensi rusak:
        // '2*-3' jadi (2*0)-3 = -3, padahal harusnya -6.
        if (tk === '-') negateNext = !negateNext
        continue
      }
      while (ops.length && prec[ops[ops.length - 1]] >= prec[tk]) out.push(ops.pop())
      ops.push(tk)
      prevWasOp = true
    } else {
      const n = parseFloat(tk)
      out.push(negateNext ? -n : n)
      negateNext = false
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

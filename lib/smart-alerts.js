'use client'

// Rule engine deteksi pembayaran cerdas, di-port dari riset Belanje
// (smart-payment-rules.json, 32 regex). Pola regex disalin persis dari JSON
// riset; prioritas deterministik: rule pertama yang match menang
// (nomor kecil = lebih spesifik). Kontrak output mengikuti match_contract.
// 'Rp' disertakan agar notifikasi Indonesia (Rp 25.000) terbaca nominalnya.
// Group 2 menangkap '1500', '1,500.00', '1.500' (ribuan ID), '25.000'.
const CURRENCY_TOKEN = /\b(RM|MYR|SGD|USD|GBP|EUR|AUD|NZD|BND|THB|IDR|PHP|VND|Rp)\s*([\d][\d,]*(?:\.\d{3}|\.\d{1,2})*)/i

const ISO = { RM: 'MYR', MYR: 'MYR', RP: 'IDR', IDR: 'IDR', SGD: 'SGD', USD: 'USD', GBP: 'GBP', EUR: 'EUR', AUD: 'AUD', NZD: 'NZD', BND: 'BND', THB: 'THB', PHP: 'PHP', VND: 'VND' }

// Rule 10 mencakup kata kerja dua arah; received/credited/refunded artinya uang masuk.
const INCOME_VERBS = /(?:received|credited|refunded)/i

const RULES = [
  { id: 1, label: "DuitNow QR", pattern: "(?:RM|MYR)\\s*[\\d,.]+\\s+DuitNow\\s+(?:QR\\s+)?Pay\\s+to\\s+(.*?)(?:\\s+on\\s+\\d|\\.?\\s+For\\s+queries\\b|\\n|$)", type: "expense", direction: "outgoing", merchantGroup: 1 },
  { id: 2, label: "DuitNow in", pattern: "(?:successfully\\s+)?transferred\\s+(?:RM|MYR)\\s*[\\d,.]+\\s+to\\s+you", type: "income", direction: "incoming", merchantGroup: 0 },
  { id: 3, label: "FPX out", pattern: "(?:RM|MYR)\\s*[\\d,.]+\\s+FPX\\s+to\\s+(?:[0-9a-f]{12,}\\s*\\/\\s*)?(.*?)(?:\\s+on\\s+\\d|[.\\n]|$)", type: "expense", direction: "outgoing", merchantGroup: 1 },
  { id: 4, label: "FPX/3rd in", pattern: "(?:^|\\n)\\s*(.*?)\\s+has\\s+(?:successfully\\s+)?transferred\\s+(?:RM|MYR)\\s*[\\d,.]+\\s+to\\s+you", type: "income", direction: "incoming", merchantGroup: 1 },
  { id: 5, label: "Card spend", pattern: "(?:RM|MYR|SGD|USD)\\s*[\\d,.]+\\s*spent\\s*at\\s*(.*?)\\s*using\\s*your\\s*(?:credit\\s*|debit\\s*)?(?:card|cd)", type: "expense", direction: "outgoing", merchantGroup: 1 },
  { id: 6, label: "Card @ ref", pattern: "\\[^@\\n]*@\\s*(.*?)\\s+(?:RM|MYR)\\s*[\\d,.]+\\s*spent\\s*at\\s*(.*?)\\s*using", type: "expense", direction: "outgoing", merchantGroup: 2 },
  { id: 7, label: "Generic paid", pattern: "RM\\s*[\\d,.]+\\s*(?:has\\s+been\\s+|was\\s+)?(?:paid|transferred|debited|sent)\\s*to\\s*(.*?)(?:\\s+on\\b|\\s+via\\b|\\s+from\\b|\\s+ref\\b|[.\\n]|$)", type: "expense", direction: "outgoing", merchantGroup: 1 },
  { id: 8, label: "You paid ref", pattern: "You've\\s*paid\\s*RM\\s*[\\d,.]+\\s*to\\s*(.*?)(?:\\s+ref\\b|[.\\n]|$)", type: "expense", direction: "outgoing", merchantGroup: 1 },
  { id: 9, label: "At/with", pattern: "(?:rm|myr)\\s*[\\d,.]+\\s+at\\s+(.*?)(?:\\s+with|\\s+using|\\s*$)", type: "expense", direction: "outgoing", merchantGroup: 1 },
  { id: 10, label: "Amount verb", pattern: "(?:rm|myr)\\s*[\\d,]+(?:\\.\\d{1,2})?\\s*(?:has been |have been |was |been |is |successfully )*(?:paid|debited|charged|transferred|deducted|spent|withdrawn|received|credited|refunded)", type: "expense", direction: "outgoing", merchantGroup: 0 },
  { id: 11, label: "Spent at2", pattern: "spent\\s*(?:RM|MYR)?\\s*[\\d,.]+\\s*at\\s*(.*?)(?:\\s+on\\b|\\s*with\\s*your|[.\\n]|\\s*$)", type: "expense", direction: "outgoing", merchantGroup: 1 },
  // Fix atas artefak decompile: pola asli rule 12 menuntut 'your\b' langsung
  // diikuti kata kunci tanpa spasi - mustahil match. Pola baru: nominal +
  // kata kunci cashback/discount/reward (MY + IDR), case-insensitive.
  { id: 12, label: "Cashback", pattern: "(?:RM|MYR|Rp|IDR)\\s*[\\d,.]+\\s*(?:cashback|cash\\s*back|discount|reward|rebate|voucher|promo(?:tion)?\\s*(?:credit|bonus)?)\\b", type: "income", direction: "cashback", merchantGroup: 0, caseInsensitive: true },
  { id: 13, label: "Percent off", pattern: "\\b\\d+%\\s+off\\b", type: "income", direction: "cashback", merchantGroup: 0 },
  { id: 14, label: "Worth", pattern: "(?:transfer(?:red)?|scan\\s*&\\s*pay|payments?|paid|purchases?|spent|debited|credited|received|withdrawals?|transactions?|duitnow|pembayaran|pemindahan|bayaran|dibayar|diterima|menerima|transaksi|pengeluaran)\\b(?:worth|bernilai|senilai)\\s{1,2}(?:(?:up\\s+to|sehingga)\\s{1,2})?$", type: "income", direction: "cashback", merchantGroup: 0 },
  { id: 15, label: "3rd party", pattern: "(?:3rd|third)\\s*party\\s*transfer\\s*(?:RM|MYR)\\s*[\\d,.]+\\s*to\\s*(?:[*x\\d]+\\s*\\/\\s*)?(.*?)(?:\\s*\\/|\\s+on\\b|[.\\n]|$)", type: "expense", direction: "outgoing", merchantGroup: 1 },
  { id: 16, label: "PaymentOf", pattern: "(?:Payment|Transfer)\\s*of\\s*RM\\s*[\\d,.]+\\s*to\\s*(.*?)\\s*successful payment", type: "expense", direction: "outgoing", merchantGroup: 1 },
  { id: 17, label: "TransferIn", pattern: "(?:RM|MYR)\\s*[\\d,.]+\\s*(?:has\\s+been\\s+|was\\s+)?(?:transferred|credited)\\s*to\\s*(?:your|my)\\b[^\\n]*\\bfrom\\b(?:every|each|per|setiap|tiap)", type: "income", direction: "incoming", merchantGroup: 0 },
  { id: 18, label: "Recurring", pattern: "RM\\s*[\\d,.]+\\s*(?:has\\s+been\\s+|was\\s+)?(?:transferred|credited)\\s*to\\s*(?:your|my)\\b[^\\n]*\\bfrom\\b", type: "income", direction: "incoming", merchantGroup: 0 },
  { id: 19, label: "ToNotYou", pattern: "RM\\s*[\\d,.]+\\s*(?:has\\s+been\\s+|was\\s+)?(?:transferred|paid|debited|sent|deducted)\\s*to\\b(?!\\s*(?:your|my)\\b)\\s*(.*?)(?:\\s+on\\b|\\s+via\\b|\\s+from\\b|\\s+ref\\b|\\s+is\\b|\\s+was\\b|\\s+successful\\b|[.\\n]|$)", type: "expense", direction: "outgoing", merchantGroup: 1 },
  { id: 20, label: "PaidByTrans", pattern: "Paid by transfer\\s*of\\s*(?:RM|MYR)\\s*[\\d,.]+\\s*to\\b(?!\\s*(?:your|my)\\b)\\s*(.*?)(?:\\s+on\\b|\\s+via\\b|\\s+from\\b|\\s+ref\\b|\\s+is\\b|\\s+was\\b|\\s+successful\\b|[.\\n]|$)", type: "expense", direction: "outgoing", merchantGroup: 1 },
  { id: 21, label: "GenericTo", pattern: "(?:RM|MYR)\\s*[\\d,.]+\\s*to\\s*(.*?)(?:\\s*\\/|\\s+on\\b|[.\\n]|$)", type: "expense", direction: "outgoing", merchantGroup: 1 },
  { id: 22, label: "NotYou", pattern: "(?:RM|MYR)\\s*[\\d,.]+\\s*to\\s*(?!\\s*you\\b)(.*?)(?:\\s+ref\\b|[.\\n]|$)", type: "expense", direction: "outgoing", merchantGroup: 1 },
  { id: 23, label: "PaidTransfer", pattern: "RM\\s*[\\d,.]+\\s*(?:paid|transfer(?:red)?)\\s*to\\s*(.*?)\\s*(?:\\bon\\b|\\bat\\b|\\bsuccessful\\b)", type: "expense", direction: "outgoing", merchantGroup: 1 },
  { id: 24, label: "ChargedAcc", pattern: "RM\\s*[\\d,.]+\\s*has\\s*been\\s*charged\\s*to\\s*your\\s*account\\s*ending\\s*in\\s*\\d+", type: "expense", direction: "outgoing", merchantGroup: 0 },
  { id: 25, label: "CardBlock", pattern: "\\b(transfer|transferred|received|credited|deposit)\\b(card|visa|mastercard|contactless|purchase)", type: "transfer", direction: "outgoing", merchantGroup: 0 },
  { id: 26, label: "AmountCard", pattern: "^(?:you|your|my)\\bat\\s+(.+?)(?=\\s+(?:with|using)\\s+[^\\n|]{0,60}\\b(?:visa|mastercard|master card|american express|amex|card)\\b|[|\\n]|$)", type: "expense", direction: "outgoing", merchantGroup: 1 },
  { id: 27, label: "TransferVerb", pattern: "(?:transferred|paid|sent)\\s*(?:RM|MYR)\\s*[\\d,.]+\\s*to\\b(?!\\s*(?:your|my)\\b)\\s*(.*?)(?:\\s+on\\b|\\s+via\\b|\\s+from\\b|\\s+ref\\b|\\s+is\\b|\\s+was\\b|\\s+successful\\b|[.\\n]|$)", type: "expense", direction: "outgoing", merchantGroup: 1 },
  { id: 28, label: "PaidAt", pattern: "(?:paid|payment)\\s+(?:rm|myr)\\s*[\\d,.]+\\s+(?:at|to)\\s+(.*?)(?:\\s+with|\\s*$)", type: "expense", direction: "outgoing", merchantGroup: 1 },
  { id: 29, label: "SpentAt", pattern: "spent\\s*(?:RM|MYR)?\\s*[\\d,.]+\\s*at\\s*(.*?)", type: "expense", direction: "outgoing", merchantGroup: 1 },
  { id: 30, label: "FromDaripada", pattern: "\\b(?:from|daripada)\\b[^.!?\\n]{0,20}?\\b(?:bal(?:ance)?|baki|limit)\\b[^\\d]{0,8}$", type: "transfer", direction: "incoming", merchantGroup: 0 },
  { id: 31, label: "Multilang", pattern: "\\b(?:transfer(?:red)?|received|credited|deposit(?:ed)?|duitnow|incoming|inward|masuk|diterima)\\b", type: "income", direction: "incoming", merchantGroup: 0 },
  { id: 32, label: "CurrencySet", pattern: "(?:RM|MYR|SGD|USD|GBP|EUR|AUD|NZD|BND|THB|IDR|PHP|VND)\\s*[\\d,.]+\\s+with\\s+[^\\n]{0,60}\\b(?:visa|mastercard|master card|american express|amex|card)\\b", type: "expense", direction: "outgoing", merchantGroup: 0 },
].map((r) => ({ ...r, re: new RegExp(r.pattern, r.caseInsensitive ? 'i' : '') }))

function parseAmount(text) {
  const m = CURRENCY_TOKEN.exec(text)
  if (!m) return null
  let raw = m[2]
  // '1.500' (tanpa koma) = ribuan gaya Indonesia; '1,500' = ribuan EN.
  // '1.500,25' (koma desimal) = gaya Eropa. Jangan Number() mentah -
  // Number('1.500') = 1.5, bukan 1500.
  if (/^[\d.]+$/.test(raw) && raw.includes('.') && !/,/.test(raw)) {
    const parts = raw.split('.')
    const looksThousands = parts.slice(1).every((p) => p.length === 3)
    raw = looksThousands ? raw.replace(/\./g, '') : raw
  }
  const num = Number(raw.replace(/,/g, ''))
  return Number.isFinite(num) && num > 0 ? num : null
}

function parseCurrency(text) {
  const m = CURRENCY_TOKEN.exec(text)
  return m ? ISO[m[1].toUpperCase()] : null
}

function cleanMerchant(s) {
  if (!s) return null
  const v = s.trim().replace(/[.,;]+$/, '')
  return v.length > 0 ? v : null
}

// matchAlert(text) -> { type, amount, currency, merchant, direction, ruleId, smart_source_key } | null
// Input: body notifikasi bank. Rule pertama yang match menang.
export function matchAlert(text) {
  if (typeof text !== 'string' || text.trim() === '') return null
  for (const rule of RULES) {
    const m = rule.re.exec(text)
    if (!m) continue
    let type = rule.type
    let direction = rule.direction
    if (rule.id === 10 && INCOME_VERBS.test(m[0])) {
      type = 'income'
      direction = 'incoming'
    }
    const merchant = rule.merchantGroup > 0 ? cleanMerchant(m[rule.merchantGroup]) : null
    // Rule 26 tidak menyertakan nominal di dalam match-nya; ambil dari teks penuh.
    const scope = rule.id === 26 ? text : m[0]
    return {
      type,
      amount: parseAmount(scope),
      currency: parseCurrency(scope),
      merchant,
      direction,
      ruleId: rule.id,
      smart_source_key: 'smart-alert:' + rule.id,
    }
  }
  return null
}

export const SMART_ALERT_RULE_COUNT = RULES.length

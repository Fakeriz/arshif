// SATU sumber limits plan Free vs Premium untuk seluruh app.
// Premium TIDAK unlimited (kecuali AI, lihat check_and_consume_ai_quota di SQL).
// Pure JS, tanpa import supabase, supaya bisa di-test dan dipakai client+server.

export const PLAN_LIMITS = {
  accounts_wallets: { free: 4, premium: 30 },
  savings_goals: { free: 3, premium: 30 },
  loans_bills: { free: 3, premium: 30 },
  subscriptions: { free: 5, premium: 50 },
  smart_automation_per_month: { free: 30, premium: 500 },
  receipt_ocr_per_month: { free: 20, premium: 300 },
  statement_import_per_month: { free: 1, premium: 10 },
  invoices_per_month: { free: 5, premium: 30 },
  // money_tax_tools bukan angka: free basic, premium full + PDF export
  money_tax_tools: { free: 'basic', premium: 'full' },
}

// Sumber limit per resource: 'count' = jumlah item aktif, 'monthly' = dipakai per bulan, 'tiered' = fitur berjenjang.
export const PLAN_LIMIT_KIND = {
  accounts_wallets: 'count',
  savings_goals: 'count',
  loans_bills: 'count',
  subscriptions: 'count',
  smart_automation_per_month: 'monthly',
  receipt_ocr_per_month: 'monthly',
  statement_import_per_month: 'monthly',
  invoices_per_month: 'monthly',
  money_tax_tools: 'tiered',
}

// Resource yang dilacak di tabel feature_usage_log (server), bukan hitung item.
export const USAGE_TRACKED_RESOURCES = [
  'smart_automation_per_month',
  'receipt_ocr_per_month',
  'statement_import_per_month',
  'invoices_per_month',
]

export function getLimit(resource, tier) {
  const entry = PLAN_LIMITS[resource]
  if (!entry) return null
  return tier === 'premium' || tier === 'admin' ? entry.premium : entry.free
}

// currentCount null/undefined = belum diketahui, anggap masih boleh (jangan blok gara-gara data belum termuat).
export function isAllowed(resource, tier, currentCount) {
  const limit = getLimit(resource, tier)
  if (limit === null || limit === undefined) return true
  if (typeof limit !== 'number') return true // tiered, bukan hitungan
  if (currentCount === null || currentCount === undefined) return true
  return currentCount < limit
}

// Label pendek untuk UI, bahasa Indonesia (komentar app berbahasa Indonesia).
export function formatLimit(resource, tier) {
  const limit = getLimit(resource, tier)
  if (limit === null || limit === undefined) return '-'
  if (resource === 'money_tax_tools') return limit === 'full' ? 'Lengkap + ekspor PDF' : 'Dasar'
  return String(limit)
}

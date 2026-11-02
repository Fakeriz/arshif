// Geser tanggal jatuh tempo langganan/tagihan berulang sesuai siklusnya.
// Tanggal dikembalikan sebagai 'YYYY-MM-DD' supaya cocok dengan kolom date di DB.

const DAY_MS = 86400000

function parseIso(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''))
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2]) - 1
  const d = Number(m[3])
  if (mo < 0 || mo > 11 || d < 1 || d > 31) return null
  return { y, mo, d }
}

export function normalizeCycle(cycle) {
  const c = String(cycle || 'monthly').toLowerCase()
  if (c === 'week' || c === 'weekly') return 'weekly'
  if (c === 'fortnight' || c === 'biweekly' || c === 'bi-weekly') return 'biweekly'
  if (c === 'quarter' || c === 'quarterly') return 'quarterly'
  if (c === 'year' || c === 'yearly' || c === 'annual' || c === 'annually') return 'yearly'
  return 'monthly'
}

// steps positif = maju, negatif = mundur.
export function shiftCycleDate(iso, cycle, steps = 1) {
  const base = parseIso(iso)
  if (!base) return null
  const kind = normalizeCycle(cycle)
  const n = Number(steps) || 1

  if (kind === 'weekly' || kind === 'biweekly') {
    const days = (kind === 'weekly' ? 7 : 14) * n
    const out = new Date(Date.UTC(base.y, base.mo, base.d) + days * DAY_MS)
    return out.toISOString().slice(0, 10)
  }

  const monthsPerStep = kind === 'yearly' ? 12 : kind === 'quarterly' ? 3 : 1
  const anchor = new Date(Date.UTC(base.y, base.mo + n * monthsPerStep, 1))
  const ty = anchor.getUTCFullYear()
  const tm = anchor.getUTCMonth()
  // 31 Jan + 1 bulan jatuh di Februari: pakai hari terakhir bulan tujuan,
  // jangan sampai Date menggulung ke Maret.
  const lastDay = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate()
  const out = new Date(Date.UTC(ty, tm, Math.min(base.d, lastDay)))
  return out.toISOString().slice(0, 10)
}

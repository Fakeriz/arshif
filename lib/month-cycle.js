// Month Start Date (Awal Siklus Bulan) helpers: a day-of-month (1-31) that
// defines when the user's budgeting month begins. Defaults to the 1st.

export const MONTH_START_DEFAULT = 1
export const MONTH_START_KEY = 'arshif_month_start_day'

export function clampMonthStartDay(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return MONTH_START_DEFAULT
  if (n < 1) return 1
  if (n > 31) return 31
  return Math.round(n)
}

export function readMonthStartDay(getItem, profile = {}) {
  const fromProfile = Number(profile?.month_start_day)
  if (Number.isInteger(fromProfile) && fromProfile >= 1 && fromProfile <= 31) return fromProfile
  try {
    const stored = Number(getItem?.(MONTH_START_KEY))
    if (Number.isInteger(stored) && stored >= 1 && stored <= 31) return stored
  } catch {}
  return MONTH_START_DEFAULT
}

export function monthRangeLabel(day, year, month, { locale = 'en-US' } = {}) {
  // Februari gak punya hari 29-31: clamp ke jumlah hari bulan itu, kalau tidak
  // new Date() menggulung (31 Feb → 3 Mar) dan preview rentang jadi salah.
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const startDay = Math.min(clampMonthStartDay(day), daysInMonth)
  const start = new Date(year, month, startDay)
  const end = new Date(year, month + 1, startDay - 1)
  const s = start.toLocaleDateString(locale, { day: 'numeric', month: 'short' })
  const e = end.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })
  return `${s} – ${e}`
}

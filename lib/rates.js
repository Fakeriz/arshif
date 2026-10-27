// Static fallback exchange rates, USD base (approx. mid-2025). Used when live provider is unreachable.
export const FALLBACK_RATES = {
  USD: 1, EUR: 0.92, IDR: 16300, MYR: 4.25, TRY: 39.5, SGD: 1.29, GBP: 0.74, JPY: 144.5,
  THB: 32.8, PHP: 56.2, VND: 26000, SAR: 3.75, AED: 3.67, AUD: 1.54, CAD: 1.37, CNY: 7.18,
  HKD: 7.85, INR: 85.6, KRW: 1380, NZD: 1.66, CHF: 0.82, SEK: 9.6, NOK: 10.1, DKK: 6.9,
  PLN: 3.75, CZK: 21.8, HUF: 360, RUB: 79, BRL: 5.5, MXN: 19.1, ZAR: 18, EGP: 50, NGN: 1550,
  KES: 129, PKR: 280, BDT: 122, LKR: 300, NPR: 137, QAR: 3.64, KWD: 0.31, BHD: 0.376, OMR: 0.385,
  JOD: 0.709, ILS: 3.5, TWD: 29.5, MMK: 2100, KHR: 4000, LAK: 21500, BND: 1.29, ARS: 1180,
  CLP: 930, COP: 4100, PEN: 3.6, UAH: 41.5, RON: 4.6, BGN: 1.8, ISK: 128, MAD: 9.3, TND: 3.0,
  GHS: 10.3, UGX: 3600, TZS: 2600, ETB: 135, DZD: 132, IQD: 1310, IRR: 42000, AFN: 70, UZS: 12700,
  KZT: 510, GEL: 2.72, AMD: 385, AZN: 1.7, BYN: 3.27, MDL: 17, RSD: 108, MKD: 56.6, ALL: 87,
  BAM: 1.8, XOF: 605, XAF: 605, MUR: 46, MVR: 15.4, FJD: 2.25, PGK: 4.1, BOB: 6.9, PYG: 8000,
  UYU: 41, GTQ: 7.7, HNL: 26, NIO: 36.8, CRC: 510, DOP: 59, JMD: 158, TTD: 6.8, BSD: 1, BBD: 2,
  XCD: 2.7, CUP: 24, VES: 100, MOP: 8.08, MNT: 3580, BTN: 85.6, KGS: 87.4, TJS: 10.4, TMT: 3.5,
  LBP: 89500, YER: 250, LYD: 5.45, SDG: 600, SOS: 571, RWF: 1430, MWK: 1735, ZMW: 26, MZN: 64,
  AOA: 915, NAD: 18, BWP: 13.5, MGA: 4500, SCR: 14.5, CVE: 101, GMD: 72, GNF: 8650, SLE: 22.5,
  LRD: 200, DJF: 178, KMF: 453, BIF: 2970, CDF: 2870, HTG: 131, SRD: 37, GYD: 209, BZD: 2,
  AWG: 1.8, ANG: 1.8, KYD: 0.83, BMD: 1, PAB: 1, XPF: 110, WST: 2.8, TOP: 2.4, VUV: 120,
  SBD: 8.4, MRU: 39.7, SYP: 13000, SSP: 4500, ERN: 15, STN: 22.5, SZL: 18, LSL: 18,
}

// Convert amount between currencies given USD-based rates table
export function convert(amount, from, to, rates) {
  const r = rates || FALLBACK_RATES
  const a = Number(amount) || 0
  if (!from || !to || from === to) return a
  const rf = r?.[from] ?? FALLBACK_RATES?.[from]
  const rt = r?.[to] ?? FALLBACK_RATES?.[to]
  if (!(Number.isFinite(rf) && rf > 0) || !(Number.isFinite(rt) && rt > 0)) {
    throw new Error(`Missing exchange rate for ${!rf ? from : to}`)
  }
  return (a / rf) * rt
}

// Rate for 1 unit of `from` in `to`
export function safeConvert(amount, from, to, rates) {
  try {
    return convert(amount, from, to, rates)
  } catch {
    return null
  }
}

export function getRate(from, to, rates) {
  return convert(1, from, to, rates)
}

export function formatRate(rate) {
  const r = Number(rate) || 0
  if (r >= 1000) return Math.round(r).toLocaleString('en-US')
  if (r >= 100) return r.toFixed(1)
  if (r >= 1) return r.toFixed(2)
  return r.toPrecision(4)
}

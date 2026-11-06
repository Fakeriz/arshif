import { applyBp, progressive, toRateRows, type TaxResult } from './common';

/**
 * Gelir Vergisi atas gaji (ücret) Turki, 2026. Nominal kuruş (TRY).
 * Tiap bulan: matrah = brüt − SGK pekerja 14% − işsizlik 1% (dasar SGK dibatasi 9 × asgari ücret brüt).
 * Pajak dihitung kumulatif sepanjang tahun (GVK md. 103), lalu dikurangi istisna asgari ücret
 * (pajak atas matrah asgari ücret bulan yang sama, kumulatif juga). Damga vergisi tidak termasuk.
 */

/** Tarif ücret 2026 (332 Seri No.lu GV Genel Tebliği): 190.000 / 400.000 / 1.500.000 / 5.300.000 TL. */
export const TR_WAGE_RATES = [
  { upTo: 19_000_000, bp: 1500 },
  { upTo: 40_000_000, bp: 2000 },
  { upTo: 150_000_000, bp: 2700 },
  { upTo: 530_000_000, bp: 3500 },
  { upTo: null, bp: 4000 },
];

/** Tarif penghasilan selain gaji 2026: lapis ketiga berhenti di 1.000.000 TL. */
export const TR_OTHER_RATES = [
  { upTo: 19_000_000, bp: 1500 },
  { upTo: 40_000_000, bp: 2000 },
  { upTo: 100_000_000, bp: 2700 },
  { upTo: 530_000_000, bp: 3500 },
  { upTo: null, bp: 4000 },
];

/** Asgari ücret brüt 2026, sebulan. */
export const TR_MIN_WAGE = 3_303_000;
const SGK_BP = 1400;
const UNEMPLOYMENT_BP = 100;
const SGK_CEILING = TR_MIN_WAGE * 9;

function monthlyMatrah(gross: number): { matrah: number; sgk: number } {
  const base = Math.min(gross, SGK_CEILING);
  const sgk = applyBp(base, SGK_BP) + applyBp(base, UNEMPLOYMENT_BP);
  return { matrah: Math.max(0, gross - sgk), sgk };
}

export type TrMonth = { month: number; tax: number; exemption: number; payable: number };

/** Rincian 12 bulan untuk gaji brüt yang sama tiap bulan. */
export function trWageMonths(monthlyGross: number): { months: TrMonth[]; sgk: number; matrah: number } {
  const gross = Math.max(0, Math.trunc(monthlyGross));
  const { matrah, sgk } = monthlyMatrah(gross);
  const mw = monthlyMatrah(TR_MIN_WAGE).matrah;
  const months: TrMonth[] = [];
  for (let m = 1; m <= 12; m++) {
    const tax = progressive(matrah * m, TR_WAGE_RATES) - progressive(matrah * (m - 1), TR_WAGE_RATES);
    const mwTax = progressive(mw * m, TR_WAGE_RATES) - progressive(mw * (m - 1), TR_WAGE_RATES);
    const exemption = Math.min(tax, mwTax);
    months.push({ month: m, tax, exemption, payable: tax - exemption });
  }
  return { months, sgk, matrah };
}

export function estimateTr(input: { monthlyGross: number }): TaxResult {
  const gross = Math.max(0, Math.trunc(input.monthlyGross));
  const { months, sgk, matrah } = trWageMonths(gross);
  const sum = (k: keyof TrMonth) => months.reduce((s, m) => s + m[k], 0);
  const tax = sum('tax');
  const exemption = sum('exemption');
  const payable = sum('payable');
  return {
    country: 'TR',
    currency: 'TRY',
    headline: payable,
    headlineKey: 'tools.tax.tr.headline',
    annualTax: payable,
    lines: [
      { key: 'trGross', amount: gross * 12 },
      { key: 'trSgk', amount: sgk * 12, minus: true },
      { key: 'trMatrah', amount: matrah * 12 },
      { key: 'trTax', amount: tax },
      { key: 'trExemption', amount: exemption, minus: true },
      { key: 'trPayable', amount: payable, strong: true },
      { key: 'trFirst', amount: months[0].payable },
      { key: 'trLast', amount: months[11].payable },
    ],
    rates: toRateRows(TR_WAGE_RATES),
    notes: ['tools.tax.tr.noteCumulative', 'tools.tax.tr.noteMinWage', 'tools.tax.tr.noteStamp'],
  };
}

/** Laporan tahunan: pemasukan selain gaji, tarif ücret dışı, tanpa istisna asgari ücret. */
export function annualTr(income: number): { taxable: number; tax: number; allowance: number } {
  const taxable = Math.max(0, income);
  return { taxable, tax: progressive(taxable, TR_OTHER_RATES), allowance: 0 };
}

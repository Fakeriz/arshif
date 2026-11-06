import { applyBp, progressive, toRateRows, type TaxResult } from './common';

/**
 * Estimasi PCB/MTD Malaysia untuk penduduk (resident), Tahun Taksiran 2026. Nominal sen (MYR).
 * Gaji sama tiap bulan: pendapatan setahun dikurangi pelepasan, dikenai tarif progresif, dikurangi rebat,
 * lalu dibagi 12. Untuk gaji tetap tanpa tambahan, hasilnya sama dengan PCB bulan pertama metode komputer LHDN.
 */

/** Tarif penduduk YA 2023 dan seterusnya (tidak berubah untuk YA 2026). Batas atas pendapatan bercukai, sen. */
export const MY_RATES = [
  { upTo: 500_000, bp: 0 },
  { upTo: 2_000_000, bp: 100 },
  { upTo: 3_500_000, bp: 300 },
  { upTo: 5_000_000, bp: 600 },
  { upTo: 7_000_000, bp: 1100 },
  { upTo: 10_000_000, bp: 1900 },
  { upTo: 40_000_000, bp: 2500 },
  { upTo: 60_000_000, bp: 2600 },
  { upTo: 200_000_000, bp: 2800 },
  { upTo: null, bp: 3000 },
];

export const MY_RELIEF_SELF = 900_000;
export const MY_RELIEF_SPOUSE = 400_000;
export const MY_RELIEF_CHILD = 200_000;
/** Pelepasan KWSP (bagian pekerja) maksimal RM4.000 setahun. */
export const MY_EPF_RELIEF_MAX = 400_000;
const MY_EPF_BP = 1100;
const MY_REBATE = 40_000;
const MY_REBATE_LIMIT = 3_500_000;

export type MyInput = {
  /** Gaji bulanan kasar, sen. */
  monthlyGross: number;
  /** Pasangan tidak bekerja (kategori 2: pelepasan + rebat pasangan). */
  spouseRelief: boolean;
  children: number;
  /** Mencarum KWSP 11%. */
  epf: boolean;
};

export function estimateMy(input: MyInput): TaxResult {
  const gross = Math.max(0, Math.trunc(input.monthlyGross));
  const children = Math.max(0, Math.min(20, Math.trunc(input.children)));
  const annual = gross * 12;
  const epfYear = input.epf ? applyBp(gross, MY_EPF_BP) * 12 : 0;
  const epfRelief = Math.min(epfYear, MY_EPF_RELIEF_MAX);
  const spouse = input.spouseRelief ? MY_RELIEF_SPOUSE : 0;
  const kids = children * MY_RELIEF_CHILD;
  const chargeable = Math.max(0, annual - epfRelief - MY_RELIEF_SELF - spouse - kids);
  const gross_tax = progressive(chargeable, MY_RATES);
  const rebate = chargeable <= MY_REBATE_LIMIT ? Math.min(gross_tax, MY_REBATE + (input.spouseRelief ? MY_REBATE : 0)) : 0;
  const tax = gross_tax - rebate;
  // Dibagi rata 12 bulan, dibulatkan ke sen terdekat.
  const monthly = Math.round(tax / 12);

  return {
    country: 'MY',
    currency: 'MYR',
    headline: monthly,
    headlineKey: 'tools.tax.my.headline',
    annualTax: tax,
    lines: [
      { key: 'myAnnual', amount: annual },
      ...(epfRelief > 0 ? [{ key: 'myEpf', amount: epfRelief, minus: true }] : []),
      { key: 'mySelf', amount: MY_RELIEF_SELF, minus: true },
      ...(spouse > 0 ? [{ key: 'mySpouse', amount: spouse, minus: true }] : []),
      ...(kids > 0 ? [{ key: 'myChildren', amount: kids, minus: true, vars: { count: children } }] : []),
      { key: 'myChargeable', amount: chargeable },
      { key: 'myTax', amount: gross_tax },
      ...(rebate > 0 ? [{ key: 'myRebate', amount: rebate, minus: true }] : []),
      { key: 'myYear', amount: tax, strong: true },
      { key: 'myMonthly', amount: monthly, strong: true },
    ],
    rates: toRateRows(MY_RATES),
    notes: ['tools.tax.my.noteResident', 'tools.tax.my.noteReliefs', 'tools.tax.my.noteZakat'],
  };
}

/** Laporan tahunan: pemasukan dikurangi pelepasan diri, tarif penduduk, rebat bila <= RM35.000. */
export function annualMy(income: number): { taxable: number; tax: number; allowance: number } {
  const taxable = Math.max(0, income - MY_RELIEF_SELF);
  const raw = progressive(taxable, MY_RATES);
  const tax = taxable <= MY_REBATE_LIMIT ? Math.max(0, raw - MY_REBATE) : raw;
  return { taxable, tax, allowance: MY_RELIEF_SELF };
}

import type { Transaction } from '@/data/types';
import { convert, hasRate, tryConvert } from '@/lib/fx';
import { isReimbursable, reimbursementIncomeIds } from '@/lib/transactions';

import { TAX_CURRENCY, type TaxCountry } from './common';
import { annualId, type PtkpStatus } from './id';
import { annualMy } from './my';
import { annualTr } from './tr';

export * from './common';
export { estimateId, ptkpCode, terCategory, terRate, PASAL17, type IdInput, type PtkpStatus } from './id';
export { estimateMy, MY_RATES, type MyInput } from './my';
export { estimateTr, trWageMonths, TR_WAGE_RATES, TR_OTHER_RATES, TR_MIN_WAGE } from './tr';

export type AnnualReport = {
  country: TaxCountry;
  currency: string;
  year: number;
  income: number;
  expense: number;
  /** Pemasukan per kategori, terbesar dulu. */
  byCategory: { key: string; amount: number }[];
  /** Pemasukan dan pengeluaran per bulan (indeks 0 = Januari). */
  months: { income: number; expense: number }[];
  /** Transaksi yang dilewati karena kurs mata uangnya tidak tersedia. */
  skipped: number;
  allowance: number;
  taxable: number;
  tax: number;
};

/**
 * Laporan pajak tahunan dari data transaksi (FR-TAX-3). Pemasukan dan pengeluaran tahun itu dikonversi ke mata
 * uang negara pajak dengan kurs terbaru, transfer tidak dihitung. Estimasi pajaknya kasar: seluruh pemasukan
 * dianggap penghasilan kena pajak (lihat annualId/annualMy/annualTr).
 */
export function annualReport(transactions: Transaction[], year: number, country: TaxCountry, status: PtkpStatus, table?: Record<string, string>): AnnualReport {
  const currency = TAX_CURRENCY[country];
  const prefix = `${year}-`;
  const months = Array.from({ length: 12 }, () => ({ income: 0, expense: 0 }));
  const cats = new Map<string, number>();
  let income = 0;
  let expense = 0;
  let skipped = 0;
  // Reimbursement dan pemasukan penggantinya tidak dihitung (FR-TRX-4).
  const repayments = reimbursementIncomeIds(transactions);
  for (const t of transactions) {
    if (t.type === 'transfer' || !t.date.startsWith(prefix) || isReimbursable(t) || repayments.has(t.id)) continue;
    // Tanpa tabel: kurs pada tanggal transaksi (FR-FX-4).
    const v = table
      ? t.currency === currency || (hasRate(t.currency, table) && hasRate(currency, table)) ? convert(t.amount, t.currency, currency, table) : null
      : tryConvert(t.amount, t.currency, currency, t.date);
    if (v === null) {
      skipped++;
      continue;
    }
    const m = Number(t.date.slice(5, 7)) - 1;
    if (t.type === 'income') {
      income += v;
      months[m].income += v;
      cats.set(t.categoryKey, (cats.get(t.categoryKey) ?? 0) + v);
    } else {
      expense += v;
      months[m].expense += v;
    }
  }
  const est = country === 'ID' ? annualId(income, status) : country === 'MY' ? annualMy(income) : annualTr(income);
  return {
    country, currency, year, income, expense, months, skipped,
    byCategory: [...cats.entries()].map(([key, amount]) => ({ key, amount })).sort((a, b) => b.amount - a.amount),
    ...est,
  };
}

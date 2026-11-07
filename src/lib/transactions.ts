import type { Account, Transaction, TxType } from '@/data/types';

import { tryConvert } from './fx';

/** Efek transaksi pada saldo satu akun (minor units, dalam mata uang akun). */
export function effectOn(tx: Transaction, accountId: string): number {
  if (tx.type === 'income' && tx.accountId === accountId) return tx.accountAmount ?? tx.amount;
  if (tx.type === 'expense' && tx.accountId === accountId) return -(tx.accountAmount ?? tx.amount);
  if (tx.type === 'transfer') {
    if (tx.accountId === accountId) return -(tx.accountAmount ?? tx.amount);
    if (tx.toAccountId === accountId) return tx.toAmount ?? tx.amount;
  }
  return 0;
}

export function accountBalance(account: Account, txs: Transaction[]): number {
  return txs.reduce((sum, tx) => sum + effectOn(tx, account.id), account.openingBalance);
}

/**
 * Nominal transaksi dalam mata uang utama memakai kurs PADA TANGGAL transaksi (FR-FX-4: belanja terkunci
 * pada kurs harinya). Kurs hilang = 0 (dikecualikan dari agregat, layar meminta kurs).
 */
export function amountIn(tx: Transaction, main: string): number {
  return tryConvert(tx.amount, tx.currency, main, tx.date) ?? 0;
}

/**
 * Reimbursement (FR-TRX-4): pengeluaran yang ditandai diganti teman bukan belanja pengguna, dan pemasukan
 * penggantinya bukan pemasukan. Saldo akun tetap mengikuti uang yang benar-benar keluar/masuk.
 */
export function isReimbursable(tx: Transaction): boolean {
  return tx.type === 'expense' && !!tx.reimburseStatus;
}

/** id pemasukan yang menjadi pengganti reimbursement. */
export function reimbursementIncomeIds(txs: Transaction[]): Set<string> {
  const out = new Set<string>();
  for (const t of txs) if (t.type === 'expense' && t.reimbursedBy) out.add(t.reimbursedBy);
  return out;
}

/** Pengeluaran yang dihitung sebagai belanja (budget, recap, total). */
export function countsAsSpending(tx: Transaction): boolean {
  return tx.type === 'expense' && !tx.reimburseStatus;
}

export type TxFilter = {
  query?: string;
  type?: TxType | 'all';
  accountId?: string | null;
  categoryKey?: string | null;
};

export function isFilterActive(f: TxFilter): boolean {
  return !!(f.query?.trim() || (f.type && f.type !== 'all') || f.accountId || f.categoryKey);
}

/** `categoryLabel` memberi nama kategori dalam bahasa aktif supaya pencarian cocok dengan yang dilihat pengguna. */
export function filterTransactions(txs: Transaction[], f: TxFilter, categoryLabel: (key: string) => string = (k) => k): Transaction[] {
  const q = f.query?.trim().toLowerCase();
  return txs.filter((tx) => {
    if (f.type && f.type !== 'all' && tx.type !== f.type) return false;
    if (f.accountId && tx.accountId !== f.accountId && tx.toAccountId !== f.accountId) return false;
    if (f.categoryKey && tx.categoryKey !== f.categoryKey) return false;
    if (q) {
      const hay = `${tx.merchant} ${tx.note ?? ''} ${categoryLabel(tx.categoryKey)}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function sortNewestFirst(txs: Transaction[]): Transaction[] {
  return [...txs].sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`) || b.id.localeCompare(a.id));
}

export type DayGroup = { date: string; items: Transaction[] };

export function groupByDay(txs: Transaction[]): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const tx of sortNewestFirst(txs)) {
    const last = groups[groups.length - 1];
    if (last && last.date === tx.date) last.items.push(tx);
    else groups.push({ date: tx.date, items: [tx] });
  }
  return groups;
}

/** `repaymentIds`: pemasukan pengganti reimbursement (dari SEMUA transaksi, bukan hanya yang difilter). */
export function totals(txs: Transaction[], main: string, repaymentIds: Set<string> = reimbursementIncomeIds(txs)): { income: number; expense: number } {
  let income = 0;
  let expense = 0;
  for (const tx of txs) {
    if (tx.type === 'income' && !repaymentIds.has(tx.id)) income += amountIn(tx, main);
    if (countsAsSpending(tx)) expense += amountIn(tx, main);
  }
  return { income, expense };
}

export function txInRange(txs: Transaction[], start: string, end: string): Transaction[] {
  return txs.filter((tx) => tx.date >= start && tx.date <= end);
}

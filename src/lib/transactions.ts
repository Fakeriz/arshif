import type { Account, Transaction, TxType } from '@/data/types';

import { convert } from './fx';

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

/** Total kekayaan bersih dalam mata uang utama (kartu kredit bersaldo negatif = utang). */
export function netWorth(accounts: Account[], txs: Transaction[], main: string): number {
  return accounts.reduce((sum, a) => sum + convert(accountBalance(a, txs), a.currency, main), 0);
}

/** Nominal transaksi dalam mata uang utama, memakai kurs hari ini (Fase 1). */
export function amountIn(tx: Transaction, main: string): number {
  return convert(tx.amount, tx.currency, main);
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

export function totals(txs: Transaction[], main: string): { income: number; expense: number } {
  let income = 0;
  let expense = 0;
  for (const tx of txs) {
    if (tx.type === 'income') income += amountIn(tx, main);
    if (tx.type === 'expense') expense += amountIn(tx, main);
  }
  return { income, expense };
}

export function txInRange(txs: Transaction[], start: string, end: string): Transaction[] {
  return txs.filter((tx) => tx.date >= start && tx.date <= end);
}

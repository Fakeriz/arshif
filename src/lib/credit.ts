import type { Account, AnnualFee, LimitGroup, Transaction } from '@/data/types';

import { daysInMonth, parseYMD, ymd } from './dates';
import { tryConvert } from './fx';

/** Tipe akun yang punya limit + saldo utang (FR-ACC-3, FR-ACC-8). */
export const CREDIT_TYPES = ['kartu_kredit', 'paylater'] as const;
export const isCreditType = (type: Account['type']): boolean => (CREDIT_TYPES as readonly string[]).includes(type);

/** Terpakai = utang kartu: saldo negatif. Saldo positif (kelebihan bayar) = 0 terpakai. */
export function usedOf(balance: number): number {
  return balance < 0 ? -balance : 0;
}

export type Utilization = {
  /** 'group' = limit gabungan, 'card' = limit kartu sendiri. */
  scope: 'group' | 'card';
  used: number;
  limit: number;
  currency: string;
  /** 0..n (1 = 100%). */
  ratio: number;
  /** Nama grup bila scope = group. */
  groupName?: string;
  /** Jumlah kartu di grup. */
  members?: number;
  /** Kartu di grup yang kursnya hilang (tidak ikut dijumlah). */
  skipped?: number;
};

type WithBalance = Account & { balance: number };

/**
 * Utilisasi grup limit gabungan (FR-ACC-6) = total terpakai SEMUA kartu di grup ÷ limit gabungan,
 * bukan jumlah utilisasi tiap kartu. Kartu mata uang lain dikonversi ke mata uang grup dengan kurs hari ini.
 */
export function groupUtilization(group: LimitGroup, accounts: WithBalance[]): Utilization {
  const members = accounts.filter((a) => a.limitGroupId === group.id);
  let used = 0;
  let skipped = 0;
  for (const a of members) {
    const v = tryConvert(usedOf(a.balance), a.currency, group.currency);
    if (v === null) skipped++;
    else used += v;
  }
  return { scope: 'group', used, limit: group.sharedLimit, currency: group.currency, ratio: used / group.sharedLimit, groupName: group.name, members: members.length, skipped };
}

/** Utilisasi untuk satu kartu: grupnya bila ada, selain itu limit kartu sendiri. null = tanpa limit. */
export function cardUtilization(account: WithBalance, groups: LimitGroup[], accounts: WithBalance[]): Utilization | null {
  if (!isCreditType(account.type)) return null;
  const group = account.limitGroupId ? groups.find((g) => g.id === account.limitGroupId) : undefined;
  if (group) return groupUtilization(group, accounts);
  if (!account.creditLimit) return null;
  const used = usedOf(account.balance);
  return { scope: 'card', used, limit: account.creditLimit, currency: account.currency, ratio: used / account.creditLimit };
}

// ---------------------------------------------------------------- iuran tahunan (FR-ACC-7)

/** Tanggal tagih iuran di tahun `y` (hari 31 di bulan pendek = hari terakhir bulan itu). */
export function feeDateIn(fee: Pick<AnnualFee, 'month' | 'day'>, y: number): string {
  return ymd(y, fee.month, Math.min(fee.day, daysInMonth(y, fee.month)));
}

/** Tanggal tagih terakhir yang sudah lewat atau hari ini. */
export function lastFeeDate(fee: Pick<AnnualFee, 'month' | 'day'>, today: string): string {
  const { y } = parseYMD(today);
  const thisYear = feeDateIn(fee, y);
  return thisYear <= today ? thisYear : feeDateIn(fee, y - 1);
}

export function nextFeeDate(fee: Pick<AnnualFee, 'month' | 'day'>, today: string): string {
  const { y } = parseYMD(today);
  const thisYear = feeDateIn(fee, y);
  return thisYear > today ? thisYear : feeDateIn(fee, y + 1);
}

/**
 * Belanja di kartu sejak tanggal iuran terakhir (inklusif) sampai hari ini, dalam mata uang kartu. Yang dihitung:
 * pengeluaran di kartu itu, kecuali kategori Bank & Biaya Admin (iuran dan biaya bank bukan belanja).
 */
export function spendSince(account: Pick<Account, 'id'>, txs: Transaction[], start: string, today: string): number {
  let sum = 0;
  for (const t of txs) {
    if (t.type !== 'expense' || t.accountId !== account.id || t.categoryKey === 'bank') continue;
    if (t.date < start || t.date > today) continue;
    sum += t.accountAmount ?? t.amount;
  }
  return sum;
}

export type FeeStatus = {
  /** Tanggal tagih siklus berjalan (terakhir yang sudah lewat). */
  lastDate: string;
  nextDate: string;
  /** Iuran siklus berjalan sudah ditandai dibayar. */
  paid: boolean;
  /** Belanja sejak tanggal iuran terakhir. */
  spent: number;
  /** Sisa belanja untuk bebas iuran; 0 = sudah memenuhi. null = tanpa ambang. */
  remaining: number | null;
  /** 0..1 */
  progress: number | null;
};

/** Progress waiver = belanja kartu sejak tanggal iuran terakhir vs ambang bebas iuran. */
export function feeStatus(account: Pick<Account, 'id'> & { annualFee: AnnualFee }, txs: Transaction[], today: string): FeeStatus {
  const fee = account.annualFee;
  const lastDate = lastFeeDate(fee, today);
  const spent = spendSince(account, txs, lastDate, today);
  const threshold = fee.waiverThreshold;
  return {
    lastDate,
    nextDate: nextFeeDate(fee, today),
    paid: fee.paid.includes(lastDate),
    spent,
    remaining: threshold ? Math.max(0, threshold - spent) : null,
    progress: threshold ? Math.min(1, spent / threshold) : null,
  };
}

/** Tandai iuran tanggal `date` dibayar (riwayat terurut, tanpa duplikat). */
export function markFeePaid(fee: AnnualFee, date: string): AnnualFee {
  return { ...fee, paid: [...new Set([...fee.paid, date])].sort() };
}

export function unmarkFeePaid(fee: AnnualFee, date: string): AnnualFee {
  return { ...fee, paid: fee.paid.filter((d) => d !== date) };
}

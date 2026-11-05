import { getCategory, type Bucket } from '@/constants/categories';
import type { Transaction } from '@/data/types';

import { addDays, daysInMonth, diffDays, parseYMD, ymd } from './dates';
import { amountIn, txInRange } from './transactions';

export type Split = Record<Bucket, number>;
export const DEFAULT_SPLIT: Split = { needs: 50, wants: 30, savings: 20 };

/** Urutan bucket 50/30/20. Label: `domain.bucket.<key>`. */
export const BUCKETS: { key: Bucket }[] = [{ key: 'needs' }, { key: 'wants' }, { key: 'savings' }];

export function splitIsValid(split: Split): boolean {
  const values = Object.values(split);
  return values.every((v) => Number.isInteger(v) && v >= 0) && values.reduce((a, b) => a + b, 0) === 100;
}

/** Batas per bucket dalam minor units. Sisa pembulatan jatuh ke Tabungan agar jumlahnya pas. */
export function bucketLimits(income: number, split: Split): Record<Bucket, number> {
  const needs = Math.round((income * split.needs) / 100);
  const wants = Math.round((income * split.wants) / 100);
  return { needs, wants, savings: income - needs - wants };
}

export type BudgetPeriod = { start: string; end: string; totalDays: number; elapsedDays: number; daysLeft: number };

function paydayIn(y: number, m: number, payday: number): string {
  return ymd(y, m, Math.min(payday, daysInMonth(y, m)));
}

/** Bulan budget mengikuti tanggal gajian (FR-BDG-6). Hari ini ikut dihitung sebagai hari berjalan. */
export function budgetPeriod(today: string, payday: number): BudgetPeriod {
  const { y, m } = parseYMD(today);
  const thisMonth = paydayIn(y, m, payday);
  const prev = m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 };
  const next = m === 12 ? { y: y + 1, m: 1 } : { y, m: m + 1 };
  const start = thisMonth <= today ? thisMonth : paydayIn(prev.y, prev.m, payday);
  const nextStart = thisMonth <= today ? paydayIn(next.y, next.m, payday) : thisMonth;
  const end = addDays(nextStart, -1);
  const totalDays = diffDays(end, start) + 1;
  const elapsedDays = diffDays(today, start) + 1;
  return { start, end, totalDays, elapsedDays, daysLeft: totalDays - elapsedDays + 1 };
}

/** Label: `domain.pace.<pace>`. */
export type Pace = 'sesuai' | 'agak_cepat' | 'terlalu_cepat';

/** Laju belanja = porsi anggaran terpakai dibanding porsi waktu berjalan. <=1,1 sesuai; <=1,3 agak cepat. */
export function pace(spent: number, limit: number, elapsedDays: number, totalDays: number): Pace {
  if (limit <= 0 || totalDays <= 0) return 'sesuai';
  const ratio = spent / limit / (elapsedDays / totalDays);
  if (ratio <= 1.1) return 'sesuai';
  if (ratio <= 1.3) return 'agak_cepat';
  return 'terlalu_cepat';
}

/** "Aman dibelanjakan" per hari = sisa anggaran / sisa hari (termasuk hari ini). */
export function safeToSpend(limit: number, spent: number, daysLeft: number): number {
  if (daysLeft <= 0) return 0;
  return Math.max(0, Math.floor((limit - spent) / daysLeft));
}

export type CategorySpend = { categoryKey: string; spent: number };

export function spendByCategory(txs: Transaction[], period: BudgetPeriod, main: string): CategorySpend[] {
  const map = new Map<string, number>();
  for (const tx of txInRange(txs, period.start, period.end)) {
    if (tx.type !== 'expense') continue;
    map.set(tx.categoryKey, (map.get(tx.categoryKey) ?? 0) + amountIn(tx, main));
  }
  return [...map.entries()].map(([categoryKey, spent]) => ({ categoryKey, spent }));
}

export function spendByBucket(byCategory: CategorySpend[]): Record<Bucket, number> {
  const out: Record<Bucket, number> = { needs: 0, wants: 0, savings: 0 };
  for (const c of byCategory) {
    const bucket = getCategory(c.categoryKey).bucket;
    if (bucket) out[bucket] += c.spent;
  }
  return out;
}

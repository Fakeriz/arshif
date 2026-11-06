import { getCategory, type Bucket } from '@/constants/categories';
import type { BudgetRecord, Transaction } from '@/data/types';

import { addDays, daysInMonth, diffDays, parseYMD, ymd } from './dates';
import { currencyMeta } from './money';
import { amountIn, countsAsSpending, txInRange } from './transactions';

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

/** Tanggal gajian yang bisa dipilih: 1-28 (ada di setiap bulan). */
export const PAYDAY_MIN = 1;
export const PAYDAY_MAX = 28;

function paydayIn(y: number, m: number, payday: number): string {
  return ymd(y, m, Math.min(payday, daysInMonth(y, m)));
}

/**
 * Bulan budget mengikuti tanggal gajian (FR-BDG-6): periode = tanggal gajian sampai sehari sebelum gajian
 * berikutnya (gajian 25: 25 Okt - 24 Nov). Gajian 1 = bulan kalender. Hari ini ikut dihitung sebagai hari berjalan.
 */
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

/** Ambang laju (FR-BDG-5). Dicatat juga di docs/fase7-enhancements.md. */
export const PACE_ON_TRACK_MAX = 1;
export const PACE_FAST_MAX = 1.2;

/** Rasio laju = (terpakai / anggaran) / (hari berjalan / total hari periode). null bila anggaran 0. */
export function paceRatio(spent: number, limit: number, elapsedDays: number, totalDays: number): number | null {
  if (limit <= 0 || totalDays <= 0 || elapsedDays <= 0) return null;
  return spent / limit / (elapsedDays / totalDays);
}

/** Rasio <= 1 Sesuai laju; 1 < rasio <= 1,2 Agak cepat; > 1,2 Terlalu cepat. */
export function pace(spent: number, limit: number, elapsedDays: number, totalDays: number): Pace {
  const ratio = paceRatio(spent, limit, elapsedDays, totalDays);
  if (ratio === null || ratio <= PACE_ON_TRACK_MAX) return 'sesuai';
  if (ratio <= PACE_FAST_MAX) return 'agak_cepat';
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
    // Reimbursement bukan belanja pengguna (FR-TRX-4).
    if (!countsAsSpending(tx)) continue;
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

// ---------------------------------------------------------------- anggaran per periode (FR-BDG-5)

/** Anggaran periode berjalan: baris tersimpan untuk periode ini, atau null (pakai penghasilan profil). */
export function budgetFor(records: BudgetRecord[], periodStart: string): BudgetRecord | null {
  return records.find((r) => r.periodStart === periodStart) ?? null;
}

/** Anggaran periode sebelum `periodStart`, terbaru dulu. */
export function previousBudgets(records: BudgetRecord[], periodStart: string, n: number): BudgetRecord[] {
  return records
    .filter((r) => r.periodStart < periodStart)
    .sort((a, b) => b.periodStart.localeCompare(a.periodStart))
    .slice(0, n);
}

export type BudgetDraft = { total: number; categoryLimits: Record<string, number> };

/** Salin anggaran periode lalu (total + per kategori) apa adanya. */
export function copyBudget(prev: BudgetRecord): BudgetDraft {
  return { total: prev.total, categoryLimits: { ...prev.categoryLimits } };
}

/** Pembulatan saran: Rp ke ribuan terdekat, mata uang berdesimal ke satuan utuh terdekat. */
export function roundSuggestion(minor: number, currency: string): number {
  const step = currencyMeta(currency).exponent === 0 ? 1000 : 100;
  return Math.round(minor / step) * step;
}

/**
 * Saran rata-rata 3 bulan: rata-rata anggaran (bukan belanja) dari hingga 3 periode terakhir yang tersimpan.
 * Kategori dirata-rata dari periode yang memberi batas pada kategori itu. null bila belum ada periode lalu.
 */
export function averageBudget(previous: BudgetRecord[], currency: string): BudgetDraft | null {
  const list = previous.slice(0, 3);
  if (list.length === 0) return null;
  const total = roundSuggestion(list.reduce((s, r) => s + r.total, 0) / list.length, currency);
  const sums = new Map<string, { sum: number; n: number }>();
  for (const r of list) {
    for (const [k, v] of Object.entries(r.categoryLimits)) {
      const cur = sums.get(k) ?? { sum: 0, n: 0 };
      sums.set(k, { sum: cur.sum + v, n: cur.n + 1 });
    }
  }
  const categoryLimits: Record<string, number> = {};
  for (const [k, { sum, n }] of sums) categoryLimits[k] = roundSuggestion(sum / n, currency);
  return { total, categoryLimits };
}

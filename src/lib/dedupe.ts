import type { Transaction } from '@/data/types';

import { diffDays } from './dates';

const words = (s: string): Set<string> =>
  new Set(s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length >= 3));

/** Kemiripan deskripsi 0–1 (irisan kata dibagi gabungan kata). */
export function similarity(a: string, b: string): number {
  const wa = words(a);
  const wb = words(b);
  if (wa.size === 0 || wb.size === 0) return 0;
  let shared = 0;
  wa.forEach((w) => {
    if (wb.has(w)) shared += 1;
  });
  return shared / (wa.size + wb.size - shared);
}

export type StatementRow = { date: string; description: string; amount: number; type: 'income' | 'expense' };

/** "Kemungkinan duplikat": tanggal ±1 hari, nominal sama, deskripsi mirip (FR-PDF-2). */
export function findDuplicate(row: StatementRow, existing: Transaction[], accountId: string): Transaction | null {
  return (
    existing.find(
      (tx) =>
        tx.accountId === accountId &&
        tx.type === row.type &&
        tx.amount === row.amount &&
        Math.abs(diffDays(tx.date, row.date)) <= 1 &&
        similarity(tx.merchant, row.description) >= 0.3,
    ) ?? null
  );
}

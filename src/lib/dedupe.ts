import type { Transaction } from '@/data/types';

import { diffDays } from './dates';

const words = (s: string): Set<string> =>
  new Set(
    s
      .replace(/[ıİ]/g, 'i')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 3),
  );

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

export type StatementRow = { date: string; description: string; amount: number; currency: string; type: 'income' | 'expense' };

/** "Kemungkinan duplikat": tanggal ±1 hari, nominal sama (atau `accountAmount` saat mata uang beda), deskripsi mirip (FR-PDF-2). */
export function findDuplicate(
  row: StatementRow,
  existing: Transaction[],
  accountId: string,
  usedIds?: Set<string>,
): Transaction | null {
  const hit =
    existing.find((tx) => {
      if (usedIds?.has(tx.id)) return false;
      if (tx.accountId !== accountId || tx.type !== row.type) return false;
      const sameAmount =
        (tx.currency === row.currency && tx.amount === row.amount) ||
        (tx.accountAmount !== undefined && tx.currency !== row.currency && tx.accountAmount === row.amount);
      return sameAmount && Math.abs(diffDays(tx.date, row.date)) <= 1 && similarity(tx.merchant, row.description) >= 0.3;
    }) ?? null;
  if (hit && usedIds) usedIds.add(hit.id);
  return hit;
}

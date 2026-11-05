import type { Bill } from '@/data/planning';
import { diffDays } from '@/lib/dates';

import { prevDue } from './schedule';

/** Kelompok tampilan tagihan. Urutan = urutan di layar. */
export const BILL_GROUPS = ['overdue', 'today', 'tomorrow', 'within3', 'thisWeek', 'later', 'paid'] as const;
export type BillGroup = (typeof BILL_GROUPS)[number];

/** Periode terakhir (sebelum jatuh tempo sekarang) sudah lunas. */
export function lastPeriodPaid(bill: Pick<Bill, 'dueDate' | 'frequency' | 'anchorDay' | 'paidPeriods'>): boolean {
  return bill.paidPeriods.includes(prevDue(bill.dueDate, bill.frequency, bill.anchorDay));
}

/**
 * Kelompok tagihan per hari ini. Jatuh tempo lewat = terlambat. Tagihan yang periode terakhirnya lunas dan
 * jatuh tempo berikutnya masih lebih dari 7 hari lagi = lunas; selebihnya menunggu dibayar.
 */
export function billGroup(bill: Pick<Bill, 'dueDate' | 'frequency' | 'anchorDay' | 'paidPeriods'>, today: string): BillGroup {
  const days = diffDays(bill.dueDate, today);
  if (days < 0) return 'overdue';
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days <= 3) return 'within3';
  if (days <= 7) return 'thisWeek';
  return lastPeriodPaid(bill) ? 'paid' : 'later';
}

export const isPaidGroup = (g: BillGroup): boolean => g === 'paid';

/**
 * Status tanggal jatuh tempo di kalender. Periode sebelum jatuh tempo sekarang yang tidak tercatat lunas
 * = sebelum tagihan dibuat: tidak ditampilkan (null).
 */
export function dayStatus(bill: Pick<Bill, 'dueDate' | 'paidPeriods'>, day: string, today: string): 'paid' | 'overdue' | 'upcoming' | null {
  if (bill.paidPeriods.includes(day)) return 'paid';
  if (diffDays(day, bill.dueDate) < 0) return null;
  return diffDays(day, today) < 0 ? 'overdue' : 'upcoming';
}

import type { Transaction } from '@/data/types';

import { addDays, weekday } from './dates';
import { amountIn, txInRange } from './transactions';

export type WeeklyRecap = {
  start: string;
  end: string;
  spent: number;
  previousSpent: number;
  /** Persen perubahan dibanding minggu sebelumnya; null bila minggu sebelumnya kosong. */
  changePct: number | null;
  topCategoryKey: string | null;
  topCategorySpent: number;
  biggest: Transaction | null;
  /** Jumlah hari tanpa pengeluaran dari 7 hari. */
  noSpendDays: number;
  txCount: number;
};

/** Minggu = Senin–Minggu. Recap menutup minggu terakhir yang sudah selesai sebelum `today`. */
export function lastFullWeek(today: string): { start: string; end: string } {
  const dow = weekday(today); // 0 = Minggu
  const sinceMonday = (dow + 6) % 7;
  const thisMonday = addDays(today, -sinceMonday);
  return { start: addDays(thisMonday, -7), end: addDays(thisMonday, -1) };
}

export function weeklyRecap(txs: Transaction[], today: string, main: string): WeeklyRecap {
  const { start, end } = lastFullWeek(today);
  const week = txInRange(txs, start, end).filter((t) => t.type === 'expense');
  const prev = txInRange(txs, addDays(start, -7), addDays(start, -1)).filter((t) => t.type === 'expense');
  const sum = (list: Transaction[]) => list.reduce((s, t) => s + amountIn(t, main), 0);
  const spent = sum(week);
  const previousSpent = sum(prev);

  const byCat = new Map<string, number>();
  for (const t of week) byCat.set(t.categoryKey, (byCat.get(t.categoryKey) ?? 0) + amountIn(t, main));
  const top = [...byCat.entries()].sort((a, b) => b[1] - a[1])[0];

  const biggest = week.reduce<Transaction | null>((best, t) => (!best || amountIn(t, main) > amountIn(best, main) ? t : best), null);
  const daysWithSpend = new Set(week.map((t) => t.date)).size;

  return {
    start,
    end,
    spent,
    previousSpent,
    changePct: previousSpent > 0 ? Math.round(((spent - previousSpent) / previousSpent) * 100) : null,
    topCategoryKey: top ? top[0] : null,
    topCategorySpent: top ? top[1] : 0,
    biggest,
    noSpendDays: 7 - daysWithSpend,
    txCount: week.length,
  };
}


import type { Transaction } from '@/data/types';

import { addDays, daysInMonth, diffDays, parseYMD, weekday, ymd } from './dates';
import { amountIn, countsAsSpending, txInRange } from './transactions';

/** Pencapaian minggu itu. Label: `coach.replay.achievement.<key>`. */
export type Achievement = 'noSpend' | 'spentLess' | 'saved' | 'debtPaid' | 'cooked';

export type WeeklyRecap = {
  /** 'this' = minggu berjalan (Senin sampai hari ini), 'last' = minggu lalu penuh, 'month' = bulan lalu penuh. */
  week: 'this' | 'last' | 'month';
  start: string;
  end: string;
  /** Jumlah hari di jendela (minggu berjalan: 1-7). */
  days: number;
  spent: number;
  /** Belanja di rentang yang sama minggu sebelumnya (minggu berjalan: Senin sampai hari yang sama). */
  previousSpent: number;
  /** Persen perubahan dibanding minggu sebelumnya; null bila minggu sebelumnya kosong. */
  changePct: number | null;
  topCategoryKey: string | null;
  topCategorySpent: number;
  /** Belanja terbesar minggu itu. */
  biggest: Transaction | null;
  /** Hemat terbesar: kategori yang turun paling banyak dibanding minggu sebelumnya. */
  biggestSaving: { categoryKey: string; saved: number } | null;
  /** Hari tanpa pengeluaran di jendela. */
  noSpendDays: number;
  txCount: number;
  achievements: Achievement[];
  /** Setoran tabungan/goal minggu itu (kategori Tabungan). */
  savedAmount: number;
  /** Pembayaran utang minggu itu (kategori Utang). */
  debtPaid: number;
};

/** Minggu = Senin-Minggu. Minggu lalu penuh sebelum `today`. */
export function lastFullWeek(today: string): { start: string; end: string } {
  const thisMonday = mondayOf(today);
  return { start: addDays(thisMonday, -7), end: addDays(thisMonday, -1) };
}

export function mondayOf(day: string): string {
  return addDays(day, -((weekday(day) + 6) % 7));
}

const SAVINGS_KEYS = new Set(['savings']);
const DEBT_KEYS = new Set(['debt']);
const FOOD_OUT = new Set(['food', 'hangout']);

/**
 * Weekly Replay (FR-COACH-5). Minggu berjalan dibandingkan dengan rentang hari yang sama minggu sebelumnya
 * (Senin-Rabu vs Senin-Rabu), jadi angkanya adil di tengah minggu. Reimbursement tidak dihitung (FR-TRX-4).
 * Setoran tabungan dan bayar utang dihitung sebagai pencapaian, bukan belanja yang disorot.
 */
export function weeklyRecap(txs: Transaction[], today: string, main: string, week: 'this' | 'last' = 'last'): WeeklyRecap {
  const start = week === 'this' ? mondayOf(today) : lastFullWeek(today).start;
  const end = week === 'this' ? today : addDays(start, 6);
  return buildRecap(txs, main, week, start, end, addDays(start, -7), addDays(end, -7));
}

/**
 * Recap bulanan (Premium): bulan kalender lalu penuh, dibanding bulan sebelumnya penuh. Aturan sama dengan
 * Weekly Replay (reimbursement, tabungan, dan bayar utang tidak dihitung sebagai belanja yang disorot).
 */
export function monthlyRecap(txs: Transaction[], today: string, main: string): WeeklyRecap {
  const { y, m } = parseYMD(today);
  const last = m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 };
  const before = last.m === 1 ? { y: last.y - 1, m: 12 } : { y: last.y, m: last.m - 1 };
  return buildRecap(
    txs, main, 'month',
    ymd(last.y, last.m, 1), ymd(last.y, last.m, daysInMonth(last.y, last.m)),
    ymd(before.y, before.m, 1), ymd(before.y, before.m, daysInMonth(before.y, before.m)),
  );
}

function buildRecap(txs: Transaction[], main: string, week: WeeklyRecap['week'], start: string, end: string, prevStart: string, prevEnd: string): WeeklyRecap {
  const days = diffDays(end, start) + 1;
  const spending = (a: string, b: string) => txInRange(txs, a, b).filter(countsAsSpending);
  const all = spending(start, end);
  const prevAll = spending(prevStart, prevEnd);
  // Yang disorot sebagai "belanja": tanpa setoran tabungan dan bayar utang.
  const isConsumption = (t: Transaction) => !SAVINGS_KEYS.has(t.categoryKey) && !DEBT_KEYS.has(t.categoryKey);
  const cur = all.filter(isConsumption);
  const prev = prevAll.filter(isConsumption);
  const sum = (list: Transaction[]) => list.reduce((s, t) => s + amountIn(t, main), 0);
  const spent = sum(cur);
  const previousSpent = sum(prev);

  const byCat = (list: Transaction[]) => {
    const m = new Map<string, number>();
    for (const t of list) m.set(t.categoryKey, (m.get(t.categoryKey) ?? 0) + amountIn(t, main));
    return m;
  };
  const curCat = byCat(cur);
  const prevCat = byCat(prev);
  const top = [...curCat.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];

  let biggestSaving: WeeklyRecap['biggestSaving'] = null;
  for (const [k, before] of prevCat) {
    const saved = before - (curCat.get(k) ?? 0);
    if (saved > 0 && (!biggestSaving || saved > biggestSaving.saved)) biggestSaving = { categoryKey: k, saved };
  }

  const biggest = cur.reduce<Transaction | null>((best, t) => (!best || amountIn(t, main) > amountIn(best, main) ? t : best), null);
  const noSpendDays = days - new Set(cur.map((t) => t.date)).size;
  const savedAmount = sum(all.filter((t) => SAVINGS_KEYS.has(t.categoryKey)));
  const debtPaid = sum(all.filter((t) => DEBT_KEYS.has(t.categoryKey)));
  const changePct = previousSpent > 0 ? Math.round(((spent - previousSpent) / previousSpent) * 100) : null;

  const achievements: Achievement[] = [];
  if (cur.length > 0 && noSpendDays > 0) achievements.push('noSpend');
  if (changePct !== null && changePct < 0) achievements.push('spentLess');
  if (savedAmount > 0) achievements.push('saved');
  if (debtPaid > 0) achievements.push('debtPaid');
  const eatOut = (m: Map<string, number>) => [...FOOD_OUT].reduce((s, k) => s + (m.get(k) ?? 0), 0);
  if (prevCat.size > 0 && eatOut(prevCat) > 0 && eatOut(curCat) < eatOut(prevCat)) achievements.push('cooked');

  return {
    week,
    start,
    end,
    days,
    spent,
    previousSpent,
    changePct,
    topCategoryKey: top ? top[0] : null,
    topCategorySpent: top ? top[1] : 0,
    biggest,
    biggestSaving,
    noSpendDays,
    txCount: all.length,
    achievements,
    savedAmount,
    debtPaid,
  };
}

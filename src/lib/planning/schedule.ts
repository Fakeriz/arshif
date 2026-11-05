import { addDays, daysInMonth, diffDays, parseYMD, ymd } from '@/lib/dates';

export type Frequency = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

const MONTHS: Record<Exclude<Frequency, 'weekly'>, number> = { monthly: 1, quarterly: 3, yearly: 12 };

function shiftMonths(date: string, months: number, anchor: number): string {
  const { y, m } = parseYMD(date);
  const idx = y * 12 + (m - 1) + months;
  const ny = Math.floor(idx / 12);
  const nm = (idx % 12) + 1;
  return ymd(ny, nm, Math.min(anchor, daysInMonth(ny, nm)));
}

/** Jatuh tempo berikutnya. Sama dengan public.next_due di SQL: hari jangkar 31 jadi 28/30 di bulan pendek lalu kembali. */
export function nextDue(date: string, freq: Frequency, anchor: number): string {
  return freq === 'weekly' ? addDays(date, 7) : shiftMonths(date, MONTHS[freq], anchor);
}

/** Jatuh tempo periode sebelumnya (kebalikan nextDue). */
export function prevDue(date: string, freq: Frequency, anchor: number): string {
  return freq === 'weekly' ? addDays(date, -7) : shiftMonths(date, -MONTHS[freq], anchor);
}

/** Semua tanggal jatuh tempo (masa lalu dan depan) di bulan y-m, dari satu tanggal acuan. */
export function occurrencesInMonth(date: string, freq: Frequency, anchor: number, y: number, m: number): string[] {
  const start = ymd(y, m, 1);
  const end = ymd(y, m, daysInMonth(y, m));
  let d = date;
  let guard = 0;
  while (diffDays(d, start) > 0 && guard++ < 600) d = prevDue(d, freq, anchor);
  while (diffDays(d, start) < 0 && guard++ < 1200) d = nextDue(d, freq, anchor);
  const out: string[] = [];
  while (diffDays(d, end) <= 0 && guard++ < 1300) {
    out.push(d);
    d = nextDue(d, freq, anchor);
  }
  return out;
}

/** Jumlah bulan kalender tersisa sampai tenggat (minimal 1: bulan ini masih bisa menabung). */
export function monthsUntil(today: string, deadline: string): number {
  const a = parseYMD(today);
  const b = parseYMD(deadline);
  return Math.max(1, (b.y - a.y) * 12 + (b.m - a.m) - (b.d < a.d ? 1 : 0));
}

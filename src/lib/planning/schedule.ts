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
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return [];
  const start = ymd(y, m, 1);
  const end = ymd(y, m, daysInMonth(y, m));
  let d = date;
  const stepMonths = (MONTHS as Record<string, number | undefined>)[freq];
  if (stepMonths && stepMonths > 0) {
    const dy = Number(date.slice(0, 4));
    const dm = Number(date.slice(5, 7));
    if (Number.isFinite(dy) && Number.isFinite(dm)) {
      const steps = Math.trunc(((y - dy) * 12 + (m - dm)) / stepMonths);
      if (steps !== 0) d = shiftMonths(date, steps * stepMonths, anchor);
    }
  } else {
    const stepDays = diffDays(nextDue(date, freq, anchor), date);
    if (stepDays > 0) {
      const steps = Math.trunc(diffDays(start, date) / stepDays);
      if (steps !== 0) {
        const baseMs = Date.parse(`${date}T00:00:00Z`);
        if (Number.isFinite(baseMs)) {
          d = new Date(baseMs + steps * stepDays * 86_400_000).toISOString().slice(0, 10);
        }
      }
    }
  }
  let guard = 0;
  while (diffDays(d, start) > 0 && guard++ < 600) {
    const prev = prevDue(d, freq, anchor);
    if (diffDays(d, prev) <= 0) break;
    d = prev;
  }
  while (diffDays(d, start) < 0 && guard++ < 1200) {
    const nxt = nextDue(d, freq, anchor);
    if (diffDays(nxt, d) <= 0) break;
    d = nxt;
  }
  const out: string[] = [];
  while (diffDays(d, end) <= 0 && guard++ < 1300) {
    if (diffDays(d, start) >= 0) out.push(d);
    const nxt = nextDue(d, freq, anchor);
    if (diffDays(nxt, d) <= 0) break;
    d = nxt;
  }
  return out;
}

/** Jumlah bulan kalender tersisa sampai tenggat (minimal 1: bulan ini masih bisa menabung). */
export function monthsUntil(today: string, deadline: string): number {
  const a = parseYMD(today);
  const b = parseYMD(deadline);
  return Math.max(1, (b.y - a.y) * 12 + (b.m - a.m) - (b.d < a.d ? 1 : 0));
}

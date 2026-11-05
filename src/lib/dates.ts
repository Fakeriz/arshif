import { CALENDARS } from '@/i18n/calendar';
import { translate } from '@/i18n/translate';
import type { Lang } from '@/i18n/types';

/**
 * Tanggal transaksi disimpan sebagai teks "YYYY-MM-DD" (tanpa zona waktu) agar hasilnya
 * sama di semua perangkat. Fase 2: tanggal absolut dari server mengikuti zona waktu pengguna.
 */
export const DEMO_TODAY = '2026-11-05';

const DAY_MS = 86_400_000;

export type YMD = { y: number; m: number; d: number };

export function parseYMD(s: string): YMD {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) throw new Error(`Tanggal harus YYYY-MM-DD: ${s}`);
  return { y: +m[1], m: +m[2], d: +m[3] };
}

export function dayNumber(s: string): number {
  const { y, m, d } = parseYMD(s);
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
}

export function diffDays(a: string, b: string): number {
  return dayNumber(a) - dayNumber(b);
}

export function addDays(s: string, n: number): string {
  return new Date((dayNumber(s) + n) * DAY_MS).toISOString().slice(0, 10);
}

/** 0 = Minggu … 6 = Sabtu */
export function weekday(s: string): number {
  return new Date(dayNumber(s) * DAY_MS).getUTCDay();
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function ymd(y: number, m: number, d: number): string {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

export function monthName(m: number, lang: Lang): string {
  return CALENDARS[lang].months[m - 1];
}

/** "Hari ini", "Kemarin", atau "29 Okt" (+ tahun bila beda tahun). */
export function dayLabel(s: string, lang: Lang, today: string = DEMO_TODAY): string {
  const diff = diffDays(today, s);
  if (diff === 0) return translate(lang, 'domain.date.today');
  if (diff === 1) return translate(lang, 'domain.date.yesterday');
  const { y, m, d } = parseYMD(s);
  const base = `${d} ${CALENDARS[lang].monthsShort[m - 1]}`;
  return y === parseYMD(today).y ? base : `${base} ${y}`;
}

/** "Kamis, 5 November 2026" · "Thursday, 5 November 2026" · "5 Kasım 2026 Perşembe" */
export function dayLong(s: string, lang: Lang): string {
  const { y, m, d } = parseYMD(s);
  const c = CALENDARS[lang];
  const date = `${d} ${c.months[m - 1]} ${y}`;
  return lang === 'tr' ? `${date} ${c.days[weekday(s)]}` : `${c.days[weekday(s)]}, ${date}`;
}

/** "25 Okt" */
export function shortDate(s: string, lang: Lang): string {
  const { m, d } = parseYMD(s);
  return `${d} ${CALENDARS[lang].monthsShort[m - 1]}`;
}

/** Kunci salam `domain.greeting.<key>` menurut jam. */
export function greetingKey(hour: number): 'morning' | 'afternoon' | 'evening' | 'night' {
  if (hour < 11) return 'morning';
  if (hour < 15) return 'afternoon';
  if (hour < 19) return 'evening';
  return 'night';
}

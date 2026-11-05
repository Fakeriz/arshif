/**
 * Tanggal transaksi disimpan sebagai teks "YYYY-MM-DD" (tanpa zona waktu) agar hasilnya
 * sama di semua perangkat. Fase 2: tanggal absolut dari server mengikuti zona waktu pengguna.
 */
export const DEMO_TODAY = '2026-11-05';

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
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

export function monthName(m: number): string {
  return MONTHS[m - 1];
}

export function dayLabel(s: string, today: string = DEMO_TODAY): string {
  const diff = diffDays(today, s);
  if (diff === 0) return 'Hari ini';
  if (diff === 1) return 'Kemarin';
  const { y, m, d } = parseYMD(s);
  const base = `${d} ${MONTHS_SHORT[m - 1]}`;
  return y === parseYMD(today).y ? base : `${base} ${y}`;
}

export function dayLong(s: string): string {
  const { y, m, d } = parseYMD(s);
  return `${DAYS[weekday(s)]}, ${d} ${MONTHS[m - 1]} ${y}`;
}

/** "25 Okt" */
export function shortDate(s: string): string {
  const { m, d } = parseYMD(s);
  return `${d} ${MONTHS_SHORT[m - 1]}`;
}

export function greeting(hour: number): string {
  if (hour < 11) return 'Selamat pagi';
  if (hour < 15) return 'Selamat siang';
  if (hour < 19) return 'Selamat sore';
  return 'Selamat malam';
}

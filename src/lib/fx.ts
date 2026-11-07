import { convertMinor, rateToScaled } from './money';

/** Kurs contoh per 1 USD: hanya untuk test dan Lembar Desain. Aplikasi memakai tabel live (setUsdRates). */
export const SAMPLE_USD_RATES: Record<string, string> = {
  USD: '1',
  IDR: '16250',
  MYR: '4.28',
  TRY: '43.5',
  SGD: '1.31',
  EUR: '0.86',
};

/**
 * Aturan kurs (FR-FX-4):
 * - Saldo dan kekayaan bersih memakai kurs hari ini (tabel terbaru, `setUsdRates`).
 * - Belanja/pemasukan memakai kurs PADA HARINYA (riwayat harian, `setRateHistory`), jadi angka transaksi lama
 *   tidak ikut bergerak saat kurs berubah.
 * - "Kurs saya" (`setUserRates`) hanya dipakai untuk kode yang tidak punya kurs harian sama sekali.
 * - Tidak ada keduanya = kurs hilang. Tidak ada kurs lain yang dipakai diam-diam: konversi melempar
 *   `MissingRateError`, agregat mengecualikan nominalnya dan layar meminta pengguna mengisi kurs.
 */
let liveRates: Record<string, string> = { USD: '1' };
let liveRatesDate: string | null = null;
/** Per kode: tanggal naik + kurs per USD pada tanggal itu. */
let history = new Map<string, { dates: string[]; rates: string[] }>();
export type UserRate = { code: string; base: string; rate: string };
let userRates: Record<string, UserRate> = {};

export function setUsdRates(table: Record<string, string>, date: string | null): void {
  liveRates = { ...table, USD: '1' };
  liveRatesDate = date;
}

export type RateRow = { date: string; code: string; perUsd: string };

/** Riwayat kurs harian. Baris boleh tidak urut; baris dengan tanggal sama ditimpa yang terakhir. */
export function setRateHistory(rows: RateRow[]): void {
  history = mergeHistory(new Map(), rows);
}

/** Tambah riwayat (mis. kode baru setelah transaksi mata uang lain dicatat). */
export function addRateHistory(rows: RateRow[]): void {
  history = mergeHistory(history, rows);
}

function mergeHistory(base: Map<string, { dates: string[]; rates: string[] }>, rows: RateRow[]) {
  const byCode = new Map<string, Map<string, string>>();
  for (const [code, h] of base) byCode.set(code, new Map(h.dates.map((d, i) => [d, h.rates[i]!])));
  for (const r of rows) {
    if (!byCode.has(r.code)) byCode.set(r.code, new Map());
    byCode.get(r.code)!.set(r.date, r.perUsd);
  }
  const out = new Map<string, { dates: string[]; rates: string[] }>();
  for (const [code, m] of byCode) {
    const dates = [...m.keys()].sort();
    out.set(code, { dates, rates: dates.map((d) => m.get(d)!) });
  }
  return out;
}

export function historyCodes(): string[] {
  return [...history.keys()];
}

export function setUserRates(list: UserRate[]): void {
  userRates = Object.fromEntries(list.map((r) => [r.code, r]));
}

/** Tanggal kurs yang sedang dipakai ("Kurs per …", FR-FX-2). null = belum ada kurs. */
export function usdRatesDate(): string | null {
  return liveRatesDate;
}

export class MissingRateError extends Error {
  constructor(readonly code: string) {
    super(`Kurs tidak tersedia untuk ${code}`);
  }
}

/** Ada kurs harian (feed) untuk kode ini, terlepas dari tanggal. */
export function hasDailyRate(code: string): boolean {
  return code === 'USD' || code in liveRates || history.has(code);
}

/** Kurs harian per USD pada `date`: tanggal terakhir <= date; sebelum riwayat mulai = kurs paling awal. */
function dailyOn(code: string, date: string | null): string | null {
  if (code === 'USD') return '1';
  if (date === null) return liveRates[code] ?? lastOf(code);
  const h = history.get(code);
  if (!h || h.dates.length === 0) return liveRates[code] ?? null;
  let lo = 0;
  let hi = h.dates.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (h.dates[mid]! <= date) {
      found = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return h.rates[found === -1 ? 0 : found]!;
}

function lastOf(code: string): string | null {
  const h = history.get(code);
  return h && h.rates.length ? h.rates[h.rates.length - 1]! : null;
}

const SCALE = BigInt(1_000_000_000_000);

function fromScaled(q: bigint): string {
  const whole = q / SCALE;
  const frac = (q % SCALE).toString().padStart(12, '0');
  return `${whole}.${frac}`;
}

/** Kurs per USD untuk `code` pada tanggal (null = hari ini). Harian dulu, lalu "Kurs saya", lalu null. */
export function perUsd(code: string, date: string | null = null, depth = 0): string | null {
  if (hasDailyRate(code)) return dailyOn(code, date);
  const own = userRates[code];
  if (!own || depth > 0) return null;
  // 1 code = rate base  ->  per_usd(code) = per_usd(base) / rate
  const base = perUsd(own.base, date, depth + 1);
  if (!base) return null;
  return fromScaled((rateToScaled(base) * SCALE) / rateToScaled(own.rate));
}

/** Ada kurs yang bisa dipakai (harian atau "Kurs saya"). */
export function hasRate(code: string, table?: Record<string, string>): boolean {
  if (table) return code in table || code === 'USD';
  return perUsd(code) !== null;
}

/** Kode yang belum punya kurs harian maupun "Kurs saya". */
export function missingRates(codes: Iterable<string>): string[] {
  return [...new Set(codes)].filter((c) => !hasRate(c)).sort();
}

/** Kurs silang `to` per 1 `from` lewat USD, 12 desimal, tanpa float. */
export function crossRate(from: string, to: string, table?: Record<string, string>, date: string | null = null): string {
  if (from === to) return '1';
  const f = table ? (from === 'USD' ? '1' : table[from]) : perUsd(from, date);
  const t = table ? (to === 'USD' ? '1' : table[to]) : perUsd(to, date);
  if (!f) throw new MissingRateError(from);
  if (!t) throw new MissingRateError(to);
  return fromScaled((rateToScaled(t) * SCALE) / rateToScaled(f));
}

/** Konversi dengan kurs hari ini (saldo), atau dengan `table` yang diberikan. */
export function convert(minor: number, from: string, to: string, table?: Record<string, string>): number {
  if (from === to) return minor;
  return convertMinor(minor, from, to, crossRate(from, to, table));
}

/** Konversi dengan kurs pada tanggal itu (belanja/pemasukan, FR-FX-4). */
export function convertOn(minor: number, from: string, to: string, date: string): number {
  if (from === to) return minor;
  return convertMinor(minor, from, to, crossRate(from, to, undefined, date));
}

/** Seperti convert/convertOn, tapi null bila kurs hilang (untuk agregat). */
export function tryConvert(minor: number, from: string, to: string, date: string | null = null): number | null {
  try {
    return date ? convertOn(minor, from, to, date) : convert(minor, from, to);
  } catch (e) {
    if (e instanceof MissingRateError) return null;
    throw e;
  }
}

/** Lengkapi tabel kurs server dengan "Kurs saya" untuk kode yang tidak ada di tabel itu. */
export function withUserRates(table: Record<string, string>, date: string | null): Record<string, string> {
  const out: Record<string, string> = { ...table, USD: '1' };
  for (const r of Object.values(userRates)) {
    if (out[r.code]) continue;
    const base = r.base === 'USD' ? '1' : (out[r.base] ?? perUsd(r.base, date, 1));
    if (base) out[r.code] = fromScaled((rateToScaled(base) * SCALE) / rateToScaled(r.rate));
  }
  return out;
}

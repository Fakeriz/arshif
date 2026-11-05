/**
 * Konversi nominal dari AI (string desimal, unit besar) ke integer unit terkecil, tanpa float.
 * AI diminta menulis angka polos dengan titik desimal: "45000", "12.50". Format lain ditolak (null)
 * supaya tidak ada tebakan pemisah ribuan yang diam-diam salah.
 * Murni: tanpa API Deno/Node supaya bisa diuji jest.
 */

/** Jumlah digit desimal per mata uang. Harus sama dengan src/lib/money.ts CURRENCIES (dicek tes). */
export const EXPONENTS: Record<string, number> = {
  IDR: 0, MYR: 2, TRY: 2, USD: 2, EUR: 2, SGD: 2, GBP: 2, SAR: 2, JPY: 0, AUD: 2,
};

export function exponentOf(code: string): number {
  return EXPONENTS[code.toUpperCase()] ?? 2;
}

/** "12.50" MYR -> 1250; "45000" IDR -> 45000; "12.505" MYR -> 1251 (pembulatan setengah ke atas). */
export function decimalToMinor(value: string | number | null | undefined, currency: string): number | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim().replace(/^\+/, '');
  if (!/^-?\d{1,15}(\.\d{1,6})?$/.test(s)) return null;
  const negative = s.startsWith('-');
  const [whole, frac = ''] = s.replace('-', '').split('.');
  const exp = exponentOf(currency);
  // IDR/JPY tanpa desimal: "45.000" hampir pasti pemisah ribuan, bukan 45. Ambigu = tolak.
  if (exp === 0 && frac.length === 3) return null;
  const kept = (frac + '0'.repeat(exp)).slice(0, exp);
  const next = frac.length > exp ? Number(frac[exp]) : 0;
  let minor = BigInt(whole) * BigInt(10) ** BigInt(exp) + BigInt(kept || '0');
  if (next >= 5) minor += BigInt(1);
  if (minor > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  const n = Number(minor);
  return negative ? -n : n;
}

/** Nominal positif atau null (untuk total/subtotal/item). */
export function positiveMinor(value: string | number | null | undefined, currency: string): number | null {
  const n = decimalToMinor(value, currency);
  return n === null || n <= 0 ? null : n;
}

/** Nominal >= 0 atau null (pajak/diskon boleh 0). */
export function nonNegativeMinor(value: string | number | null | undefined, currency: string): number | null {
  const n = decimalToMinor(value, currency);
  return n === null || n < 0 ? null : Math.abs(n);
}

/** Tebak ISO 4217 dari simbol bila AI mengembalikan simbol, bukan kode. */
export function normalizeCurrency(raw: string | null | undefined, fallback: string): string {
  const s = (raw ?? '').trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(s) && s !== 'RPS') return s;
  if (s.startsWith('RP')) return 'IDR';
  if (s === 'RM') return 'MYR';
  if (s === '₺' || s === 'TL') return 'TRY';
  if (s === '$' || s === 'US$') return 'USD';
  if (s === 'S$') return 'SGD';
  if (s === '€') return 'EUR';
  return fallback;
}

/** Ganti em/en dash di teks AI (antislop R-02) dan rapikan spasi. */
export function cleanText(s: string): string {
  return s.replace(/\s*[—–]\s*/g, ', ').replace(/\s+/g, ' ').trim();
}

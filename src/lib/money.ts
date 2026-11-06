/**
 * Helper uang Arshif. Nominal SELALU integer unit terkecil (minor units) — tidak pernah float.
 * Format deterministik per mata uang (tidak bergantung ICU perangkat):
 *   Rp 45.000 · RM 12.50 · ₺350,00 · $9.99
 */

export type CurrencyMeta = {
  code: string;
  symbol: string;
  exponent: number;
  decimal: string;
  group: string;
  spaceAfterSymbol: boolean;
  name: string;
};

const meta = (
  code: string,
  symbol: string,
  exponent: number,
  decimal: string,
  group: string,
  spaceAfterSymbol: boolean,
  name: string,
): CurrencyMeta => ({ code, symbol, exponent, decimal, group, spaceAfterSymbol, name });

export const CURRENCIES: Record<string, CurrencyMeta> = {
  IDR: meta('IDR', 'Rp', 0, ',', '.', true, 'Rupiah Indonesia'),
  MYR: meta('MYR', 'RM', 2, '.', ',', true, 'Ringgit Malaysia'),
  TRY: meta('TRY', '₺', 2, ',', '.', false, 'Lira Turki'),
  USD: meta('USD', '$', 2, '.', ',', false, 'Dolar AS'),
  EUR: meta('EUR', '€', 2, ',', '.', false, 'Euro'),
  SGD: meta('SGD', 'S$', 2, '.', ',', false, 'Dolar Singapura'),
  GBP: meta('GBP', '£', 2, '.', ',', false, 'Pound Sterling'),
  SAR: meta('SAR', 'SAR', 2, '.', ',', true, 'Riyal Saudi'),
  JPY: meta('JPY', '¥', 0, '.', ',', false, 'Yen Jepang'),
  AUD: meta('AUD', 'A$', 2, '.', ',', false, 'Dolar Australia'),
  // Tanpa kurs harian ECB (AED, BND, VND, SAR): dipakai lewat "Kurs saya" (FR-FX-4).
  AED: meta('AED', 'AED', 2, '.', ',', true, 'Dirham Uni Emirat Arab'),
  BND: meta('BND', 'B$', 2, '.', ',', false, 'Dolar Brunei'),
  THB: meta('THB', '฿', 2, '.', ',', false, 'Baht Thailand'),
  CNY: meta('CNY', 'CN¥', 2, '.', ',', false, 'Yuan Tiongkok'),
  KRW: meta('KRW', '₩', 0, '.', ',', false, 'Won Korea Selatan'),
  VND: meta('VND', '₫', 0, ',', '.', true, 'Dong Vietnam'),
};

/** IDR/MYR/TRY/USD dipin di atas pemilih mata uang (FR-FX-1). */
export const PINNED_CURRENCIES = ['IDR', 'MYR', 'TRY', 'USD'] as const;

export function currencyMeta(code: string): CurrencyMeta {
  const upper = code.toUpperCase();
  return CURRENCIES[upper] ?? meta(upper, upper, 2, '.', ',', true, upper);
}

const MINUS = '−';

export function groupDigits(digits: string, sep: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
}

export type SignMode = 'auto' | 'always' | 'never';

/** Format angka saja (tanpa simbol), mis. 4500000 IDR → "4.500.000". */
export function formatNumber(minor: number, code: string): string {
  assertMinor(minor);
  const m = currencyMeta(code);
  const abs = Math.abs(minor).toString().padStart(m.exponent + 1, '0');
  const intPart = abs.slice(0, abs.length - m.exponent) || '0';
  const frac = m.exponent > 0 ? abs.slice(abs.length - m.exponent) : '';
  const grouped = groupDigits(intPart, m.group);
  return frac ? `${grouped}${m.decimal}${frac}` : grouped;
}

export function formatMoney(minor: number, code: string, sign: SignMode = 'auto'): string {
  const m = currencyMeta(code);
  const body = `${m.symbol}${m.spaceAfterSymbol ? ' ' : ''}${formatNumber(minor, code)}`;
  if (sign === 'never' || minor === 0) return body;
  if (minor < 0) return `${MINUS}${body}`;
  return sign === 'always' ? `+${body}` : body;
}

export type MoneyParts = {
  sign: string;
  symbol: string;
  /** Bagian bulat dengan pemisah ribuan, tanpa simbol. */
  whole: string;
  /** Pemisah desimal + pecahan (mis. ".09"), kosong untuk mata uang tanpa desimal. */
  fraction: string;
  /** Spasi setelah simbol bila konvensi mata uangnya begitu. */
  gap: string;
};

/** Pecah nominal untuk saldo besar: pecahan desimal ditampilkan redup (PRD Bab 11). */
export function formatMoneyParts(minor: number, code: string, sign: SignMode = 'auto'): MoneyParts {
  const m = currencyMeta(code);
  const number = formatNumber(minor, code);
  const cut = m.exponent > 0 ? number.lastIndexOf(m.decimal) : -1;
  return {
    sign: sign === 'never' || minor === 0 ? '' : minor < 0 ? MINUS : sign === 'always' ? '+' : '',
    symbol: m.symbol,
    whole: cut >= 0 ? number.slice(0, cut) : number,
    fraction: cut >= 0 ? number.slice(cut) : '',
    gap: m.spaceAfterSymbol ? ' ' : '',
  };
}

/** Format ringkas untuk sumbu grafik: 1,2 jt · 450 rb · 12.5k. */
export function formatCompact(minor: number, code: string): string {
  assertMinor(minor);
  const m = currencyMeta(code);
  const major = Math.abs(minor) / Math.pow(10, m.exponent);
  const neg = minor < 0 ? MINUS : '';
  const idStyle = m.code === 'IDR';
  const units: [number, string][] = idStyle
    ? [[1e12, ' T'], [1e9, ' M'], [1e6, ' jt'], [1e3, ' rb']]
    : [[1e9, 'B'], [1e6, 'M'], [1e3, 'k']];
  for (const [size, suffix] of units) {
    if (major >= size) {
      const v = Math.round((major / size) * 10) / 10;
      const text = Number.isInteger(v) ? String(v) : v.toFixed(1).replace('.', m.decimal);
      return `${neg}${text}${suffix}`;
    }
  }
  return `${neg}${Math.round(major)}`;
}

/**
 * Parse teks input pengguna menjadi minor units. Mengembalikan null jika tidak valid.
 * Untuk mata uang berdesimal: pemisah terakhir dianggap desimal bila diikuti 1–2 digit.
 */
export function parseAmountInput(text: string, code: string): number | null {
  const m = currencyMeta(code);
  const cleaned = text.replace(/[^\d.,]/g, '');
  if (!/\d/.test(cleaned)) return null;
  let intDigits = cleaned;
  let fracDigits = '';
  if (m.exponent > 0) {
    const match = /^(.*)[.,](\d{1,2})$/.exec(cleaned);
    if (match) {
      intDigits = match[1];
      fracDigits = match[2];
    }
  }
  intDigits = intDigits.replace(/[.,]/g, '') || '0';
  const minorStr = intDigits + fracDigits.padEnd(m.exponent, '0');
  const value = Number(minorStr);
  return Number.isSafeInteger(value) ? value : null;
}

/**
 * Teks yang sedang diketik → teks tampilan dengan pemisah ribuan.
 * Hanya karakter desimal milik mata uang yang dianggap desimal, sehingga
 * menghapus digit dari "1,234" (MYR) tidak berubah jadi desimal "1,23".
 * `justTypedSeparator` = pengguna baru saja mengetik "." atau "," di akhir.
 */
export function formatTypedAmount(typed: string, code: string, justTypedSeparator = false): string {
  const m = currencyMeta(code);
  let input = typed.replace(/[^\d.,]/g, '');
  if (justTypedSeparator && m.exponent > 0 && /[.,]$/.test(input)) {
    input = input.slice(0, -1).split(m.decimal).join('') + m.decimal;
  }
  const decIdx = m.exponent > 0 ? input.lastIndexOf(m.decimal) : -1;
  const intRaw = decIdx >= 0 ? input.slice(0, decIdx) : input;
  const frac = decIdx >= 0 ? input.slice(decIdx + 1).replace(/\D/g, '').slice(0, m.exponent) : null;
  const intDigits = intRaw.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  if (!intDigits && frac === null) return '';
  const grouped = groupDigits(intDigits || '0', m.group);
  return frac !== null ? `${grouped}${m.decimal}${frac}` : grouped;
}

const RATE_SCALE = BigInt(1_000_000_000_000);

/** Ubah string desimal kurs ("15873.4521") ke BigInt berskala 1e12 tanpa float. */
export function rateToScaled(rate: string): bigint {
  const match = /^(\d+)(?:\.(\d{1,12}))?\d*$/.exec(rate.trim());
  if (!match) throw new Error(`Kurs tidak valid: ${rate}`);
  const frac = (match[2] ?? '').padEnd(12, '0');
  return BigInt(match[1]) * RATE_SCALE + BigInt(frac);
}

function pow10(n: number): bigint {
  return BigInt(10) ** BigInt(n);
}

/**
 * Konversi minor units antar mata uang. `rate` = jumlah unit `to` per 1 unit `from`.
 * Pembulatan half-away-from-zero.
 */
export function convertMinor(minor: number, from: string, to: string, rate: string): number {
  assertMinor(minor);
  const fromExp = currencyMeta(from).exponent;
  const toExp = currencyMeta(to).exponent;
  const negative = minor < 0;
  const numerator = BigInt(Math.abs(minor)) * rateToScaled(rate) * pow10(toExp);
  const denominator = pow10(fromExp) * RATE_SCALE;
  let result = numerator / denominator;
  if ((numerator % denominator) * BigInt(2) >= denominator) result += BigInt(1);
  const out = Number(result);
  if (!Number.isSafeInteger(out)) throw new Error('Hasil konversi di luar batas aman');
  return negative ? -out : out;
}

function assertMinor(minor: number): void {
  if (!Number.isSafeInteger(minor)) {
    throw new Error(`Nominal harus integer minor units, dapat: ${minor}`);
  }
}

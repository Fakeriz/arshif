/**
 * Bagian bersama kalkulator pajak (FR-TAX-2). Semua nominal integer unit terkecil (IDR rupiah, MYR sen,
 * TRY kuruş). Tarif dalam basis poin (1 bp = 0,01%). Perhitungan memakai BigInt supaya tidak ada float.
 */

export type TaxCountry = 'ID' | 'MY' | 'TR';

/** Mata uang tiap estimator. */
export const TAX_CURRENCY: Record<TaxCountry, string> = { ID: 'IDR', MY: 'MYR', TR: 'TRY' };

/** Negara bawaan estimator: dari mata uang utama, lalu bahasa. */
export function defaultTaxCountry(mainCurrency: string, lang: string): TaxCountry {
  if (mainCurrency === 'MYR' || (mainCurrency !== 'IDR' && lang === 'ms')) return 'MY';
  if (mainCurrency === 'TRY' || (mainCurrency !== 'IDR' && lang === 'tr')) return 'TR';
  return 'ID';
}

/** Satu baris rincian. `key` = kunci i18n `tools.tax.line.<key>`, `vars` untuk sisipan teks (mis. tarif). */
export type TaxLine = { key: string; amount: number; vars?: Record<string, string | number>; strong?: boolean; minus?: boolean };

/** Satu baris tabel tarif yang dipakai, untuk ditampilkan di layar (FR-TAX-2: "tunjukkan tarif"). */
export type RateRow = { from: number; to: number | null; bp: number };

export type TaxResult = {
  country: TaxCountry;
  currency: string;
  /** Angka utama di layar (potongan per bulan atau pajak setahun, lihat `headlineKey`). */
  headline: number;
  headlineKey: string;
  annualTax: number;
  lines: TaxLine[];
  /** Tarif progresif yang dipakai. */
  rates: RateRow[];
  /** Kunci i18n asumsi yang dipakai (ditampilkan di bawah rincian). */
  notes: string[];
};

/** minor × bp / 10000, dibulatkan setengah ke atas (nominal selalu >= 0). */
export function applyBp(minor: number, bp: number): number {
  if (minor <= 0 || bp <= 0) return 0;
  const n = BigInt(minor) * BigInt(bp);
  return Number((n + BigInt(5000)) / BigInt(10000));
}

/**
 * Pajak progresif kumulatif. `brackets` = batas atas tiap lapis (null = sisanya) dan tarifnya.
 * Hasil dibulatkan sekali di akhir (setengah ke atas), bukan per lapis.
 */
export function progressive(income: number, brackets: { upTo: number | null; bp: number }[]): number {
  if (income <= 0) return 0;
  let prev = 0;
  let acc = BigInt(0);
  for (const b of brackets) {
    const top = b.upTo === null ? income : Math.min(income, b.upTo);
    if (top > prev) acc += BigInt(top - prev) * BigInt(b.bp);
    if (b.upTo === null || income <= b.upTo) break;
    prev = b.upTo;
  }
  return Number((acc + BigInt(5000)) / BigInt(10000));
}

export function toRateRows(brackets: { upTo: number | null; bp: number }[]): RateRow[] {
  let prev = 0;
  return brackets.map((b) => {
    const row = { from: prev, to: b.upTo, bp: b.bp };
    prev = b.upTo ?? prev;
    return row;
  });
}

/** Tarif basis poin sebagai teks persen tanpa nol berlebih: 25 -> "0,25", 1500 -> "15". */
export function bpText(bp: number, decimal = ','): string {
  const whole = Math.trunc(bp / 100);
  const frac = String(bp % 100).padStart(2, '0').replace(/0+$/, '');
  return frac ? `${whole}${decimal}${frac}` : String(whole);
}

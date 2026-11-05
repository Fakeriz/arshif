import { convertMinor, rateToScaled } from './money';

/** Kurs contoh per 1 USD (Fase 1). Fase 2 diganti hasil sync ExchangeRate-API. */
export const SAMPLE_USD_RATES: Record<string, string> = {
  USD: '1',
  IDR: '16250',
  MYR: '4.28',
  TRY: '43.5',
  SGD: '1.31',
  EUR: '0.86',
};

export const SAMPLE_RATES_AT = '5 Nov, 14.00';

const SCALE = BigInt(1_000_000_000_000);

/** Kurs silang `to` per 1 `from` lewat USD, 12 desimal, tanpa float. */
export function crossRate(from: string, to: string, table: Record<string, string> = SAMPLE_USD_RATES): string {
  if (from === to) return '1';
  const f = table[from];
  const t = table[to];
  if (!f || !t) throw new Error(`Kurs tidak tersedia untuk ${!f ? from : to}`);
  const q = (rateToScaled(t) * SCALE) / rateToScaled(f);
  const whole = q / SCALE;
  const frac = (q % SCALE).toString().padStart(12, '0');
  return `${whole}.${frac}`;
}

export function convert(minor: number, from: string, to: string, table?: Record<string, string>): number {
  if (from === to) return minor;
  return convertMinor(minor, from, to, crossRate(from, to, table));
}

export function hasRate(code: string, table: Record<string, string> = SAMPLE_USD_RATES): boolean {
  return code in table;
}

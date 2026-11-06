/**
 * Logika keypad nominal (NumberPad) tanpa React agar bisa dites.
 * Teks ketikan disimpan mentah: digit + "." sebagai pemisah desimal internal ("1250.5").
 * Tampilan dan nilai minor units diturunkan dari teks ini per mata uang.
 */
import { currencyMeta, groupDigits } from './money';

export type KeypadKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '000' | 'decimal' | 'back' | 'clear';

/** Batas digit bagian bulat: 13 digit tetap aman sebagai integer minor units (≤ 2^53). */
export const MAX_INT_DIGITS = 13;

export function pressKey(typed: string, key: KeypadKey, code: string, maxIntDigits = MAX_INT_DIGITS): string {
  const { exponent } = currencyMeta(code);
  const dot = typed.indexOf('.');
  const intPart = dot >= 0 ? typed.slice(0, dot) : typed;
  const frac = dot >= 0 ? typed.slice(dot + 1) : null;

  if (key === 'clear') return '';
  if (key === 'back') return typed.slice(0, -1);
  if (key === 'decimal') {
    if (exponent === 0 || frac !== null) return typed;
    return `${intPart || '0'}.`;
  }

  const digits = key;
  if (frac !== null) {
    const room = exponent - frac.length;
    return room > 0 ? `${typed}${digits.slice(0, room)}` : typed;
  }
  // Nol di depan tidak bertambah: "0" + "0" tetap "0", "0" + "5" jadi "5".
  const next = `${intPart}${digits}`.replace(/^0+(?=\d)/, '');
  if (next.length > maxIntDigits) return typed;
  return next;
}

/** Teks ketikan → minor units. Kosong → null. */
export function typedToMinor(typed: string, code: string): number | null {
  if (!/\d/.test(typed)) return null;
  const { exponent } = currencyMeta(code);
  const [intPart, frac = ''] = typed.split('.');
  const value = Number(`${intPart || '0'}${frac.padEnd(exponent, '0').slice(0, exponent)}`);
  return Number.isSafeInteger(value) ? value : null;
}

/** Minor units → teks ketikan (untuk mengisi keypad dari nilai yang sudah ada). */
export function minorToTyped(minor: number | null, code: string): string {
  if (minor === null || minor <= 0) return '';
  const { exponent } = currencyMeta(code);
  const s = String(Math.trunc(minor)).padStart(exponent + 1, '0');
  if (exponent === 0) return s;
  const frac = s.slice(-exponent).replace(/0+$/, '');
  const int = s.slice(0, -exponent);
  return frac ? `${int}.${frac}` : int;
}

/** Teks ketikan → tampilan sesuai mata uang, mis. "1250.5" MYR → "1,250.5"; IDR "45000" → "45.000". */
export function typedDisplay(typed: string, code: string): string {
  const m = currencyMeta(code);
  if (!typed) return '0';
  const [intPart, frac] = typed.split('.');
  const grouped = groupDigits(intPart || '0', m.group);
  return frac !== undefined ? `${grouped}${m.decimal}${frac}` : grouped;
}

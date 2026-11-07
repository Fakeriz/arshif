/**
 * Logika keypad kalkulator nominal (NumberPad) tanpa React agar bisa dites.
 * Teks ketikan disimpan mentah: angka dengan "." sebagai pemisah desimal internal, dipisah operator
 * ASCII ("1250.5+300*2"). Tampilan dan nilai minor units diturunkan dari teks ini per mata uang.
 */
import { currencyMeta, groupDigits } from './money';

export type Operator = '+' | '-' | '*' | '/';
export type KeypadKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '000' | 'decimal' | 'back' | 'clear' | Operator | 'equals';

export const OPERATORS: readonly Operator[] = ['/', '*', '-', '+'];
const isOp = (c: string | undefined): c is Operator => c !== undefined && (OPERATORS as readonly string[]).includes(c);

/** Batas digit bagian bulat per angka: 13 digit tetap aman sebagai integer minor units (≤ 2^53). */
export const MAX_INT_DIGITS = 13;

/** Satu angka (tanpa operator): digit, "000", desimal. */
function pressNumber(typed: string, key: KeypadKey, exponent: number, maxIntDigits: number): string {
  const dot = typed.indexOf('.');
  const intPart = dot >= 0 ? typed.slice(0, dot) : typed;
  const frac = dot >= 0 ? typed.slice(dot + 1) : null;
  if (key === 'decimal') {
    if (exponent === 0 || frac !== null) return typed;
    return `${intPart || '0'}.`;
  }
  if (frac !== null) {
    const room = exponent - frac.length;
    return room > 0 ? `${typed}${key.slice(0, room)}` : typed;
  }
  // Nol di depan tidak bertambah: "0" + "0" tetap "0", "0" + "5" jadi "5".
  const next = `${intPart}${key}`.replace(/^0+(?=\d)/, '');
  return next.length > maxIntDigits ? typed : next;
}

/** Ketukan → teks ketikan berikutnya. Teks sama dengan sebelumnya = ketukan ditolak (kecuali hapus). */
export function pressKey(typed: string, key: KeypadKey, code: string, maxIntDigits = MAX_INT_DIGITS): string {
  if (key === 'clear') return '';
  if (key === 'back') return typed.slice(0, -1);
  if (key === 'equals') {
    if (!OPERATORS.some((op) => typed.includes(op))) return typed;
    const v = evaluate(typed, code);
    return v === null ? typed : minorToTyped(v, code);
  }
  const last = typed[typed.length - 1];
  if (isOp(key)) {
    // Operator butuh angka di depannya; operator kedua berturut-turut mengganti yang pertama.
    if (!typed) return typed;
    if (isOp(last)) return `${typed.slice(0, -1)}${key}`;
    return `${last === '.' ? typed.slice(0, -1) : typed}${key}`;
  }
  const cut = Math.max(...OPERATORS.map((op) => typed.lastIndexOf(op)));
  const head = typed.slice(0, cut + 1);
  const seg = typed.slice(cut + 1);
  return `${head}${pressNumber(seg, key, currencyMeta(code).exponent, maxIntDigits)}`;
}

/**
 * Hitung ekspresi (× ÷ sebelum + −) → minor units, dibulatkan ke desimal mata uang.
 * Operator di ujung diabaikan (hasil sementara saat mengetik). Kosong, bagi nol, negatif, atau terlalu besar → null.
 */
export function evaluate(typed: string, code: string): number | null {
  const parts = typed.split(/([+\-*/])/);
  if (isOp(parts[parts.length - 2]) && parts[parts.length - 1] === '') parts.splice(-2);
  if (!/\d/.test(parts.join(''))) return null;
  const terms: number[] = [Number(parts[0] || '0')];
  const signs: number[] = [1];
  for (let i = 1; i < parts.length; i += 2) {
    const op = parts[i] as Operator;
    const n = Number(parts[i + 1] || '0');
    if (op === '+' || op === '-') {
      terms.push(n);
      signs.push(op === '+' ? 1 : -1);
    } else if (op === '*') terms[terms.length - 1] *= n;
    else {
      if (n === 0) return null;
      terms[terms.length - 1] /= n;
    }
  }
  const major = terms.reduce((s, t, i) => s + signs[i] * t, 0);
  // toFixed memangkas galat float (0.1 + 0.2) sebelum dibulatkan ke minor units.
  const minor = Math.round(Number((major * Math.pow(10, currencyMeta(code).exponent)).toFixed(6)));
  return Number.isSafeInteger(minor) && minor >= 0 ? minor : null;
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

const OP_GLYPH: Record<Operator, string> = { '+': '+', '-': '−', '*': '×', '/': '÷' };

/** Teks ketikan → tampilan sesuai mata uang: "1250.5+3" MYR → "1,250.5 + 3"; IDR "45000" → "45.000". */
export function typedDisplay(typed: string, code: string): string {
  const m = currencyMeta(code);
  if (!typed) return '0';
  return typed
    .split(/([+\-*/])/)
    .map((part) => {
      if (isOp(part)) return ` ${OP_GLYPH[part]} `;
      if (!part) return '';
      const [intPart, frac] = part.split('.');
      const grouped = groupDigits(intPart || '0', m.group);
      return frac !== undefined ? `${grouped}${m.decimal}${frac}` : grouped;
    })
    .join('')
    .trim();
}

/** Mata uang tanpa desimal (IDR, JPY, KRW, VND) bernominal besar: tombol desimal diganti "000". */
export const extraKey = (code: string): KeypadKey => (currencyMeta(code).exponent > 0 ? 'decimal' : '000');

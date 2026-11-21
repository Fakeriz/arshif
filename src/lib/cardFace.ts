import type { AccountType } from '@/data/types';

/**
 * Wajah kartu gaya "dompet bertumpuk": rasio kartu ISO/IEC 7810 (85.6 x 53.98 mm), gradasi dari warna bank,
 * satu motif garis tipis, chip untuk kartu bank, simbol nirsentuh untuk selain tunai.
 */
export const CARD_RATIO = 1.586;

export const PATTERNS = ['rings', 'arcs', 'waves', 'grid', 'paper'] as const;
export type Pattern = (typeof PATTERNS)[number];

/** Motif bawaan per jenis akun (seperti contoh: debit = lingkar, kredit = gelombang, dompet digital = titik, tunai = kertas). */
const DEFAULT_PATTERN: Record<AccountType, Pattern> = { tabungan: 'rings', kartu_kredit: 'waves', ewallet: 'grid', cash: 'paper', paylater: 'arcs' };

/** Nilai `card_style` -> motif. Kosong atau id katalog lama yang bukan motif = bawaan jenis akun. */
export function patternFor(type: AccountType, cardStyle?: string | null): Pattern {
  return (PATTERNS as readonly string[]).includes(cardStyle ?? '') ? (cardStyle as Pattern) : DEFAULT_PATTERN[type];
}

/** Chip emas hanya untuk kartu bank fisik; tunai tanpa simbol nirsentuh. */
export const hasChip = (type: AccountType) => type === 'tabungan' || type === 'kartu_kredit';
export const hasContactless = (type: AccountType) => type !== 'cash';

function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6);
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const hex2 = (v: number) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0');

/** Campur warna `hex` dengan putih (t > 0) atau hitam (t < 0), |t| 0..1. */
export function shade(hex: string, t: number): string {
  const [r, g, b] = rgb(hex);
  const to = t > 0 ? 255 : 0;
  const k = Math.abs(t);
  return `#${hex2(r + (to - r) * k)}${hex2(g + (to - g) * k)}${hex2(b + (to - b) * k)}`;
}

const isLight = (hex: string) => {
  const [r, g, b] = rgb(hex);
  return 0.299 * r + 0.587 * g + 0.114 * b > 150;
};

/**
 * Gradasi 3 titik seperti contoh, tapi selalu MENJAUHI warna teks: teks putih = makin gelap, teks gelap = makin terang.
 * Warna bank sudah dipilih >= 4.5:1 terhadap onColor; arah ini menjaga kontras di seluruh kartu (tidak pernah turun).
 */
export function cardGradient(color: string, onColor: string): [string, string, string] {
  const k = isLight(onColor) ? -1 : 1;
  return [color, shade(color, 0.16 * k), shade(color, 0.34 * k)];
}

/** "4821" -> "•••• •••• •••• 4821". */
export const maskedNumber = (last4: string) => `•••• •••• •••• ${last4}`;

export const HOLDER_MAX = 40;

/** Validasi isian sakelar detail kartu. Hasil = nilai bersih, atau null bila tidak valid. */
export function cleanLast4(v: string): string | null {
  const d = v.replace(/\D/g, '');
  return d.length === 4 ? d : null;
}
export function cleanHolder(v: string): string | null {
  const s = v.trim().replace(/\s+/g, ' ').toUpperCase();
  return s.length >= 1 && s.length <= HOLDER_MAX ? s : null;
}
/** "0929", "9/29", "09/29" -> "09/29". Bulan 01-12. */
export function cleanExpiry(v: string): string | null {
  const m = /^\s*(\d{1,2})\s*\/?\s*(\d{2})\s*$/.exec(v);
  if (!m) return null;
  const month = Number(m[1]);
  return month >= 1 && month <= 12 ? `${String(month).padStart(2, '0')}/${m[2]}` : null;
}

import type { ReceiptItem } from '@/data/types';

/** Field dengan keyakinan di bawah angka ini ditandai kuning di layar review (FR-OCR-3). */
export const LOW_CONFIDENCE = 0.7;

export const isLowConfidence = (confidence: number): boolean => confidence < LOW_CONFIDENCE;

export const itemsTotal = (items: ReceiptItem[]): number => items.reduce((s, i) => s + i.total, 0);

/** Peringatan bila jumlah item berbeda dari subtotal lebih dari 1% (FR-OCR-3). */
export function subtotalMismatch(items: ReceiptItem[], subtotal: number): { mismatch: boolean; diff: number } {
  const diff = itemsTotal(items) - subtotal;
  if (subtotal <= 0) return { mismatch: items.length > 0, diff };
  return { mismatch: Math.abs(diff) / subtotal > 0.01, diff };
}

/** Harga yang dibayar untuk satu item setelah diskon promosinya. */
export const itemPaid = (item: ReceiptItem): number => item.total - Math.min(item.discount ?? 0, item.total);

export const discountsTotal = (discounts: { amount: number }[]): number => discounts.reduce((s, d) => s + d.amount, 0);

/**
 * Rumus struk: subtotal - diskon (+ pajak bila tidak termasuk harga) (+ service) = total.
 * Selisih sampai 1 unit terkecil dianggap pembulatan.
 */
export function totalCheck(r: { subtotal: number; discount: number; tax?: number; taxIncluded?: boolean; service?: number; total: number }): { expected: number; diff: number; ok: boolean } {
  const expected = r.subtotal - r.discount + (r.taxIncluded === false ? (r.tax ?? 0) : 0) + (r.service ?? 0);
  const diff = r.total - expected;
  return { expected, diff, ok: Math.abs(diff) <= 1 };
}

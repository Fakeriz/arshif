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

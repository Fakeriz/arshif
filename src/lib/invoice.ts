/**
 * Invoice & penawaran (FR-INV-1, FR-INV-2). Nominal integer unit terkecil `currency`; qty boleh pecahan
 * dua desimal (mis. 1,5 jam). Rumus jumlah sama persis dengan trigger invoices_compute di server:
 *   baris = qty × harga satuan, dibulatkan setengah ke atas per baris
 *   pajak = (subtotal − diskon) × tarif, dibulatkan setengah ke atas
 *   total = subtotal − diskon + pajak
 */

export type InvoiceKind = 'invoice' | 'quote';
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'accepted';

export type InvoiceItem = { id: string; name: string; qty: number; unitPrice: number };

export type Invoice = {
  id: string;
  kind: InvoiceKind;
  /** INV-2026-0001, diisi server. Kosong selama belum tersimpan. */
  number: string;
  status: InvoiceStatus;
  clientName: string;
  clientContact?: string;
  /** "YYYY-MM-DD" */
  issueDate: string;
  /** Invoice: jatuh tempo. Penawaran: berlaku sampai. */
  dueDate?: string;
  currency: string;
  items: InvoiceItem[];
  discount: number;
  /** Pajak dalam basis poin: 1100 = 11%. */
  taxBp: number;
  subtotal: number;
  tax: number;
  total: number;
  notes?: string;
  accountId?: string;
  transactionId?: string;
  paidAt?: string;
  createdAt: string;
};

/** Status yang boleh dituju dari status sekarang lewat tombol (Dibayar lewat alur khusus). */
export function nextStatuses(kind: InvoiceKind, status: InvoiceStatus): InvoiceStatus[] {
  if (status === 'paid') return [];
  if (kind === 'invoice') return status === 'draft' ? ['sent', 'paid'] : status === 'sent' ? ['draft', 'paid'] : [];
  return status === 'draft' ? ['sent', 'accepted'] : status === 'sent' ? ['draft', 'accepted'] : ['sent'];
}

/** qty dalam seperseratus (1,5 -> 150). null = tidak valid (<= 0, > 100.000, lebih dari 2 desimal). */
export function qtyCenti(qty: number): number | null {
  if (!Number.isFinite(qty) || qty <= 0 || qty > 100000) return null;
  const c = Math.round(qty * 100);
  return Math.abs(c - qty * 100) < 1e-6 ? c : null;
}

export function lineTotal(item: Pick<InvoiceItem, 'qty' | 'unitPrice'>): number {
  const c = qtyCenti(item.qty);
  if (c === null || item.unitPrice < 0) return 0;
  const n = BigInt(c) * BigInt(Math.trunc(item.unitPrice));
  return Number((n + BigInt(50)) / BigInt(100));
}

export type InvoiceTotals = { subtotal: number; discount: number; tax: number; total: number };

export function invoiceTotals(items: Pick<InvoiceItem, 'qty' | 'unitPrice'>[], discount: number, taxBp: number): InvoiceTotals {
  const subtotal = items.reduce((s, i) => s + lineTotal(i), 0);
  const d = Math.max(0, Math.min(Math.trunc(discount), subtotal));
  const base = subtotal - d;
  const tax = taxBp > 0 ? Number((BigInt(base) * BigInt(taxBp) + BigInt(5000)) / BigInt(10000)) : 0;
  return { subtotal, discount: d, tax, total: base + tax };
}

/** Teks qty untuk tampilan: 1, 1,5, 2,25 (pemisah desimal ikut bahasa). */
export function qtyText(qty: number, decimal: ',' | '.'): string {
  const c = qtyCenti(qty) ?? 0;
  const whole = Math.trunc(c / 100);
  const frac = String(c % 100).padStart(2, '0').replace(/0+$/, '');
  return frac ? `${whole}${decimal}${frac}` : String(whole);
}

/** Parse qty yang diketik ("1,5" atau "1.5"). null bila tidak valid. */
export function parseQty(text: string): number | null {
  const t = text.trim().replace(',', '.');
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(t)) return null;
  const v = Number(t);
  return qtyCenti(v) === null ? null : v;
}

/** Parse persen pajak yang diketik ("11", "7,5") ke basis poin. null bila tidak valid. */
export function parsePercentBp(text: string): number | null {
  const t = text.trim().replace(',', '.');
  if (t === '') return 0;
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(t)) return null;
  const bp = Math.round(Number(t) * 100);
  return bp >= 0 && bp <= 10000 ? bp : null;
}

/** Sudah lewat jatuh tempo dan belum dibayar. */
export function isOverdue(inv: Pick<Invoice, 'kind' | 'status' | 'dueDate'>, today: string): boolean {
  return inv.kind === 'invoice' && inv.status !== 'paid' && !!inv.dueDate && inv.dueDate < today;
}

/** Awal bulan berjalan (UTC, sama dengan periode kuota server) untuk hitungan "bulan ini". */
export function monthKeyUtc(d = new Date()): string {
  return d.toISOString().slice(0, 7);
}

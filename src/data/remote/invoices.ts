import type { Invoice, InvoiceItem, InvoiceKind, InvoiceStatus } from '@/lib/invoice';
import type { QuotaKey } from '@/lib/quota';
import { supabase } from '@/lib/supabase';

import { RemoteError } from './api';
import { QuotaError } from './planning';

type Res<T> = { data: T | null; error: { message: string; code?: string } | null };
function check<T>(res: Res<T>): T | null {
  if (res.error) {
    const quota = /quota_(invoice|taxFull|pdfExport)/.exec(res.error.message);
    if (quota) throw new QuotaError(quota[1] as QuotaKey);
    throw new RemoteError(res.error.message, res.error.code);
  }
  return res.data;
}
function must<T>(res: Res<T>): T {
  const data = check(res);
  if (data === null) throw new RemoteError('empty_result');
  return data;
}

type InvoiceRow = {
  id: string; kind: InvoiceKind; number: string; status: InvoiceStatus; client_name: string; client_contact: string | null;
  issue_date: string; due_date: string | null; currency: string; items: InvoiceItem[]; discount: number; tax_bp: number;
  subtotal: number; tax: number; total: number; notes: string | null; account_id: string | null; transaction_id: string | null;
  paid_at: string | null; created_at: string;
};

const opt = <T,>(v: T | null | undefined): T | undefined => (v === null || v === undefined ? undefined : v);

// jsonb dari klien sendiri, tetap dibaca defensif: entri rusak dibuang.
export const toInvoice = (r: InvoiceRow): Invoice => ({
  id: r.id, kind: r.kind, number: r.number, status: r.status, clientName: r.client_name, clientContact: opt(r.client_contact),
  issueDate: r.issue_date, dueDate: opt(r.due_date), currency: r.currency,
  items: (Array.isArray(r.items) ? r.items : [])
    .filter((i) => i && typeof i.name === 'string')
    .map((i) => ({ id: String(i.id), name: i.name, qty: Number(i.qty), unitPrice: Number(i.unitPrice) })),
  discount: Number(r.discount), taxBp: r.tax_bp, subtotal: Number(r.subtotal), tax: Number(r.tax), total: Number(r.total),
  notes: opt(r.notes), accountId: opt(r.account_id), transactionId: opt(r.transaction_id), paidAt: opt(r.paid_at), createdAt: r.created_at,
});

export type InvoiceInput = Pick<Invoice, 'clientName' | 'clientContact' | 'issueDate' | 'dueDate' | 'currency' | 'items' | 'discount' | 'taxBp' | 'notes'>;

const cols = (i: InvoiceInput) => ({
  client_name: i.clientName, client_contact: i.clientContact ?? null, issue_date: i.issueDate, due_date: i.dueDate ?? null,
  currency: i.currency, items: i.items.map((x) => ({ id: x.id, name: x.name, qty: x.qty, unitPrice: x.unitPrice })),
  discount: i.discount, tax_bp: i.taxBp, notes: i.notes ?? null,
});

export async function loadInvoices(): Promise<Invoice[]> {
  const rows = must(await supabase.from('invoices').select('*').order('issue_date', { ascending: false }).order('seq', { ascending: false }).limit(500).returns<InvoiceRow[]>());
  return rows.map(toInvoice);
}

export async function insertInvoice(id: string, kind: InvoiceKind, i: InvoiceInput): Promise<Invoice> {
  return toInvoice(must(await supabase.from('invoices').insert({ id, kind, ...cols(i) }).select('*').single<InvoiceRow>()));
}

export async function updateInvoice(id: string, i: InvoiceInput): Promise<Invoice> {
  return toInvoice(must(await supabase.from('invoices').update(cols(i)).eq('id', id).select('*').single<InvoiceRow>()));
}

export async function setInvoiceStatus(id: string, status: Exclude<InvoiceStatus, 'paid'>): Promise<Invoice> {
  return toInvoice(must(await supabase.from('invoices').update({ status }).eq('id', id).select('*').single<InvoiceRow>()));
}

export async function deleteInvoice(id: string): Promise<void> {
  check(await supabase.from('invoices').delete().eq('id', id));
}

/** Setelah transaksi pemasukannya tersimpan (id transaksi = id invoice): tandai Dibayar, atomik di server. */
export async function invoiceMarkPaid(id: string, transactionId: string): Promise<Invoice> {
  check(await supabase.rpc('invoice_mark_paid', { p_invoice: id, p_transaction: transactionId }));
  return toInvoice(must(await supabase.from('invoices').select('*').eq('id', id).single<InvoiceRow>()));
}

/** Gerbang fitur Premium di server (taxFull, pdfExport). Free: QuotaError. */
export async function featureGate(key: 'taxFull' | 'pdfExport'): Promise<void> {
  check(await supabase.rpc('feature_gate', { p_key: key }));
}

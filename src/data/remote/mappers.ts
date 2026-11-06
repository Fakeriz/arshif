import type { Account, AccountType, AppNotification, BudgetRecord, LimitGroup, ReceiptDetails, ReceiptDiscount, ReceiptTaxLine, Transaction, TxSource, TxType } from '@/data/types';
import type { MsgKey } from '@/i18n/translate';

/** Baris DB (snake_case) → tipe domain klien. Nominal bigint datang sebagai number dari PostgREST. */

export type AccountRow = {
  id: string; bank: string; name: string; type: AccountType; currency: string;
  opening_balance: number; balance: number; last4: string | null;
  credit_limit?: number | null; limit_group_id?: string | null; annual_fee?: number | null; annual_fee_month?: number | null;
  annual_fee_day?: number | null; fee_waiver_threshold?: number | null; annual_fee_paid?: string[] | null;
};

export type LimitGroupRow = { id: string; name: string; currency: string; shared_limit: number | string };
export type BudgetRow = { id: string; period_start: string; total: number | string; category_limits: Record<string, unknown> | null };

export const toLimitGroup = (r: LimitGroupRow): LimitGroup => ({ id: r.id, name: r.name, currency: r.currency, sharedLimit: Number(r.shared_limit) });

export const toBudget = (r: BudgetRow): BudgetRecord => ({
  id: r.id,
  periodStart: r.period_start,
  total: Number(r.total),
  categoryLimits: Object.fromEntries(
    Object.entries(r.category_limits ?? {}).flatMap(([k, v]) => (Number.isSafeInteger(Number(v)) && Number(v) >= 0 ? [[k, Number(v)]] : [])),
  ),
});

export type ItemRow = { name: string; qty: number; unit_price: number; total: number; position: number; discount?: number | null; tax_rate?: number | string | null };

export type TransactionRow = {
  id: string; type: TxType; merchant: string; category_key: string; account_id: string; to_account_id: string | null;
  date: string; time: string; amount: number; currency: string; account_amount: number | null; to_amount: number | null;
  note: string | null; source: TxSource; receipt_path: string | null; transaction_items?: ItemRow[];
  reimburse_status?: 'pending' | 'reimbursed' | null; reimbursed_by?: string | null;
  subtotal?: number | null; discount_total?: number | null; tax_total?: number | null; tax_included?: boolean | null;
  service_amount?: number | null; discounts?: unknown; tax_lines?: unknown; receipt_no?: string | null;
  payment_method?: string | null; store_address?: string | null; store_tax_id?: string | null;
};

const optNum = (v: unknown): number | undefined => (v == null || v === '' || !Number.isFinite(Number(v)) ? undefined : Number(v));
const optStr = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined);
const objects = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.filter((x) => x && typeof x === 'object') : []);

/** Kolom jsonb dibaca defensif: baris yang bentuknya rusak dibuang, bukan membuat layar gagal. */
function toReceipt(r: TransactionRow): ReceiptDetails | undefined {
  const discounts: ReceiptDiscount[] = objects(r.discounts).flatMap((d) => {
    const amount = optNum(d.amount);
    return amount ? [{ amount, label: optStr(d.label), itemName: optStr(d.itemName), taxRate: optNum(d.taxRate) }] : [];
  });
  const taxLines: ReceiptTaxLine[] = objects(r.tax_lines).flatMap((l) => {
    const rate = optNum(l.rate);
    const tax = optNum(l.tax);
    return rate !== undefined && tax !== undefined ? [{ rate, tax, gross: optNum(l.gross) }] : [];
  });
  const receipt: ReceiptDetails = {
    subtotal: optNum(r.subtotal),
    discountTotal: optNum(r.discount_total),
    taxTotal: optNum(r.tax_total),
    taxIncluded: r.tax_included ?? undefined,
    service: optNum(r.service_amount),
    discounts,
    taxLines,
    receiptNo: optStr(r.receipt_no),
    paymentMethod: optStr(r.payment_method),
    storeAddress: optStr(r.store_address),
    storeTaxId: optStr(r.store_tax_id),
  };
  const empty = !discounts.length && !taxLines.length && Object.entries(receipt).every(([k, v]) => k === 'discounts' || k === 'taxLines' || v === undefined);
  return empty ? undefined : receipt;
}

export type NotificationRow = {
  id: string; type: AppNotification['type']; title_key: string; message_key: string;
  vars: Record<string, string | number>; href: AppNotification['href'] | null; read_at: string | null; created_at: string;
};

export const toAccount = (r: AccountRow): Account => ({
  id: r.id,
  bank: r.bank,
  name: r.name,
  type: r.type,
  currency: r.currency,
  openingBalance: Number(r.opening_balance),
  last4: r.last4 ?? undefined,
  creditLimit: r.credit_limit == null ? undefined : Number(r.credit_limit),
  limitGroupId: r.limit_group_id ?? undefined,
  annualFee:
    r.annual_fee != null && r.annual_fee_month != null && r.annual_fee_day != null
      ? {
          amount: Number(r.annual_fee),
          month: r.annual_fee_month,
          day: r.annual_fee_day,
          waiverThreshold: r.fee_waiver_threshold == null ? undefined : Number(r.fee_waiver_threshold),
          paid: [...(r.annual_fee_paid ?? [])].sort(),
        }
      : undefined,
});

/** Kolom kartu yang boleh ditulis klien (grant migrasi 13). */
export const creditColumns = (a: Pick<Account, 'creditLimit' | 'limitGroupId' | 'annualFee'>) => ({
  credit_limit: a.creditLimit ?? null,
  limit_group_id: a.limitGroupId ?? null,
  annual_fee: a.annualFee?.amount ?? null,
  annual_fee_month: a.annualFee?.month ?? null,
  annual_fee_day: a.annualFee?.day ?? null,
  fee_waiver_threshold: a.annualFee?.waiverThreshold ?? null,
  annual_fee_paid: a.annualFee?.paid ?? [],
});

export const toTransaction = (r: TransactionRow): Transaction => ({
  id: r.id,
  type: r.type,
  merchant: r.merchant,
  categoryKey: r.category_key,
  accountId: r.account_id,
  toAccountId: r.to_account_id ?? undefined,
  date: r.date,
  time: r.time.slice(0, 5),
  amount: Number(r.amount),
  currency: r.currency,
  accountAmount: r.account_amount == null ? undefined : Number(r.account_amount),
  toAmount: r.to_amount == null ? undefined : Number(r.to_amount),
  note: r.note ?? undefined,
  source: r.source,
  receiptPath: r.receipt_path ?? undefined,
  items: r.transaction_items?.length
    ? [...r.transaction_items]
        .sort((a, b) => a.position - b.position)
        .map((i) => ({ name: i.name, qty: Number(i.qty), unitPrice: Number(i.unit_price), total: Number(i.total), discount: optNum(i.discount) || undefined, taxRate: optNum(i.tax_rate) }))
    : undefined,
  receipt: toReceipt(r),
  reimburseStatus: r.reimburse_status ?? undefined,
  reimbursedBy: r.reimbursed_by ?? undefined,
});

/** Domain → kolom yang boleh ditulis klien (sesuai grant di migrasi RLS). */
export const fromTransaction = (t: Transaction) => ({
  id: t.id,
  type: t.type,
  merchant: t.merchant,
  category_key: t.categoryKey,
  account_id: t.accountId,
  to_account_id: t.type === 'transfer' ? (t.toAccountId ?? null) : null,
  date: t.date,
  time: t.time,
  amount: t.amount,
  currency: t.currency,
  account_amount: t.accountAmount ?? null,
  to_amount: t.type === 'transfer' ? (t.toAmount ?? null) : null,
  note: t.note ?? null,
  source: t.source,
  receipt_path: t.receiptPath ?? null,
  // Server menormalkan: hanya pengeluaran; ada pengganti = reimbursed.
  reimburse_status: t.type === 'expense' ? (t.reimburseStatus ?? null) : null,
  reimbursed_by: t.type === 'expense' ? (t.reimbursedBy ?? null) : null,
  ...(t.receipt ? receiptColumns(t.receipt) : {}),
});

/** Kolom rincian struk. Hanya dikirim bila transaksi punya rincian, jadi transaksi manual tidak menyentuhnya. */
const receiptColumns = (r: ReceiptDetails) => ({
  subtotal: r.subtotal ?? null,
  discount_total: r.discountTotal ?? null,
  tax_total: r.taxTotal ?? null,
  tax_included: r.taxIncluded ?? null,
  service_amount: r.service ?? null,
  discounts: r.discounts.length ? r.discounts : null,
  tax_lines: r.taxLines.length ? r.taxLines : null,
  receipt_no: r.receiptNo ?? null,
  payment_method: r.paymentMethod ?? null,
  store_address: r.storeAddress ?? null,
  store_tax_id: r.storeTaxId ?? null,
});

const pad = (n: number) => String(n).padStart(2, '0');

/** Waktu notifikasi ditampilkan di zona waktu perangkat. */
export const toNotification = (r: NotificationRow): AppNotification => {
  const d = new Date(r.created_at);
  return {
    id: r.id,
    type: r.type,
    titleKey: r.title_key as MsgKey,
    messageKey: r.message_key as MsgKey,
    vars: r.vars,
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
    read: r.read_at !== null,
    href: r.href ?? undefined,
  };
};

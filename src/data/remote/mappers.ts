import type { Account, AccountType, AppNotification, Transaction, TxSource, TxType } from '@/data/types';
import type { MsgKey } from '@/i18n/translate';

/** Baris DB (snake_case) → tipe domain klien. Nominal bigint datang sebagai number dari PostgREST. */

export type AccountRow = {
  id: string; bank: string; name: string; type: AccountType; currency: string;
  opening_balance: number; balance: number; last4: string | null;
};

export type ItemRow = { name: string; qty: number; unit_price: number; total: number; position: number };

export type TransactionRow = {
  id: string; type: TxType; merchant: string; category_key: string; account_id: string; to_account_id: string | null;
  date: string; time: string; amount: number; currency: string; account_amount: number | null; to_amount: number | null;
  note: string | null; source: TxSource; receipt_path: string | null; transaction_items?: ItemRow[];
};

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
    ? [...r.transaction_items].sort((a, b) => a.position - b.position).map((i) => ({ name: i.name, qty: Number(i.qty), unitPrice: Number(i.unit_price), total: Number(i.total) }))
    : undefined,
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

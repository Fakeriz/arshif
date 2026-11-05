import type { TxType } from '@/data/types';
import type { MsgKey } from '@/i18n';

export type TxDraft = {
  type: TxType;
  amount: number | null;
  merchant: string;
  accountId: string | null;
  toAccountId: string | null;
  categoryKey: string | null;
  date: string;
};

export type TxErrors = Partial<Record<'amount' | 'merchant' | 'accountId' | 'toAccountId' | 'categoryKey' | 'date', MsgKey>>;

/** Validasi form transaksi manual (FR-TRX-1). Nilai error = kunci i18n. Transfer butuh akun asal dan tujuan yang berbeda. */
export function validateTx(d: TxDraft): TxErrors {
  const e: TxErrors = {};
  if (!d.amount || d.amount <= 0) e.amount = 'domain.validation.amount';
  if (!d.accountId) e.accountId = d.type === 'transfer' ? 'domain.validation.fromAccount' : 'domain.validation.account';
  if (d.type === 'transfer') {
    if (!d.toAccountId) e.toAccountId = 'domain.validation.toAccount';
    else if (d.toAccountId === d.accountId) e.toAccountId = 'domain.validation.sameAccount';
  } else {
    if (!d.merchant.trim()) e.merchant = d.type === 'income' ? 'domain.validation.incomeSource' : 'domain.validation.merchant';
    if (!d.categoryKey) e.categoryKey = 'domain.validation.category';
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date)) e.date = 'domain.validation.date';
  return e;
}

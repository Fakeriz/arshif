import type { TxType } from '@/data/types';

export type TxDraft = {
  type: TxType;
  amount: number | null;
  merchant: string;
  accountId: string | null;
  toAccountId: string | null;
  categoryKey: string | null;
  date: string;
};

export type TxErrors = Partial<Record<'amount' | 'merchant' | 'accountId' | 'toAccountId' | 'categoryKey' | 'date', string>>;

/** Validasi form transaksi manual (FR-TRX-1). Transfer butuh akun asal dan tujuan yang berbeda. */
export function validateTx(d: TxDraft): TxErrors {
  const e: TxErrors = {};
  if (!d.amount || d.amount <= 0) e.amount = 'Isi nominal lebih dari nol.';
  if (!d.accountId) e.accountId = d.type === 'transfer' ? 'Pilih akun asal.' : 'Pilih akun.';
  if (d.type === 'transfer') {
    if (!d.toAccountId) e.toAccountId = 'Pilih akun tujuan.';
    else if (d.toAccountId === d.accountId) e.toAccountId = 'Akun tujuan harus berbeda dari akun asal.';
  } else {
    if (!d.merchant.trim()) e.merchant = d.type === 'income' ? 'Tulis sumber pemasukan.' : 'Tulis nama toko atau keterangan.';
    if (!d.categoryKey) e.categoryKey = 'Pilih kategori.';
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date)) e.date = 'Tanggal harus berformat TTTT-BB-HH.';
  return e;
}

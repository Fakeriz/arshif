import type { MsgKey } from '@/i18n/translate';

export type AccountType = 'tabungan' | 'cash' | 'ewallet' | 'kartu_kredit' | 'paylater';

export type Account = {
  id: string;
  /** Kunci di constants/banks.ts */
  bank: string;
  /** Nama tampilan, mis. "BCA Tabungan". */
  name: string;
  type: AccountType;
  currency: string;
  /** Minor units. Saldo sekarang = opening + efek semua transaksi (lib/transactions). */
  openingBalance: number;
  last4?: string;
};

export type TxType = 'income' | 'expense' | 'transfer';
export type TxSource = 'manual' | 'scan' | 'voice' | 'import' | 'smartlog';

export type ReceiptItem = { name: string; qty: number; unitPrice: number; total: number };

export type Transaction = {
  id: string;
  type: TxType;
  merchant: string;
  categoryKey: string;
  accountId: string;
  /** Hanya transfer. */
  toAccountId?: string;
  /** "YYYY-MM-DD" */
  date: string;
  /** "HH:mm" */
  time: string;
  /** Minor units dalam `currency`, selalu positif. */
  amount: number;
  currency: string;
  /** Jumlah dalam mata uang akun bila beda dari `currency` (FR-OCR-5). */
  accountAmount?: number;
  /** Jumlah masuk di akun tujuan bila mata uangnya beda (transfer). */
  toAmount?: number;
  note?: string;
  source: TxSource;
  items?: ReceiptItem[];
};

export type NotificationType = 'bill_due' | 'budget_alert' | 'weekly_recap' | 'quota_warning' | 'system';

export type AppNotification = {
  id: string;
  type: NotificationType;
  /** Kunci i18n (Fase 1). Fase 2: teks datang dari server dalam bahasa pengguna. */
  titleKey: MsgKey;
  messageKey: MsgKey;
  /** Nilai sisipan teks, mis. nominal yang sudah diformat. */
  vars?: Record<string, string | number>;
  /** "YYYY-MM-DD" */
  date: string;
  /** "HH:mm" */
  time: string;
  read: boolean;
  /** Rute tujuan bila ada. */
  href?: '/coach';
};

export type Plan = 'free' | 'premium';

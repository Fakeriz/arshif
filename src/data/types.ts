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

/** total = harga sebelum diskon (minor units); bayar = total - discount. taxRate dalam persen. */
export type ReceiptItem = { name: string; qty: number; unitPrice: number; total: number; discount?: number; taxRate?: number };

export type ReceiptDiscount = { label?: string; itemName?: string; taxRate?: number; amount: number };
export type ReceiptTaxLine = { rate: number; tax: number; gross?: number };

/** Rincian struk hasil scan. Nominal dalam minor units `currency` transaksi. */
export type ReceiptDetails = {
  subtotal?: number;
  discountTotal?: number;
  taxTotal?: number;
  /** true = harga sudah termasuk pajak (KDV); false = pajak ditambahkan ke subtotal. */
  taxIncluded?: boolean;
  service?: number;
  discounts: ReceiptDiscount[];
  taxLines: ReceiptTaxLine[];
  receiptNo?: string;
  paymentMethod?: string;
  storeAddress?: string;
  storeTaxId?: string;
};

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
  /** Foto struk di bucket privat receipts: "<user_id>/<berkas>". */
  receiptPath?: string;
  items?: ReceiptItem[];
  receipt?: ReceiptDetails;
};

export type NotificationType = 'bill_due' | 'budget_alert' | 'weekly_recap' | 'quota_warning' | 'goal_reached' | 'subscription_renewal' | 'system';

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
  href?: '/coach' | '/anggaran' | '/pengaturan' | '/premium' | '/rencana/goals' | '/rencana/tagihan' | '/rencana/utang' | '/rencana/langganan' | '/rencana/split';
};

export type Plan = 'free' | 'premium';

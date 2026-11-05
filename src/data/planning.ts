import type { Frequency } from '@/lib/planning/schedule';

/** Entitas Planning hub (Fase 4). Nominal dalam unit terkecil mata uangnya, tanggal "YYYY-MM-DD". */

export type Goal = {
  id: string;
  name: string;
  target: number;
  currency: string;
  deadline?: string;
  accountId?: string;
  /** Jumlah semua setoran (dihitung server). */
  collected: number;
  status: 'active' | 'completed';
  completedAt?: string;
};

export type GoalDeposit = { id: string; goalId: string; amount: number; date: string; accountId?: string; transactionId?: string };

export type Bill = {
  id: string;
  name: string;
  amount: number;
  currency: string;
  frequency: Frequency;
  /** Jatuh tempo periode yang belum dibayar. */
  dueDate: string;
  anchorDay: number;
  accountId?: string;
  categoryKey: string;
  /** Tanggal jatuh tempo periode yang sudah lunas. */
  paidPeriods: string[];
};

export type DebtKind = 'debt' | 'receivable';

export type Debt = {
  id: string;
  kind: DebtKind;
  counterparty: string;
  contact?: string;
  principal: number;
  /** Sisa saldo (dikurangi server tiap pembayaran). */
  balance: number;
  /** Bunga per tahun dalam basis poin: 2450 = 24,50%. */
  aprBp: number;
  minPayment: number;
  currency: string;
  dueDate?: string;
  note?: string;
  splitBillId?: string;
  status: 'active' | 'paid';
};

export type DebtPayment = { id: string; debtId: string; amount: number; date: string; transactionId?: string };

export type SubscriptionCycle = 'weekly' | 'monthly' | 'yearly';

export type Subscription = {
  id: string;
  name: string;
  preset?: string;
  amount: number;
  currency: string;
  cycle: SubscriptionCycle;
  nextRenewal: string;
  anchorDay: number;
  accountId?: string;
  categoryKey: string;
  status: 'active' | 'cancelled';
};

export type SplitItem = { id: string; name: string; amount: number; assigned: string[] };

export type SplitParticipant = {
  id: string;
  name: string;
  contact?: string;
  /** Pemilik = pengguna aplikasi (pembayar struk). Menanggung sisa pembulatan. */
  owner: boolean;
  share: number;
  paidAt?: string;
  /** Piutang di Debt Manager untuk bagian yang belum dibayar. */
  debtId?: string;
};

export type SplitBill = {
  id: string;
  title: string;
  currency: string;
  total: number;
  tax: number;
  service: number;
  mode: 'equal' | 'items';
  date: string;
  transactionId?: string;
  items: SplitItem[];
  participants: SplitParticipant[];
};

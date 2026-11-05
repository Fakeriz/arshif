import type { CashflowPoint } from '@/components/ui';

/** Data contoh realistis (ID/MY/TR) untuk Lembar Desain. Bukan data produksi. */

export const sampleTransactions = [
  { id: 't1', merchant: 'Indomaret Kemang Raya', category: 'groceries', account: 'BCA · Tabungan', time: 'Hari ini, 08.14', amount: 87500, currency: 'IDR', kind: 'expense' as const },
  { id: 't2', merchant: 'Kopi Kenangan', category: 'hangout', account: 'GoPay', time: 'Hari ini, 07.52', amount: 28000, currency: 'IDR', kind: 'expense' as const },
  { id: 't3', merchant: 'Gaji Oktober, PT Sinar Niaga', category: 'salary', account: 'Jago · Utama', time: 'Kemarin, 09.00', amount: 14250000, currency: 'IDR', kind: 'income' as const },
  { id: 't4', merchant: 'GoRide ke Sudirman', category: 'transport', account: 'GoPay', time: 'Kemarin, 18.31', amount: 23000, currency: 'IDR', kind: 'expense' as const },
  { id: 't5', merchant: 'Tesco Extra Ampang', category: 'groceries', account: 'Maybank · Savings', time: '3 Nov, 19.05', amount: 14260, currency: 'MYR', kind: 'expense' as const },
  { id: 't6', merchant: 'Migros Kadıköy', category: 'groceries', account: 'Garanti BBVA', time: '2 Nov, 12.40', amount: 64750, currency: 'TRY', kind: 'expense' as const },
];

export const bucketSegments = (hues: { jade: string; saffron: string; sky: string }) => [
  { key: 'needs', label: 'Kebutuhan', caption: 'Batas Rp 7.125.000 · 50%', value: 4380000, color: hues.sky },
  { key: 'wants', label: 'Keinginan', caption: 'Batas Rp 4.275.000 · 30%', value: 2615000, color: hues.saffron },
  { key: 'savings', label: 'Tabungan & Utang', caption: 'Batas Rp 2.850.000 · 20%', value: 2850000, color: hues.jade },
];

export const cashflow: CashflowPoint[] = [
  { label: 'Jun', income: 14250000, expense: 11380000 },
  { label: 'Jul', income: 14250000, expense: 12940000 },
  { label: 'Agu', income: 16750000, expense: 10210000 },
  { label: 'Sep', income: 14250000, expense: 13870000 },
  { label: 'Okt', income: 15400000, expense: 9845000 },
  { label: 'Nov', income: 14250000, expense: 4730000 },
];

export const budgetRows = [
  { category: 'food', label: 'Makan & Minum', used: 1680000, limit: 2400000 },
  { category: 'transport', label: 'Transportasi', used: 812000, limit: 950000 },
  { category: 'hangout', label: 'Nongkrong', used: 1015000, limit: 900000 },
];

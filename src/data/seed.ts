import { EMPTY_USAGE } from '@/lib/quota';
import { convert } from '@/lib/fx';

import type { Account, AppNotification, ReceiptItem, Transaction, TxSource, TxType } from './types';

/**
 * Data contoh Fase 1 (bukan data pengguna). Pengguna fiktif: pekerja ID yang bekerja di
 * Kuala Lumpur, gajian tanggal 25. Fase 2 menggantinya dengan data dari Supabase.
 */
export const DEMO_USER = { name: 'Rani Pratiwi', email: 'rani.pratiwi@example.com' };
export const DEMO_INCOME = 14_250_000;
export const DEMO_PAYDAY = 25;
export const DEMO_MAIN_CURRENCY = 'IDR';

export const seedAccounts: Account[] = [
  { id: 'a-bca', bank: 'bca', name: 'BCA Tabungan', type: 'tabungan', currency: 'IDR', openingBalance: 18_500_000, last4: '2153' },
  { id: 'a-jago', bank: 'jago', name: 'Jago Kantong Utama', type: 'tabungan', currency: 'IDR', openingBalance: 9_200_000, last4: '8810' },
  { id: 'a-gopay', bank: 'gopay', name: 'GoPay', type: 'ewallet', currency: 'IDR', openingBalance: 1_200_000 },
  { id: 'a-mbb', bank: 'maybank', name: 'Maybank Savings', type: 'tabungan', currency: 'MYR', openingBalance: 180_000, last4: '4402' },
];

type Row = [
  id: string, date: string, time: string, merchant: string, cat: string, acc: string, amount: number,
  type?: TxType, source?: TxSource, currency?: string,
];

const rows: Row[] = [
  ['t01', '2026-11-05', '08:14', 'Indomaret Kemang Raya', 'groceries', 'a-bca', 87_500, 'expense', 'scan'],
  ['t02', '2026-11-05', '07:52', 'Kopi Kenangan', 'hangout', 'a-gopay', 28_000, 'expense', 'voice'],
  ['t03', '2026-11-04', '18:31', 'GoRide ke Sudirman', 'transport', 'a-gopay', 23_000],
  ['t04', '2026-11-04', '12:40', 'Warteg Bahari', 'food', 'a-gopay', 32_000, 'expense', 'voice'],
  ['t05', '2026-11-03', '19:05', 'Tesco Extra Ampang', 'groceries', 'a-mbb', 14_260, 'expense', 'scan', 'MYR'],
  ['t06', '2026-11-03', '08:42', 'Grab ke KLCC', 'transport', 'a-mbb', 1_840, 'expense', 'manual', 'MYR'],
  ['t08', '2026-11-02', '20:10', 'Spotify Premium', 'entertainment', 'a-jago', 54_990],
  ['t09', '2026-11-01', '10:05', 'Sewa kos November', 'housing', 'a-bca', 1_750_000],
  ['t10', '2026-11-01', '09:20', 'Token listrik PLN', 'utilities', 'a-bca', 200_000],
  ['t11', '2026-10-31', '19:30', 'Ayam Geprek Bensu', 'food', 'a-gopay', 45_000, 'expense', 'voice'],
  ['t12', '2026-10-30', '14:00', 'Paket data Telkomsel', 'phone', 'a-gopay', 100_000],
  ['t13', '2026-10-29', '16:15', 'Klinik Pratama Kemang', 'health', 'a-bca', 250_000],
  ['t14', '2026-10-29', '16:50', 'Apotek K-24', 'health', 'a-bca', 87_500, 'expense', 'scan'],
  ['t15', '2026-10-28', '21:00', 'Kaos polos, Tokopedia', 'shopping', 'a-jago', 189_000],
  ['t16', '2026-10-28', '15:30', 'Kopi Tuku', 'hangout', 'a-gopay', 32_000],
  ['t17', '2026-10-27', '09:00', 'Transfer ke Jago', 'savings', 'a-bca', 2_000_000, 'transfer'],
  ['t18', '2026-10-27', '18:45', 'Alfamart Cipete', 'groceries', 'a-bca', 64_200],
  ['t19', '2026-10-26', '19:00', 'Bioskop XXI Kuningan', 'entertainment', 'a-gopay', 100_000],
  ['t20', '2026-10-26', '13:10', 'Nasi Padang Sederhana', 'food', 'a-gopay', 38_000],
  ['t21', '2026-10-25', '09:00', 'Gaji Oktober, PT Sinar Niaga', 'salary', 'a-bca', 14_250_000, 'income'],
  ['t22', '2026-10-25', '09:30', 'Setoran dana darurat', 'savings', 'a-bca', 1_500_000],
  ['t23', '2026-10-24', '12:20', 'Soto Betawi Haji Husein', 'food', 'a-gopay', 41_000],
  ['t24', '2026-10-23', '08:30', 'GoRide ke Kuningan', 'transport', 'a-gopay', 19_000],
  ['t25', '2026-10-22', '20:15', 'Hypermart Cilandak', 'groceries', 'a-bca', 312_400],
  ['t26', '2026-10-21', '19:40', 'Nongkrong, Fore Coffee', 'hangout', 'a-gopay', 58_000],
  ['t27', '2026-10-20', '13:00', 'Bakmi GM', 'food', 'a-gopay', 67_000],
  ['t28', '2026-10-26', '17:25', 'Cicilan laptop', 'debt', 'a-bca', 750_000],
];

const receiptItems: ReceiptItem[] = [
  { name: 'Indomie Goreng', qty: 5, unitPrice: 3_500, total: 17_500 },
  { name: 'Telur Ayam 1 kg', qty: 1, unitPrice: 29_000, total: 29_000 },
  { name: 'Susu UHT 1 L', qty: 2, unitPrice: 19_500, total: 39_000 },
  { name: 'Kantong belanja', qty: 1, unitPrice: 2_000, total: 2_000 },
];

export const seedTransactions: Transaction[] = [
  ...rows.map(([id, date, time, merchant, categoryKey, accountId, amount, type = 'expense', source = 'manual', currency = 'IDR']): Transaction => ({
    id, date, time, merchant, categoryKey, accountId, amount, type, source, currency,
    ...(type === 'transfer' ? { toAccountId: 'a-jago' } : {}),
    ...(id === 't01' ? { items: receiptItems } : {}),
  })),
  // Belanja saat liburan di Istanbul: mata uang struk (TRY) beda dari mata uang akun (MYR).
  {
    id: 't07', date: '2026-11-02', time: '12:40', merchant: 'Migros Kadıköy', categoryKey: 'groceries',
    accountId: 'a-mbb', amount: 64_750, currency: 'TRY', accountAmount: convert(64_750, 'TRY', 'MYR'),
    type: 'expense', source: 'scan', note: 'Belanja saat transit di Istanbul',
  },
];

export const seedNotifications: AppNotification[] = [
  { id: 'n1', type: 'weekly_recap', titleKey: 'domain.notif.recapTitle', messageKey: 'domain.notif.recapMessage', date: '2026-11-02', time: '07:00', read: false, href: '/coach' },
  { id: 'n2', type: 'budget_alert', titleKey: 'domain.notif.budgetTitle', messageKey: 'domain.notif.budgetMessage', vars: { pct: 82, amount: 'Rp 35.010', days: 20 }, date: '2026-11-04', time: '18:31', read: false },
  { id: 'n3', type: 'bill_due', titleKey: 'domain.notif.billTitle', messageKey: 'domain.notif.billMessage', vars: { biller: 'TNB', amount: 'RM 142.30' }, date: '2026-11-05', time: '07:00', read: true },
  { id: 'n4', type: 'quota_warning', titleKey: 'domain.notif.quotaTitle', messageKey: 'domain.notif.quotaMessage', vars: { left: 6, used: 14, limit: 20 }, date: '2026-11-03', time: '19:05', read: true },
];

/** Hasil ekstraksi AI contoh untuk layar review struk. Field `conf` = keyakinan 0-1. */
export const sampleScan = {
  merchant: { value: 'Indomaret Kemang Raya', conf: 0.96 },
  date: { value: '2026-11-05', conf: 0.93 },
  time: '08:14',
  total: { value: 87_500, conf: 0.98 },
  subtotal: 87_500,
  category: { value: 'groceries', conf: 0.62 },
  currency: 'IDR',
  items: [
    { name: 'Indomie Goreng', qty: 5, unitPrice: 3_500, total: 17_500 },
    { name: 'Telur Ayam 1 kg', qty: 1, unitPrice: 29_000, total: 29_000 },
    // Susu UHT terbaca 36.000 padahal 39.000: memicu peringatan selisih item vs subtotal.
    { name: 'Susu UHT 1 L', qty: 2, unitPrice: 19_500, total: 36_000 },
    { name: 'Kantong belanja', qty: 1, unitPrice: 2_000, total: 2_000 },
  ] as ReceiptItem[],
};

/** Hasil Voice Log contoh. `accountHint` tidak cocok dengan akun mana pun, jadi memakai akun default. */
export const sampleVoice = {
  transcript: 'Tadi makan siang empat puluh lima ribu pakai GoPay, terus isi bensin seratus lima puluh ribu cash.',
  items: [
    { id: 'v1', merchant: 'Makan siang', categoryKey: 'food', amount: 45_000, accountHint: 'GoPay', accountId: 'a-gopay' },
    { id: 'v2', merchant: 'Isi bensin', categoryKey: 'fuel', amount: 150_000, accountHint: 'cash', accountId: null as string | null },
  ],
};

export const sampleStatement = {
  fileName: 'Rekening_Koran_BCA_Okt2026.pdf',
  sizeLabel: '412 KB · 3 halaman',
  rows: [
    { id: 's1', date: '2026-10-29', description: 'APOTEK K-24 KEMANG', amount: 87_500, type: 'expense' as const },
    { id: 's2', date: '2026-10-29', description: 'KLINIK PRATAMA KEMANG', amount: 250_000, type: 'expense' as const },
    { id: 's3', date: '2026-10-30', description: 'BIAYA ADM BULANAN', amount: 12_500, type: 'expense' as const },
    { id: 's4', date: '2026-10-31', description: 'TRF DARI AYAH', amount: 500_000, type: 'income' as const },
    { id: 's5', date: '2026-11-01', description: 'SEWA KOS NOVEMBER', amount: 1_750_000, type: 'expense' as const },
    { id: 's6', date: '2026-11-02', description: 'BUNGA TABUNGAN', amount: 8_300, type: 'income' as const },
  ],
};

/** Batas per kategori (minor units, IDR) untuk periode ini. Pengaturan per kategori dibangun menyusul. */
export const DEMO_CATEGORY_LIMITS: Record<string, number> = {
  groceries: 1_200_000,
  food: 1_000_000,
  transport: 400_000,
  housing: 1_800_000,
  utilities: 300_000,
  phone: 150_000,
  health: 300_000,
  hangout: 300_000,
  entertainment: 190_000,
  shopping: 500_000,
};

/** Tagihan periode ini (modul Tagihan belum dibangun, jadi konstanta contoh) dan skor bulan lalu. */
export const DEMO_BILLS = { due: 6, onTime: 5 };
export const DEMO_PREVIOUS_SCORE = 72;

export const seedUsage = { ...EMPTY_USAGE, accounts: 4, scan: 14, automation: 12 };

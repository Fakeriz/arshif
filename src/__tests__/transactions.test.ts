import { seedAccounts, seedTransactions } from '@/data/seed';
import type { Account, Transaction } from '@/data/types';
import { computeNetWorth } from '@/lib/assets';
import { accountBalance, filterTransactions, groupByDay, isFilterActive, totals } from '@/lib/transactions';
import { convert } from '@/lib/fx';

/** Kekayaan bersih rekening saja lewat satu-satunya rumus (computeNetWorth). */
const accountsNetWorth = (accounts: Account[], txs: Transaction[], main: string) =>
  computeNetWorth({ accounts: accounts.map((a) => ({ ...a, balance: accountBalance(a, txs) })), assets: [], prices: {}, debts: [], main, now: Date.now() }).total;

const bal = (id: string) => accountBalance(seedAccounts.find((a) => a.id === id)!, seedTransactions);

describe('saldo akun dari transaksi', () => {
  it('menurunkan saldo tiap akun dari saldo awal + semua efek', () => {
    expect(bal('a-bca')).toBe(25_748_400);
    expect(bal('a-jago')).toBe(10_956_010); // termasuk transfer masuk Rp 2.000.000
    expect(bal('a-gopay')).toBe(617_000);
    expect(bal('a-mbb')).toBe(157_529); // belanja TRY memotong MYR sesuai accountAmount
  });

  it('kekayaan bersih = jumlah saldo yang dikonversi ke mata uang utama', () => {
    const expected = seedAccounts.reduce((s, a) => s + convert(bal(a.id), a.currency, 'IDR'), 0);
    expect(accountsNetWorth(seedAccounts, seedTransactions, 'IDR')).toBe(expected);
    expect(expected).toBeGreaterThan(43_000_000);
  });

  it('kartu kredit bersaldo negatif mengurangi kekayaan bersih', () => {
    const card = { ...seedAccounts[0], id: 'a-cc', type: 'kartu_kredit' as const, openingBalance: -3_000_000 };
    expect(accountsNetWorth([...seedAccounts, card], seedTransactions, 'IDR') - accountsNetWorth(seedAccounts, seedTransactions, 'IDR')).toBe(-3_000_000);
  });
});

describe('filter, pencarian, kelompok', () => {
  it('mencari di merchant, catatan, dan nama kategori', () => {
    expect(filterTransactions(seedTransactions, { query: 'kopi' }).map((t) => t.id).sort()).toEqual(['t02', 't16']);
    expect(filterTransactions(seedTransactions, { query: 'istanbul' }).map((t) => t.id)).toEqual(['t07']);
    expect(filterTransactions(seedTransactions, { query: 'tagihan' })).toHaveLength(0);
  });

  it('filter tipe dan akun (transfer ikut tampil di akun tujuan)', () => {
    expect(filterTransactions(seedTransactions, { type: 'income' })).toHaveLength(1);
    expect(filterTransactions(seedTransactions, { type: 'transfer', accountId: 'a-jago' })).toHaveLength(1);
    expect(filterTransactions(seedTransactions, { categoryKey: 'food', accountId: 'a-gopay' }).length).toBeGreaterThan(3);
  });

  it('isFilterActive abaikan query kosong dan tipe "all"', () => {
    expect(isFilterActive({ query: '  ', type: 'all' })).toBe(false);
    expect(isFilterActive({ type: 'expense' })).toBe(true);
  });

  it('dikelompokkan per tanggal, terbaru dulu, jam terbaru dulu', () => {
    const groups = groupByDay(seedTransactions);
    expect(groups[0].date).toBe('2026-11-05');
    expect(groups[0].items.map((t) => t.id)).toEqual(['t01', 't02']);
    expect(groups.map((g) => g.date)).toEqual([...groups.map((g) => g.date)].sort().reverse());
  });

  it('total pemasukan dan pengeluaran dalam mata uang utama', () => {
    const txs: Transaction[] = [
      { id: 'x1', type: 'income', merchant: 'Gaji', categoryKey: 'salary', accountId: 'a', date: '2026-11-01', time: '09:00', amount: 1_000_000, currency: 'IDR', source: 'manual' },
      { id: 'x2', type: 'expense', merchant: 'Kopi', categoryKey: 'hangout', accountId: 'a', date: '2026-11-01', time: '10:00', amount: 100, currency: 'USD', source: 'manual' },
    ];
    expect(totals(txs, 'IDR')).toEqual({ income: 1_000_000, expense: 16_250 });
  });
});

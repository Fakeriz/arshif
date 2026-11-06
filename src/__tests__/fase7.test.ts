import type { Account, BudgetRecord, LimitGroup, Transaction } from '@/data/types';
import { accountFromDraft, parsePayday } from '@/features/setup/draft';
import { parseRate } from '@/features/fx/RateSheet';
import {
  averageBudget, budgetFor, budgetPeriod, copyBudget, pace, paceRatio, previousBudgets, safeToSpend, spendByCategory,
} from '@/lib/budget';
import { cardUtilization, feeStatus, groupUtilization, lastFeeDate, markFeePaid, nextFeeDate, unmarkFeePaid } from '@/lib/credit';
import * as fx from '@/lib/fx';
import { monthlyRecap, weeklyRecap } from '@/lib/recap';
import { amountIn, netWorth, reimbursementIncomeIds, totals } from '@/lib/transactions';
import { initialState, keepReimbursement, reducer } from '@/state/reducer';

const tx = (o: Partial<Transaction> & Pick<Transaction, 'id' | 'date' | 'amount'>): Transaction => ({
  type: 'expense', merchant: o.id, categoryKey: 'food', accountId: 'a', time: '10:00', currency: 'IDR', source: 'manual', ...o,
});

afterEach(() => {
  // Kembalikan kurs contoh dari jest.setup.
  fx.setUsdRates(fx.SAMPLE_USD_RATES, '2026-11-05');
  fx.setRateHistory([]);
  fx.setUserRates([]);
});

describe('budget pace (FR-BDG-5): rasio = (terpakai/anggaran) / (hari berjalan/total hari)', () => {
  it('3 tingkat dengan nilai diketahui: <= 1 Sesuai laju, <= 1,2 Agak cepat, > 1,2 Terlalu cepat', () => {
    // Periode 30 hari, hari ke-15 (50% waktu), anggaran 3.000.000.
    expect(paceRatio(1_500_000, 3_000_000, 15, 30)).toBe(1);
    expect(pace(1_500_000, 3_000_000, 15, 30)).toBe('sesuai');
    expect(pace(1_650_000, 3_000_000, 15, 30)).toBe('agak_cepat'); // 1,1
    expect(pace(1_800_000, 3_000_000, 15, 30)).toBe('agak_cepat'); // 1,2 tepat
    expect(pace(1_830_000, 3_000_000, 15, 30)).toBe('terlalu_cepat'); // 1,22
    expect(pace(500_000, 0, 15, 30)).toBe('sesuai'); // tanpa anggaran
  });

  it('aman dibelanjakan = sisa ÷ hari tersisa', () => {
    // Sisa 1.200.000 untuk 16 hari = 75.000/hari.
    expect(safeToSpend(3_000_000, 1_800_000, 16)).toBe(75_000);
    expect(safeToSpend(3_000_000, 3_500_000, 16)).toBe(0);
  });
});

describe('payday (FR-BDG-6)', () => {
  it('gajian 25: periode 25 sampai 24 bulan berikutnya', () => {
    expect(budgetPeriod('2026-11-05', 25)).toEqual({ start: '2026-10-25', end: '2026-11-24', totalDays: 31, elapsedDays: 12, daysLeft: 20 });
    expect(budgetPeriod('2026-11-25', 25)).toMatchObject({ start: '2026-11-25', end: '2026-12-24' });
    expect(budgetPeriod('2026-01-10', 25)).toMatchObject({ start: '2025-12-25', end: '2026-01-24' });
  });

  it('bawaan tanggal 1 = bulan kalender', () => {
    expect(budgetPeriod('2026-02-14', 1)).toMatchObject({ start: '2026-02-01', end: '2026-02-28', totalDays: 28 });
  });

  it('pace memakai periode yang bergeser', () => {
    const p = budgetPeriod('2026-11-05', 25); // 12 dari 31 hari
    // 50% anggaran di hari ke-12 dari 31 = rasio 1,29: terlalu cepat. Dengan periode kalender (5/30) jauh lebih parah.
    expect(pace(500, 1000, p.elapsedDays, p.totalDays)).toBe('terlalu_cepat');
    expect(pace(380, 1000, p.elapsedDays, p.totalDays)).toBe('sesuai'); // 0,98
  });

  it('tanggal gajian hanya 1-28', () => {
    expect(parsePayday('28')).toBe(28);
    expect(parsePayday('29')).toBeNull();
    expect(parsePayday('0')).toBeNull();
    const s = reducer({ ...initialState(), payday: 25 }, { type: 'prefs/payday', payday: 31 });
    expect(s.payday).toBe(25);
    expect(reducer(s, { type: 'prefs/payday', payday: 10 }).payday).toBe(10);
  });
});

describe('anggaran per periode: salin bulan lalu + saran rata-rata 3 bulan', () => {
  const rec = (periodStart: string, total: number, categoryLimits: Record<string, number> = {}): BudgetRecord => ({ id: periodStart, periodStart, total, categoryLimits });
  const records = [
    rec('2026-10-25', 6_000_000, { food: 1_500_000, transport: 600_000 }),
    rec('2026-09-25', 5_000_000, { food: 1_200_000 }),
    rec('2026-08-25', 4_000_000, { food: 1_000_001, hangout: 300_000 }),
    rec('2026-07-25', 9_000_000, { food: 9_000_000 }),
  ];

  it('anggaran periode ini dan periode-periode sebelumnya', () => {
    expect(budgetFor(records, '2026-10-25')?.total).toBe(6_000_000);
    expect(budgetFor(records, '2026-11-25')).toBeNull();
    expect(previousBudgets(records, '2026-11-25', 3).map((r) => r.periodStart)).toEqual(['2026-10-25', '2026-09-25', '2026-08-25']);
  });

  it('salin bulan lalu: total + per kategori apa adanya (salinan, bukan referensi)', () => {
    const c = copyBudget(records[0]!);
    expect(c).toEqual({ total: 6_000_000, categoryLimits: { food: 1_500_000, transport: 600_000 } });
    c.categoryLimits.food = 1;
    expect(records[0]!.categoryLimits.food).toBe(1_500_000);
  });

  it('saran = rata-rata anggaran 3 periode terakhir; kategori dirata-rata dari periode yang membatasinya', () => {
    const s = averageBudget(previousBudgets(records, '2026-11-25', 3), 'IDR')!;
    expect(s.total).toBe(5_000_000);
    // food: (1.500.000 + 1.200.000 + 1.000.001) / 3 = 1.233.333,67 -> dibulatkan ke ribuan.
    expect(s.categoryLimits).toEqual({ food: 1_233_000, transport: 600_000, hangout: 300_000 });
    expect(averageBudget([], 'IDR')).toBeNull();
    // Berdesimal: dibulatkan ke satuan utuh (RM 1.234,56 -> RM 1.235,00).
    expect(averageBudget([rec('2026-10-01', 123_456)], 'MYR')!.total).toBe(123_500);
  });

  it('reducer: simpan anggaran mengganti baris periode yang sama', () => {
    let s = reducer(initialState(), { type: 'budget/save', budget: rec('2026-10-25', 1) });
    s = reducer(s, { type: 'budget/save', budget: rec('2026-10-25', 2) });
    s = reducer(s, { type: 'budget/save', budget: rec('2026-11-25', 3) });
    expect(s.budgets.map((b) => [b.periodStart, b.total])).toEqual([['2026-11-25', 3], ['2026-10-25', 2]]);
  });
});

describe('grup limit gabungan (FR-ACC-6)', () => {
  const card = (id: string, balance: number, o: Partial<Account> = {}) => ({
    id, bank: 'bca', name: id, type: 'kartu_kredit' as const, currency: 'IDR', openingBalance: 0, balance, ...o,
  });
  const group: LimitGroup = { id: 'g', name: 'BCA gabungan', currency: 'IDR', sharedLimit: 20_000_000 };
  const a = card('a', -4_000_000, { creditLimit: 10_000_000, limitGroupId: 'g' });
  const b = card('b', -6_000_000, { creditLimit: 15_000_000, limitGroupId: 'g' });
  const c = card('c', -1_000_000, { creditLimit: 5_000_000 });
  const all = [a, b, c];

  it('utilisasi grup = gabungan terpakai ÷ limit gabungan, bukan jumlah utilisasi', () => {
    const u = groupUtilization(group, all);
    expect(u).toMatchObject({ scope: 'group', used: 10_000_000, limit: 20_000_000, members: 2 });
    expect(u.ratio).toBe(0.5);
    // Jumlah utilisasi per kartu akan 0,4 + 0,4 = 0,8: bukan itu.
    expect(u.ratio).not.toBeCloseTo(4 / 10 + 6 / 15);
    expect(cardUtilization(a, [group], all)).toEqual(u);
    expect(cardUtilization(b, [group], all)?.ratio).toBe(0.5);
  });

  it('kartu di luar grup memakai limit sendiri', () => {
    expect(cardUtilization(c, [group], all)).toEqual({ scope: 'card', used: 1_000_000, limit: 5_000_000, currency: 'IDR', ratio: 0.2 });
  });

  it('saldo positif = 0 terpakai; tabungan tanpa limit = null; kartu mata uang lain dikonversi', () => {
    expect(cardUtilization(card('d', 50_000, { creditLimit: 1_000_000 }), [], [])?.used).toBe(0);
    expect(cardUtilization({ ...card('e', 0), type: 'tabungan' }, [], [])).toBeNull();
    const usd = card('f', -100, { currency: 'USD', limitGroupId: 'g' }); // $1 = Rp16.250
    expect(groupUtilization(group, [a, usd]).used).toBe(4_016_250);
  });

  it('reducer: anggota grup ditambah/dilepas; hapus grup melepas semua kartu', () => {
    const base = { ...initialState(), accounts: [a, b, c].map(({ balance: _b, ...x }) => x) };
    let s = reducer(base, { type: 'limitGroup/update', group, members: ['a', 'c'] });
    expect(s.accounts.map((x) => x.limitGroupId)).toEqual(['g', undefined, 'g']);
    s = reducer(s, { type: 'limitGroup/delete', id: 'g' });
    expect(s.accounts.every((x) => x.limitGroupId === undefined)).toBe(true);
  });
});

describe('iuran tahunan + waiver (FR-ACC-7)', () => {
  const fee = { amount: 300_000, month: 3, day: 15, waiverThreshold: 20_000_000, paid: [] as string[] };

  it('tanggal tagih terakhir dan berikutnya; 31 di bulan pendek', () => {
    expect(lastFeeDate(fee, '2026-11-05')).toBe('2026-03-15');
    expect(nextFeeDate(fee, '2026-11-05')).toBe('2027-03-15');
    expect(lastFeeDate(fee, '2026-03-15')).toBe('2026-03-15');
    expect(lastFeeDate(fee, '2026-03-14')).toBe('2025-03-15');
    expect(lastFeeDate({ month: 2, day: 31 }, '2026-11-05')).toBe('2026-02-28');
  });

  it('progress waiver = belanja kartu itu sejak tanggal iuran terakhir vs ambang', () => {
    const txs = [
      tx({ id: '1', date: '2026-03-14', amount: 9_000_000, accountId: 'cc' }), // sebelum tanggal iuran
      tx({ id: '2', date: '2026-03-15', amount: 5_000_000, accountId: 'cc' }),
      tx({ id: '3', date: '2026-10-01', amount: 7_000_000, accountId: 'cc' }),
      tx({ id: '4', date: '2026-10-02', amount: 9_000_000, accountId: 'lain' }), // kartu lain
      tx({ id: '5', date: '2026-10-03', amount: 300_000, accountId: 'cc', categoryKey: 'bank' }), // biaya bank
      tx({ id: '6', date: '2026-10-04', amount: 1_000_000, accountId: 'cc', type: 'income' }),
    ];
    const s = feeStatus({ id: 'cc', annualFee: fee }, txs, '2026-11-05');
    expect(s).toMatchObject({ lastDate: '2026-03-15', spent: 12_000_000, remaining: 8_000_000, paid: false });
    expect(s.progress).toBe(0.6);
  });

  it('riwayat bayar: tandai, tanpa duplikat, batal', () => {
    const paid = markFeePaid(markFeePaid(markFeePaid(fee, '2026-03-15'), '2025-03-15'), '2026-03-15');
    expect(paid.paid).toEqual(['2025-03-15', '2026-03-15']);
    expect(feeStatus({ id: 'cc', annualFee: paid }, [], '2026-11-05').paid).toBe(true);
    expect(unmarkFeePaid(paid, '2026-03-15').paid).toEqual(['2025-03-15']);
  });
});

describe('Paylater (FR-ACC-8)', () => {
  it('limit + saldo seperti kartu kredit: tagihan berjalan disimpan negatif', () => {
    const a = accountFromDraft({ name: ' Kredivo ', type: 'paylater', bank: 'cash', currency: 'IDR', opening: 750_000, creditLimit: 5_000_000 });
    expect(a).toEqual({ bank: 'cash', name: 'Kredivo', type: 'paylater', currency: 'IDR', openingBalance: -750_000, creditLimit: 5_000_000 });
    const card = { id: 'p', ...a, balance: a.openingBalance };
    expect(cardUtilization(card, [], [card])?.ratio).toBe(0.15);
    expect(accountFromDraft({ name: 'BCA', type: 'tabungan', bank: 'bca', currency: 'IDR', opening: 100, creditLimit: 5 })).toMatchObject({ openingBalance: 100, creditLimit: undefined });
  });
});

describe('kurs per hari + "Kurs saya" (FR-FX-4)', () => {
  const history = [
    { date: '2026-10-01', code: 'USD', perUsd: '1' },
    { date: '2026-10-01', code: 'IDR', perUsd: '15000' },
    { date: '2026-11-04', code: 'IDR', perUsd: '18000' },
  ];

  it('transaksi lama tetap memakai kurs harinya walau kurs bergerak; saldo memakai kurs hari ini', () => {
    fx.setUsdRates({ IDR: '18000' }, '2026-11-04');
    fx.setRateHistory(history);
    const old = tx({ id: 'o', date: '2026-10-15', amount: 1000, currency: 'USD' }); // $10
    expect(amountIn(old, 'IDR')).toBe(150_000); // kurs 1 Okt (terakhir <= 15 Okt)
    expect(amountIn({ ...old, date: '2026-11-05' }, 'IDR')).toBe(180_000);
    // Kurs bergerak lagi: transaksi lama tidak berubah.
    fx.addRateHistory([{ date: '2026-11-05', code: 'IDR', perUsd: '20000' }]);
    fx.setUsdRates({ IDR: '20000' }, '2026-11-05');
    expect(amountIn(old, 'IDR')).toBe(150_000);
    // Saldo akun USD $10 memakai kurs hari ini.
    const acc: Account = { id: 'u', bank: 'cash', name: 'USD', type: 'cash', currency: 'USD', openingBalance: 1000 };
    expect(netWorth([acc], [], 'IDR')).toBe(200_000);
  });

  it('"Kurs saya" dipakai bila tidak ada kurs harian; kurs harian selalu menang', () => {
    fx.setUsdRates({ IDR: '18000' }, '2026-11-04');
    fx.setUserRates([{ code: 'SAR', base: 'IDR', rate: '4500' }, { code: 'IDR', base: 'USD', rate: '0.0001' }]);
    expect(fx.hasRate('SAR')).toBe(true);
    // 1 SAR = 4.500 IDR -> SAR 10,00 = Rp45.000
    expect(amountIn(tx({ id: 's', date: '2026-11-01', amount: 1000, currency: 'SAR' }), 'IDR')).toBe(45_000);
    // IDR punya kurs harian: kurs sendiri untuk IDR diabaikan.
    expect(fx.convert(18_000, 'IDR', 'USD')).toBe(100);
  });

  it('tanpa kurs harian dan tanpa kurs saya: tidak ditebak, diminta isi', () => {
    expect(fx.hasRate('VND')).toBe(false);
    expect(fx.missingRates(['IDR', 'VND', 'SAR', 'VND'])).toEqual(['SAR', 'VND']);
    expect(() => fx.convertOn(1000, 'VND', 'IDR', '2026-11-01')).toThrow(fx.MissingRateError);
    expect(amountIn(tx({ id: 'v', date: '2026-11-01', amount: 50_000, currency: 'VND' }), 'IDR')).toBe(0);
    expect(fx.tryConvert(1000, 'VND', 'IDR')).toBeNull();
  });

  it('tabel server dilengkapi kurs saya untuk menghitung nominal akun', () => {
    fx.setUserRates([{ code: 'SAR', base: 'IDR', rate: '4500' }]);
    const table = fx.withUserRates({ IDR: '18000' }, '2026-11-01');
    expect(fx.convert(1000, 'SAR', 'IDR', table)).toBe(45_000);
  });

  it('input kurs: satu pemisah desimal, tanpa ribuan', () => {
    expect(parseRate('4350')).toBe('4350');
    expect(parseRate('4350,5')).toBe('4350.5');
    expect(parseRate('0.000062')).toBe('0.000062');
    expect(parseRate('4.350,5')).toBeNull();
    expect(parseRate('0')).toBeNull();
    expect(parseRate('abc')).toBeNull();
  });
});

describe('reimbursement (FR-TRX-4)', () => {
  const expense = tx({ id: 'e', date: '2026-11-01', amount: 300_000, reimburseStatus: 'reimbursed', reimbursedBy: 'i' });
  const repay = tx({ id: 'i', date: '2026-11-03', amount: 300_000, type: 'income', categoryKey: 'other' });
  const salary = tx({ id: 's', date: '2026-11-01', amount: 5_000_000, type: 'income', categoryKey: 'salary' });
  const food = tx({ id: 'f', date: '2026-11-02', amount: 50_000 });

  it('tidak masuk total pemasukan maupun belanja', () => {
    const all = [expense, repay, salary, food];
    expect(totals(all, 'IDR')).toEqual({ income: 5_000_000, expense: 50_000 });
    // Daftar tersaring tanpa pengeluarannya: pengganti tetap dikenali dari semua transaksi.
    expect(totals([repay, salary], 'IDR', reimbursementIncomeIds(all))).toEqual({ income: 5_000_000, expense: 0 });
    expect(spendByCategory([expense, food, { ...expense, id: 'p', reimburseStatus: 'pending', reimbursedBy: undefined }], budgetPeriod('2026-11-05', 1), 'IDR')).toEqual([{ categoryKey: 'food', spent: 50_000 }]);
  });

  it('alur pending -> reimbursed dengan tautan; hapus pengganti = pending lagi', () => {
    let s = { ...initialState(), transactions: [{ ...expense, reimburseStatus: undefined, reimbursedBy: undefined }, repay] };
    s = reducer(s, { type: 'tx/reimburse', id: 'e', status: 'pending', reimbursedBy: null });
    expect(s.transactions[0]).toMatchObject({ reimburseStatus: 'pending', reimbursedBy: undefined });
    s = reducer(s, { type: 'tx/reimburse', id: 'e', status: 'pending', reimbursedBy: 'i' });
    expect(s.transactions[0]).toMatchObject({ reimburseStatus: 'reimbursed', reimbursedBy: 'i' });
    s = reducer(s, { type: 'tx/delete', id: 'i' });
    expect(s.transactions).toHaveLength(1);
    expect(s.transactions[0]).toMatchObject({ reimburseStatus: 'pending', reimbursedBy: undefined });
    s = reducer(s, { type: 'tx/reimburse', id: 'e', status: null, reimbursedBy: null });
    expect(s.transactions[0]!.reimburseStatus).toBeUndefined();
  });

  it('form ubah transaksi tidak menghapus status reimbursement', () => {
    const edited = { ...food, id: 'e', amount: 310_000 };
    expect(keepReimbursement(edited, expense)).toMatchObject({ amount: 310_000, reimburseStatus: 'reimbursed', reimbursedBy: 'i' });
    expect(keepReimbursement({ ...edited, type: 'income' }, expense).reimburseStatus).toBeUndefined();
  });
});

describe('Weekly Replay (FR-COACH-5)', () => {
  // Kamis 5 Nov 2026: minggu berjalan Senin 2 Nov - Kamis 5 Nov; dibanding Senin 26 - Kamis 29 Okt.
  const txs = [
    tx({ id: 'p1', date: '2026-10-26', amount: 200_000, categoryKey: 'food' }),
    tx({ id: 'p2', date: '2026-10-27', amount: 100_000, categoryKey: 'shopping' }),
    tx({ id: 'p3', date: '2026-10-31', amount: 999_000, categoryKey: 'shopping' }), // Sabtu: di luar rentang pembanding
    tx({ id: 'c1', date: '2026-11-02', amount: 50_000, categoryKey: 'food', merchant: 'Warteg' }),
    tx({ id: 'c2', date: '2026-11-04', amount: 120_000, categoryKey: 'shopping', merchant: 'Toko Buku' }),
    tx({ id: 'c3', date: '2026-11-04', amount: 500_000, categoryKey: 'savings' }),
    tx({ id: 'c4', date: '2026-11-03', amount: 80_000, categoryKey: 'food', reimburseStatus: 'pending' }),
  ];

  it('minggu berjalan: belanja terbesar, hemat terbesar, pencapaian; dibanding hari yang sama', () => {
    const r = weeklyRecap(txs, '2026-11-05', 'IDR', 'this');
    expect(r).toMatchObject({ start: '2026-11-02', end: '2026-11-05', days: 4, spent: 170_000, previousSpent: 300_000, changePct: -43, noSpendDays: 2, savedAmount: 500_000 });
    expect(r.biggest?.merchant).toBe('Toko Buku');
    expect(r.biggestSaving).toEqual({ categoryKey: 'food', saved: 150_000 });
    expect(r.achievements).toEqual(['noSpend', 'spentLess', 'saved', 'cooked']);
  });

  it('minggu lalu penuh, dan kosong bila belum ada data', () => {
    expect(weeklyRecap(txs, '2026-11-05', 'IDR', 'last')).toMatchObject({ start: '2026-10-26', end: '2026-11-01', days: 7, spent: 1_299_000 });
    const empty = weeklyRecap([], '2026-11-05', 'IDR', 'this');
    expect(empty).toMatchObject({ txCount: 0, spent: 0, biggest: null, biggestSaving: null, achievements: [] });
  });
});

describe('recap bulanan (Premium)', () => {
  it('bulan kalender lalu penuh vs bulan sebelumnya; reimbursement tidak dihitung', () => {
    const txs = [
      tx({ id: 'a', date: '2026-09-10', amount: 400_000, categoryKey: 'food' }),
      tx({ id: 'b', date: '2026-10-01', amount: 100_000, categoryKey: 'food' }),
      tx({ id: 'c', date: '2026-10-31', amount: 200_000, categoryKey: 'shopping', merchant: 'Sepatu' }),
      tx({ id: 'd', date: '2026-10-15', amount: 999_000, categoryKey: 'food', reimburseStatus: 'pending' }),
      tx({ id: 'e', date: '2026-11-02', amount: 50_000 }),
    ];
    const r = monthlyRecap(txs, '2026-11-05', 'IDR');
    expect(r).toMatchObject({ week: 'month', start: '2026-10-01', end: '2026-10-31', days: 31, spent: 300_000, previousSpent: 400_000, changePct: -25 });
    expect(r.biggest?.merchant).toBe('Sepatu');
    expect(r.biggestSaving).toEqual({ categoryKey: 'food', saved: 300_000 });
    expect(monthlyRecap(txs, '2026-01-15', 'IDR')).toMatchObject({ start: '2025-12-01', end: '2025-12-31', txCount: 0 });
  });
});

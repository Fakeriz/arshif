import type { Transaction } from '@/data/types';
import { BUCKETS, bucketLimits, budgetPeriod, pace, safeToSpend, spendByBucket, spendByCategory, splitIsValid } from '@/lib/budget';
import { healthPillars, healthScore } from '@/lib/health';

describe('periode anggaran mengikuti tanggal gajian', () => {
  it('gajian tanggal 25: 5 Nov masuk periode 25 Okt-24 Nov', () => {
    expect(budgetPeriod('2026-11-05', 25)).toEqual({ start: '2026-10-25', end: '2026-11-24', totalDays: 31, elapsedDays: 12, daysLeft: 20 });
  });

  it('hari gajian sendiri membuka periode baru', () => {
    expect(budgetPeriod('2026-11-25', 25)).toMatchObject({ start: '2026-11-25', end: '2026-12-24', elapsedDays: 1 });
  });

  it('gajian tanggal 1 = bulan kalender; gajian tgl 31 dipangkas di bulan pendek', () => {
    expect(budgetPeriod('2026-11-05', 1)).toMatchObject({ start: '2026-11-01', end: '2026-11-30', totalDays: 30, daysLeft: 26 });
    expect(budgetPeriod('2026-11-05', 31)).toMatchObject({ start: '2026-10-31', end: '2026-11-29' });
  });

  it('lintas tahun', () => {
    expect(budgetPeriod('2026-01-10', 25)).toMatchObject({ start: '2025-12-25', end: '2026-01-24' });
    expect(budgetPeriod('2026-12-30', 25)).toMatchObject({ start: '2026-12-25', end: '2027-01-24' });
  });
});

describe('batas bucket 50/30/20', () => {
  it('membagi penghasilan, sisa pembulatan masuk Tabungan', () => {
    expect(bucketLimits(14_250_000, { needs: 50, wants: 30, savings: 20 })).toEqual({ needs: 7_125_000, wants: 4_275_000, savings: 2_850_000 });
    const odd = bucketLimits(1001, { needs: 50, wants: 30, savings: 20 });
    expect(odd.needs + odd.wants + odd.savings).toBe(1001);
  });

  it('persentase valid hanya bila total 100', () => {
    expect(splitIsValid({ needs: 60, wants: 20, savings: 20 })).toBe(true);
    expect(splitIsValid({ needs: 60, wants: 30, savings: 20 })).toBe(false);
    expect(splitIsValid({ needs: 110, wants: -10, savings: 0 })).toBe(false);
    expect(BUCKETS).toHaveLength(3);
  });
});

describe('laju belanja dan aman dibelanjakan', () => {
  it('3 tingkat laju dari porsi terpakai vs porsi waktu', () => {
    expect(pace(500, 1000, 10, 20)).toBe('sesuai');
    expect(pace(540, 1000, 10, 20)).toBe('sesuai');
    expect(pace(580, 1000, 10, 20)).toBe('agak_cepat');
    expect(pace(700, 1000, 10, 20)).toBe('terlalu_cepat');
    expect(pace(10, 0, 10, 20)).toBe('sesuai');
  });

  it('aman dibelanjakan = sisa / sisa hari, tidak pernah negatif', () => {
    expect(safeToSpend(1000, 400, 3)).toBe(200);
    expect(safeToSpend(1000, 1500, 3)).toBe(0);
    expect(safeToSpend(1000, 0, 0)).toBe(0);
  });
});

describe('pengeluaran per kategori dan bucket', () => {
  const mk = (id: string, date: string, categoryKey: string, amount: number, type: Transaction['type'] = 'expense', currency = 'IDR'): Transaction => ({
    id, date, time: '10:00', merchant: id, categoryKey, accountId: 'a', amount, currency, type, source: 'manual',
  });
  const period = budgetPeriod('2026-11-05', 25);

  it('hanya pengeluaran di dalam periode, dikonversi ke mata uang utama', () => {
    const txs = [
      mk('a', '2026-10-24', 'food', 999), // sebelum periode
      mk('b', '2026-10-25', 'food', 40_000),
      mk('c', '2026-11-01', 'groceries', 100_000),
      mk('d', '2026-11-02', 'hangout', 100, 'expense', 'USD'), // $1,00 = Rp 16.250
      mk('e', '2026-11-03', 'salary', 5_000_000, 'income'),
    ];
    const byCat = spendByCategory(txs, period, 'IDR');
    expect(byCat.find((c) => c.categoryKey === 'food')?.spent).toBe(40_000);
    expect(byCat.find((c) => c.categoryKey === 'salary')).toBeUndefined();
    expect(spendByBucket(byCat)).toEqual({ needs: 140_000, wants: 16_250, savings: 0 });
  });
});

describe('Health Score deterministik', () => {
  const base = { income: 10_000_000, saved: 1_000_000, budgetedCategories: 10, withinBudget: 8, debtPayments: 500_000, liquidBalance: 12_000_000, monthlyExpense: 4_000_000, billsDue: 6, billsOnTime: 5 };

  it('5 pilar dengan bobot 25/20/20/20/15', () => {
    expect(healthPillars(base).map((p) => p.max)).toEqual([25, 20, 20, 20, 15]);
    expect(healthPillars(base).map((p) => p.points)).toEqual([12.5, 16, 20, 10, 12.5]);
    expect(healthScore(base)).toBe(71);
  });

  it('kondisi ideal = 100, tidak pernah melewati 100', () => {
    const ideal = { ...base, saved: 5_000_000, withinBudget: 10, debtPayments: 0, liquidBalance: 40_000_000, billsOnTime: 6 };
    expect(healthScore(ideal)).toBe(100);
  });

  it('tanpa penghasilan: tabungan dan utang nol, tidak error dibagi nol', () => {
    const empty = { ...base, income: 0, saved: 0, debtPayments: 0, monthlyExpense: 0, budgetedCategories: 0, billsDue: 0 };
    expect(healthScore(empty)).toBe(35);
  });
});

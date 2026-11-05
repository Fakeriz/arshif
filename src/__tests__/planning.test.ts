const fs = jest.requireActual('fs');

import { billGroup, dayStatus, lastPeriodPaid } from '@/lib/planning/bills';
import { compareMethods, monthAfter, monthlyInterest, simulate } from '@/lib/planning/debts';
import { goalProgress, suggestedMonthly } from '@/lib/planning/goals';
import { monthsUntil, nextDue, occurrencesInMonth, prevDue } from '@/lib/planning/schedule';
import { computeShares, shareText } from '@/lib/planning/split';
import { monthlyCost, subscriptionTotals, yearlyCost } from '@/lib/planning/subscriptions';

describe('jadwal jatuh tempo (sama dengan public.next_due)', () => {
  it('hari jangkar 31 menyesuaikan bulan pendek lalu kembali', () => {
    expect(nextDue('2026-01-31', 'monthly', 31)).toBe('2026-02-28');
    expect(nextDue('2026-02-28', 'monthly', 31)).toBe('2026-03-31');
    expect(nextDue('2028-01-31', 'monthly', 31)).toBe('2028-02-29');
    expect(nextDue('2026-11-30', 'quarterly', 30)).toBe('2027-02-28');
    expect(nextDue('2024-02-29', 'yearly', 29)).toBe('2025-02-28');
    expect(nextDue('2026-11-28', 'weekly', 28)).toBe('2026-12-05');
    expect(nextDue('2026-12-15', 'monthly', 15)).toBe('2027-01-15');
  });

  it('prevDue kebalikan nextDue', () => {
    for (const [d, f, a] of [['2026-03-31', 'monthly', 31], ['2027-02-28', 'quarterly', 30], ['2026-12-05', 'weekly', 5], ['2027-01-15', 'yearly', 15]] as const) {
      expect(nextDue(prevDue(d, f, a), f, a)).toBe(d);
    }
  });

  it('kalender: semua kemunculan dalam satu bulan', () => {
    expect(occurrencesInMonth('2026-11-03', 'weekly', 3, 2026, 12)).toEqual(['2026-12-01', '2026-12-08', '2026-12-15', '2026-12-22', '2026-12-29']);
    expect(occurrencesInMonth('2027-01-31', 'monthly', 31, 2026, 11)).toEqual(['2026-11-30']);
    expect(occurrencesInMonth('2026-11-10', 'quarterly', 10, 2026, 12)).toEqual([]);
    expect(occurrencesInMonth('2026-11-10', 'quarterly', 10, 2027, 2)).toEqual(['2027-02-10']);
  });

  it('sisa bulan sampai tenggat, minimal 1', () => {
    expect(monthsUntil('2026-11-08', '2027-05-08')).toBe(6);
    expect(monthsUntil('2026-11-08', '2027-05-07')).toBe(5);
    expect(monthsUntil('2026-11-08', '2026-11-30')).toBe(1);
    expect(monthsUntil('2026-11-08', '2026-10-01')).toBe(1);
  });
});

describe('tagihan: kelompok dan status', () => {
  const bill = (dueDate: string, paidPeriods: string[] = []) => ({ dueDate, frequency: 'monthly' as const, anchorDay: Number(dueDate.slice(8)), paidPeriods });
  const today = '2026-11-08';
  it.each([
    ['2026-11-01', 'overdue'],
    ['2026-11-08', 'today'],
    ['2026-11-09', 'tomorrow'],
    ['2026-11-11', 'within3'],
    ['2026-11-15', 'thisWeek'],
    ['2026-11-25', 'later'],
  ])('%s -> %s', (due, group) => expect(billGroup(bill(due), today)).toBe(group));

  it('periode terakhir lunas dan jatuh tempo berikutnya > 7 hari = lunas', () => {
    expect(billGroup(bill('2026-12-05', ['2026-11-05']), today)).toBe('paid');
    expect(lastPeriodPaid(bill('2026-12-05', ['2026-11-05']))).toBe(true);
    // Lunas bulan lalu, tapi periode berikutnya sudah dekat: kembali menunggu dibayar.
    expect(billGroup(bill('2026-11-12', ['2026-10-12']), today)).toBe('thisWeek');
  });

  it('kalender: lunas, terlambat, akan datang; sebelum tagihan dibuat tidak ditampilkan', () => {
    const b = bill('2026-11-05', ['2026-10-05']);
    expect(dayStatus(b, '2026-10-05', today)).toBe('paid');
    expect(dayStatus(b, '2026-11-05', today)).toBe('overdue');
    expect(dayStatus(b, '2026-12-05', today)).toBe('upcoming');
    expect(dayStatus(b, '2026-09-05', today)).toBeNull();
  });
});

describe('simulator utang: snowball vs avalanche', () => {
  const debts = [
    { id: 'kk', balance: 10_000_000, aprBp: 2400, minPayment: 500_000 },
    { id: 'paylater', balance: 2_000_000, aprBp: 3600, minPayment: 200_000 },
    { id: 'teman', balance: 1_000_000, aprBp: 0, minPayment: 100_000 },
  ];

  it('bunga bulanan = saldo × APR/12, dibulatkan, aman untuk saldo besar', () => {
    expect(monthlyInterest(10_000_000, 2400)).toBe(200_000);
    expect(monthlyInterest(1_234_567, 1999)).toBe(20566);
    expect(monthlyInterest(9_000_000_000_000, 2400)).toBe(180_000_000_000);
  });

  it('urutan lunas sesuai metode', () => {
    const s = simulate(debts, 500_000, 'snowball');
    const a = simulate(debts, 500_000, 'avalanche');
    expect(s.order.map((o) => o.id)).toEqual(['teman', 'paylater', 'kk']);
    expect(a.order.map((o) => o.id)).toEqual(['paylater', 'teman', 'kk']);
    expect(s.feasible && a.feasible).toBe(true);
    expect(a.totalInterest).toBeLessThanOrEqual(s.totalInterest);
  });

  it('ekstra menghemat bunga dan bulan dibanding minimum saja', () => {
    const c = compareMethods(debts, 1_000_000);
    expect(c.baseline.feasible).toBe(true);
    expect(c.avalanche.interestSaved).toBeGreaterThan(0);
    expect(c.avalanche.interestSaved).toBe(c.baseline.totalInterest - c.avalanche.totalInterest);
    expect(c.snowball.monthsSaved).toBeGreaterThan(0);
    expect(c.avalanche.months).toBeLessThan(c.baseline.months);
  });

  it('total pembayaran = saldo awal + bunga (tidak ada uang hilang)', () => {
    // Satu utang, tanpa bunga: 1.000.000 dengan 300.000/bulan = 4 bulan.
    const r = simulate([{ id: 'x', balance: 1_000_000, aprBp: 0, minPayment: 300_000 }], 0, 'snowball');
    expect(r).toMatchObject({ feasible: true, months: 4, totalInterest: 0, order: [{ id: 'x', month: 4 }] });
  });

  it('cicilan tidak menutup bunga = tidak akan lunas', () => {
    const r = simulate([{ id: 'x', balance: 10_000_000, aprBp: 3600, minPayment: 100_000 }], 0, 'avalanche');
    expect(r.feasible).toBe(false);
    expect(compareMethods([{ id: 'x', balance: 10_000_000, aprBp: 3600, minPayment: 100_000 }], 500_000).avalanche.feasible).toBe(true);
  });

  it('tanggal lunas perkiraan', () => {
    expect(monthAfter('2026-11-08', 3)).toBe('2027-02-01');
  });
});

describe('split bill', () => {
  const people = [
    { id: 'me', owner: true },
    { id: 'ani', owner: false },
    { id: 'budi', owner: false },
  ];
  const sum = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0);

  it('bagi rata: sisa pembulatan ke pemilik', () => {
    const r = computeShares({ mode: 'equal', total: 100_000, participants: people, items: [] });
    expect(r).toEqual({ me: 33_334, ani: 33_333, budi: 33_333 });
    expect(sum(r)).toBe(100_000);
  });

  it('per item + pajak dan service proporsional, total pas', () => {
    const r = computeShares({
      mode: 'items',
      total: 121_000,
      participants: people,
      items: [
        { amount: 50_000, assigned: ['ani'] },
        { amount: 30_000, assigned: ['budi'] },
        { amount: 20_000, assigned: ['me', 'ani'] },
      ],
    });
    // Subtotal: me 10.000, ani 60.000, budi 30.000 dari 100.000; pajak+service 21.000 proporsional.
    expect(r).toEqual({ me: 12_100, ani: 72_600, budi: 36_300 });
    expect(sum(r)).toBe(121_000);
  });

  it('item tanpa peserta ditanggung pemilik; mata uang 2 desimal tetap pas', () => {
    const r = computeShares({ mode: 'items', total: 63_620, participants: people, items: [{ amount: 12_990, assigned: ['ani', 'budi'] }, { amount: 35_890, assigned: [] }, { amount: 14_740, assigned: ['ani', 'budi', 'me'] }] });
    expect(sum(r)).toBe(63_620);
    expect(r.ani).toBe(6495 + 4913);
    expect(r.budi).toBe(6495 + 4913);
  });

  it('teks ringkasan per orang', () => {
    expect(
      shareText({ title: 'Makan malam', total: 'Rp 121.000', totalLabel: 'Total', paidLabel: 'lunas', unpaidLabel: 'belum', people: [{ name: 'Ani', amount: 'Rp 72.600', paid: true }, { name: 'Budi', amount: 'Rp 36.300', paid: false }] }),
    ).toBe('Makan malam\nTotal: Rp 121.000\n\n- Ani: Rp 72.600 (lunas)\n- Budi: Rp 36.300 (belum)');
  });
});

describe('goals dan langganan', () => {
  it('progress dan saran setoran per bulan', () => {
    expect(goalProgress({ collected: 2_500_000, target: 10_000_000 })).toBe(0.25);
    expect(suggestedMonthly({ collected: 2_500_000, target: 10_000_000, deadline: '2027-05-08' }, '2026-11-08')).toBe(1_250_000);
    expect(suggestedMonthly({ collected: 0, target: 1_000_000, deadline: '2027-02-08' }, '2026-11-08')).toBe(333_334);
    expect(suggestedMonthly({ collected: 1, target: 1, deadline: '2027-02-08' }, '2026-11-08')).toBeNull();
    expect(suggestedMonthly({ collected: 0, target: 1 }, '2026-11-08')).toBeNull();
  });

  it('biaya bulanan/tahunan per siklus dan total dalam mata uang utama', () => {
    expect([monthlyCost({ amount: 12_000, cycle: 'yearly' }), yearlyCost({ amount: 12_000, cycle: 'yearly' })]).toEqual([1_000, 12_000]);
    expect([monthlyCost({ amount: 1_200, cycle: 'weekly' }), yearlyCost({ amount: 1_200, cycle: 'weekly' })]).toEqual([5_200, 62_400]);
    const conv = (m: number, from: string, to: string) => (from === to ? m : from === 'USD' && to === 'IDR' ? m * 160 : null);
    const t = subscriptionTotals(
      [
        { amount: 54_000, cycle: 'monthly', currency: 'IDR', status: 'active' },
        { amount: 2_000, cycle: 'monthly', currency: 'USD', status: 'active' },
        { amount: 99, cycle: 'monthly', currency: 'TRY', status: 'active' },
        { amount: 1_000_000, cycle: 'monthly', currency: 'IDR', status: 'cancelled' },
      ],
      'IDR',
      conv,
    );
    expect(t).toEqual({ monthly: 374_000, yearly: 4_488_000, missing: ['TRY'] });
  });
});

describe('cermin SQL', () => {
  it('pengingat dan href notifikasi Planning ada di migrasi', () => {
    const sql: string = fs.readFileSync(`${process.cwd()}/supabase/migrations/20261108000008_planning.sql`, 'utf8');
    for (const k of ['domain.notif.billTodayTitle', 'domain.notif.billSoonTitle', 'domain.notif.billDueMessage', 'domain.notif.subTitle', 'domain.notif.subMessage', 'domain.notif.goalTitle', 'domain.notif.goalMessage']) {
      expect(sql).toContain(k);
    }
  });
});

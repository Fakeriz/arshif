import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { Text } from 'react-native';

import { GoalRing, Sparkline, StatTile, TrendBadge } from '@/components/ui';
import { I18nProvider } from '@/i18n';
import type { Lang } from '@/i18n';
import { areaUnder, pctChange, ringDash, smoothPath } from '@/lib/chart';
import { ThemeProvider } from '@/theme/ThemeProvider';

const wrap = (ui: ReactElement, lang: Lang = 'id') =>
  render(
    <I18nProvider initialLang={lang}>
      <ThemeProvider initialMode="dark">{ui}</ThemeProvider>
    </I18nProvider>,
  );

describe('chart — helper fintech', () => {
  it('pctChange: relatif terhadap nilai sebelumnya; tanpa pembanding null', () => {
    expect(pctChange(100, 112)).toBeCloseTo(0.12);
    expect(pctChange(-200, -100)).toBeCloseTo(0.5);
    expect(pctChange(0, 50)).toBeNull();
  });

  it('smoothPath tidak melewati rentang y data (tanpa overshoot)', () => {
    const pts = [{ x: 0, y: 10 }, { x: 10, y: 0 }, { x: 20, y: 10 }, { x: 30, y: 0 }];
    const d = smoothPath(pts);
    const ys = [...d.matchAll(/(-?\d+\.\d+) (-?\d+\.\d+)/g)].map((m) => Number(m[2]));
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...ys)).toBeLessThanOrEqual(10);
    expect(d.startsWith('M 0.00 10.00')).toBe(true);
    expect(areaUnder(d, pts, 40).endsWith('Z')).toBe(true);
    expect(smoothPath([])).toBe('');
  });

  it('ringDash menjepit rasio 0–1', () => {
    expect(ringDash(0.5, 10).filled).toBeCloseTo(Math.PI * 10);
    expect(ringDash(1.4, 10).filled).toBeCloseTo(ringDash(1, 10).circumference);
    expect(ringDash(-1, 10).filled).toBe(0);
    expect(ringDash(Number.NaN, 10).filled).toBe(0);
  });
});

describe('TrendBadge', () => {
  it('format persen per bahasa dan label pembaca layar', async () => {
    await wrap(<TrendBadge value={0.124} suffix="vs bulan lalu" />);
    expect(screen.getByText('12,4%')).toBeTruthy();
    expect(screen.getByLabelText('Naik 12,4% vs bulan lalu')).toBeTruthy();
  });

  it('Turki menaruh % di depan', async () => {
    await wrap(<TrendBadge value={-0.08} />, 'tr');
    expect(screen.getByText('%8')).toBeTruthy();
    expect(screen.getByLabelText('%8 azaldı')).toBeTruthy();
  });

  it('Inggris memakai titik desimal', async () => {
    await wrap(<TrendBadge value={0.055} />, 'en');
    expect(screen.getByText('5.5%')).toBeTruthy();
  });

  it('datar dan tanpa pembanding', async () => {
    await wrap(
      <>
        <TrendBadge value={0.0001} />
        <TrendBadge value={null} />
      </>,
    );
    expect(screen.getByLabelText('Tidak berubah')).toBeTruthy();
    expect(screen.getByLabelText('Belum ada pembanding')).toBeTruthy();
  });
});

describe('Sparkline, GoalRing, StatTile', () => {
  it('Sparkline memberi ringkasan tren untuk pembaca layar', async () => {
    await wrap(<Sparkline values={[10, 14, 12, 18]} formatValue={(v) => `${v} poin`} />);
    expect(screen.getByLabelText('Tren 4 periode, dari 10 poin ke 18 poin')).toBeTruthy();
  });

  it('GoalRing: persen dibulatkan, penuh berlabel "Tercapai"', async () => {
    await wrap(
      <>
        <GoalRing value={0.426} label="Dana darurat" />
        <GoalRing value={1.2} label="Liburan" />
      </>,
    );
    expect(screen.getByLabelText('Dana darurat, 43% tercapai')).toBeTruthy();
    expect(screen.getByLabelText('Liburan, 100% tercapai')).toBeTruthy();
    expect(screen.getByText('Tercapai')).toBeTruthy();
  });

  it('StatTile menyembunyikan nominal dan sparkline saat saldo disembunyikan', async () => {
    await wrap(<StatTile label="Pengeluaran" amount={2450000} currency="IDR" change={0.1} invert series={[1, 2, 3]} hidden />);
    expect(screen.queryByText(/2\.450\.000/)).toBeNull();
    expect(screen.queryByLabelText(/^Tren/)).toBeNull();
    expect(screen.getByLabelText('Naik 10%')).toBeTruthy();
  });
});

describe('periodSeries — perbandingan setara per periode gajian', () => {
  const { periodSeries } = jest.requireActual('@/lib/budget') as typeof import('@/lib/budget');
  const tx = (id: string, date: string, type: 'income' | 'expense', amount: number) =>
    ({ id, date, type, amount, currency: 'IDR', accountId: 'a', categoryKey: type === 'income' ? 'salary' : 'food', merchant: id }) as never;

  it('periode lalu dipotong ke hari ke-N yang sama', () => {
    // Gajian 25, hari ini 4 Nov → periode 25 Okt – 24 Nov, hari ke-11.
    const txs = [
      tx('a', '2026-09-26', 'expense', 100), // periode Sep, hari ke-2: dihitung
      tx('b', '2026-10-20', 'expense', 999), // periode Sep, hari ke-26: di luar jendela
      tx('c', '2026-10-25', 'income', 5000),
      tx('d', '2026-10-30', 'expense', 300),
      tx('e', '2026-11-04', 'expense', 200),
    ];
    const s = periodSeries(txs, '2026-11-04', 25, 'IDR', 3);
    expect(s.days).toBe(11);
    expect(s.starts).toEqual(['2026-08-25', '2026-09-25', '2026-10-25']);
    expect(s.expense).toEqual([0, 100, 500]);
    expect(s.income).toEqual([0, 0, 5000]);
  });
});

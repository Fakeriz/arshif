import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { Text } from 'react-native';

import { GoalRing, NumberPad, Sparkline, StatTile, TrendBadge, useNumberPad } from '@/components/ui';
import { I18nProvider } from '@/i18n';
import type { Lang } from '@/i18n';
import { areaUnder, pctChange, ringDash, smoothPath } from '@/lib/chart';
import { minorToTyped, pressKey, typedDisplay, typedToMinor, type KeypadKey } from '@/lib/keypad';
import { ThemeProvider } from '@/theme/ThemeProvider';

const wrap = (ui: ReactElement, lang: Lang = 'id') =>
  render(
    <I18nProvider initialLang={lang}>
      <ThemeProvider initialMode="dark">{ui}</ThemeProvider>
    </I18nProvider>,
  );

const typeKeys = (keys: KeypadKey[], code: string) => keys.reduce((s, k) => pressKey(s, k, code), '');

describe('keypad — logika ketikan', () => {
  it('IDR tanpa desimal: digit, "000", nol di depan diabaikan', () => {
    expect(typeKeys(['0', '0', '4', '5', '000'], 'IDR')).toBe('45000');
    expect(typeKeys(['decimal', '5'], 'IDR')).toBe('5');
    expect(typedToMinor('45000', 'IDR')).toBe(45000);
    expect(typedDisplay('45000', 'IDR')).toBe('45.000');
  });

  it('MYR: satu pemisah desimal, maksimal 2 digit pecahan', () => {
    const s = typeKeys(['1', '2', '5', '0', 'decimal', '5', 'decimal', '0', '9'], 'MYR');
    expect(s).toBe('1250.50');
    expect(typedToMinor(s, 'MYR')).toBe(125050);
    expect(typedDisplay(s, 'MYR')).toBe('1,250.50');
    expect(typeKeys(['decimal', '7'], 'MYR')).toBe('0.7');
    expect(typedToMinor('0.7', 'MYR')).toBe(70);
  });

  it('TRY memakai koma desimal di tampilan', () => {
    expect(typedDisplay('3500.5', 'TRY')).toBe('3.500,5');
  });

  it('hapus, kosongkan, dan batas digit', () => {
    expect(pressKey('123', 'back', 'IDR')).toBe('12');
    expect(pressKey('12.5', 'clear', 'MYR')).toBe('');
    expect(pressKey('1234', '5', 'IDR', 4)).toBe('1234');
    expect(typedToMinor('', 'IDR')).toBeNull();
    expect(typedDisplay('', 'IDR')).toBe('0');
  });

  it('minorToTyped kebalikan typedToMinor', () => {
    expect(minorToTyped(125050, 'MYR')).toBe('1250.5');
    expect(minorToTyped(125000, 'MYR')).toBe('1250');
    expect(minorToTyped(45000, 'IDR')).toBe('45000');
    expect(minorToTyped(null, 'IDR')).toBe('');
    for (const v of [1, 99, 100, 123456]) expect(typedToMinor(minorToTyped(v, 'USD'), 'USD')).toBe(v);
  });
});

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

function PadHarness({ currency }: { currency: string }) {
  const pad = useNumberPad(currency);
  return (
    <>
      <Text testID="display">{pad.display}</Text>
      <Text testID="minor">{String(pad.minor)}</Text>
      <NumberPad currency={currency} onKey={pad.onKey} />
    </>
  );
}

describe('NumberPad', () => {
  it('IDR: tombol "000" mengganti desimal, hapus menghapus satu digit', async () => {
    await wrap(<PadHarness currency="IDR" />);
    expect(screen.queryByLabelText('Pemisah desimal')).toBeNull();
    await fireEvent.press(screen.getByLabelText('4'));
    await fireEvent.press(screen.getByLabelText('5'));
    await fireEvent.press(screen.getByLabelText('Tiga nol'));
    expect(screen.getByTestId('display').props.children).toBe('45.000');
    expect(screen.getByTestId('minor').props.children).toBe('45000');
    await fireEvent.press(screen.getByLabelText('Hapus satu digit'));
    expect(screen.getByTestId('display').props.children).toBe('4.500');
  });

  it('MYR: desimal tersedia, tahan hapus mengosongkan', async () => {
    await wrap(<PadHarness currency="MYR" />);
    await fireEvent.press(screen.getByLabelText('1'));
    await fireEvent.press(screen.getByLabelText('Pemisah desimal'));
    await fireEvent.press(screen.getByLabelText('5'));
    expect(screen.getByTestId('display').props.children).toBe('1.5');
    expect(screen.getByTestId('minor').props.children).toBe('150');
    await fireEvent(screen.getByLabelText('Hapus satu digit'), 'longPress');
    expect(screen.getByTestId('minor').props.children).toBe('null');
  });
});

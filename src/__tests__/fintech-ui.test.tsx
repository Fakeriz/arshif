import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { Text } from 'react-native';

import { GoalRing, NumberPad, Sparkline, StatTile, TrendBadge, useNumberPad } from '@/components/ui';
import { I18nProvider } from '@/i18n';
import type { Lang } from '@/i18n';
import { areaUnder, pctChange, ringDash, smoothPath } from '@/lib/chart';
import { evaluate, extraKey, minorToTyped, pressKey, typedDisplay, type KeypadKey } from '@/lib/keypad';
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
    expect(evaluate('45000', 'IDR')).toBe(45000);
    expect(typedDisplay('45000', 'IDR')).toBe('45.000');
  });

  it('MYR: satu pemisah desimal, maksimal 2 digit pecahan', () => {
    const s = typeKeys(['1', '2', '5', '0', 'decimal', '5', 'decimal', '0', '9'], 'MYR');
    expect(s).toBe('1250.50');
    expect(evaluate(s, 'MYR')).toBe(125050);
    expect(typedDisplay(s, 'MYR')).toBe('1,250.50');
    expect(typeKeys(['decimal', '7'], 'MYR')).toBe('0.7');
    expect(evaluate('0.7', 'MYR')).toBe(70);
  });

  it('TRY memakai koma desimal di tampilan', () => {
    expect(typedDisplay('3500.5', 'TRY')).toBe('3.500,5');
  });

  it('hapus, kosongkan, dan batas digit', () => {
    expect(pressKey('123', 'back', 'IDR')).toBe('12');
    expect(pressKey('12.5', 'clear', 'MYR')).toBe('');
    expect(pressKey('1234', '5', 'IDR', 4)).toBe('1234');
    expect(evaluate('', 'IDR')).toBeNull();
    expect(typedDisplay('', 'IDR')).toBe('0');
  });

  it('minorToTyped kebalikan evaluate', () => {
    expect(minorToTyped(125050, 'MYR')).toBe('1250.5');
    expect(minorToTyped(125000, 'MYR')).toBe('1250');
    expect(minorToTyped(45000, 'IDR')).toBe('45000');
    expect(minorToTyped(null, 'IDR')).toBe('');
    for (const v of [1, 99, 100, 123456]) expect(evaluate(minorToTyped(v, 'USD'), 'USD')).toBe(v);
  });
  it('kalkulator: operator, "=" menghitung, × ÷ sebelum + −', () => {
    expect(typeKeys(['1', '0', '0', '+', '5', '0', 'equals'], 'IDR')).toBe('150');
    expect(typeKeys(['2', '+', '3', '*', '4', 'equals'], 'IDR')).toBe('14');
    expect(typeKeys(['1', '0', 'decimal', '5', '*', '2', 'equals'], 'USD')).toBe('21');
    expect(typeKeys(['1', '0', '/', '4', 'equals'], 'USD')).toBe('2.5');
    // IDR tanpa desimal: hasil bagi dibulatkan ke rupiah utuh.
    expect(typeKeys(['1', '0', '/', '4', 'equals'], 'IDR')).toBe('3');
    expect(evaluate('0.1+0.2', 'USD')).toBe(30);
  });

  it('kalkulator: kasus tepi', () => {
    // Operator tanpa angka di depannya ditolak; operator berturut-turut saling mengganti.
    expect(pressKey('', '+', 'IDR')).toBe('');
    expect(typeKeys(['5', '+', '-'], 'IDR')).toBe('5-');
    expect(typeKeys(['5', 'decimal', '+'], 'USD')).toBe('5+');
    // Hasil sementara mengabaikan operator di ujung; "=" tanpa operator tidak mengubah apa pun.
    expect(evaluate('100+', 'IDR')).toBe(100);
    expect(pressKey('100', 'equals', 'IDR')).toBe('100');
    // Bagi nol dan hasil negatif tidak menjadi nominal.
    expect(pressKey('5/0', 'equals', 'IDR')).toBe('5/0');
    expect(evaluate('5-9', 'IDR')).toBeNull();
    // Batas digit berlaku per angka, bukan per ekspresi.
    expect(pressKey('1234+1234', '5', 'IDR', 4)).toBe('1234+1234');
    expect(pressKey('1234+', '5', 'IDR', 4)).toBe('1234+5');
  });

  it('tampilan ekspresi ikut format mata uang', () => {
    expect(typedDisplay('12000+3', 'IDR')).toBe('12.000 + 3');
    expect(typedDisplay('12000.5*2', 'USD')).toBe('12,000.5 × 2');
    expect(typedDisplay('3500.5-1', 'TRY')).toBe('3.500,5 − 1');
    expect(typedDisplay('10/', 'MYR')).toBe('10 ÷');
  });

  it('tombol "000" untuk semua mata uang tanpa desimal, desimal untuk sisanya', () => {
    for (const c of ['IDR', 'VND', 'JPY', 'KRW']) expect(extraKey(c)).toBe('000');
    for (const c of ['USD', 'TRY', 'MYR', 'EUR']) expect(extraKey(c)).toBe('decimal');
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
      <Text testID="rejects">{String(pad.rejects)}</Text>
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
    // Pecahan MYR maksimal 2 digit: digit ketiga ditolak dan dihitung untuk animasi goyang.
    await fireEvent.press(screen.getByLabelText('0'));
    await fireEvent.press(screen.getByLabelText('9'));
    expect(screen.getByTestId('display').props.children).toBe('1.50');
    expect(screen.getByTestId('rejects').props.children).toBe('1');
    await fireEvent(screen.getByLabelText('Hapus satu digit'), 'longPress');
    expect(screen.getByTestId('minor').props.children).toBe('null');
  });
  it('tata letak kalkulator: operator, "=", dan tombol kiri bawah per mata uang', async () => {
    await wrap(<PadHarness currency="USD" />);
    for (const l of ['Bagi', 'Kali', 'Kurang', 'Tambah', 'Sama dengan', 'Hapus satu digit']) expect(screen.getByLabelText(l)).toBeTruthy();
    expect(screen.getByLabelText('Pemisah desimal')).toBeTruthy();
    expect(screen.getByText('.')).toBeTruthy();
    for (const k of ['1', '0', '0', 'Tambah', '5', '0']) await fireEvent.press(screen.getByLabelText(k));
    expect(screen.getByTestId('display').props.children).toBe('100 + 50');
    await fireEvent.press(screen.getByLabelText('Sama dengan'));
    expect(screen.getByTestId('display').props.children).toBe('150');
    expect(screen.getByTestId('minor').props.children).toBe('15000');
    await screen.unmount();

    await wrap(<PadHarness currency="TRY" />);
    expect(screen.getByText(',')).toBeTruthy();
    await screen.unmount();
    for (const c of ['IDR', 'VND', 'JPY', 'KRW']) {
      await wrap(<PadHarness currency={c} />);
      expect(screen.getByLabelText('Tiga nol')).toBeTruthy();
      expect(screen.queryByLabelText('Pemisah desimal')).toBeNull();
      await screen.unmount();
    }
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

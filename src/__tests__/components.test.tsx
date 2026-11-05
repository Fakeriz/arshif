import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import {
  Button,
  CashflowChart,
  CurrencyText,
  DonutChart,
  EmptyState,
  HealthGauge,
  ProgressBar,
  Tabs,
} from '@/components/ui';
import { progressTone } from '@/components/ui/ProgressBar';
import { ThemeProvider } from '@/theme/ThemeProvider';

const wrap = (ui: ReactElement, mode: 'dark' | 'light' = 'dark') =>
  render(<ThemeProvider initialMode={mode}>{ui}</ThemeProvider>);

describe('CurrencyText — aturan angka', () => {
  it('pemasukan memakai "+" dan pengeluaran memakai "−"', async () => {
    await wrap(
      <>
        <CurrencyText amount={14250000} currency="IDR" kind="income" />
        <CurrencyText amount={87500} currency="IDR" kind="expense" />
      </>,
    );
    expect(screen.getByText('+Rp 14.250.000')).toBeTruthy();
    expect(screen.getByText('−Rp 87.500')).toBeTruthy();
  });

  it('mode sembunyikan saldo tidak membocorkan nominal', async () => {
    await wrap(<CurrencyText amount={48215400} currency="IDR" hidden />);
    expect(screen.queryByText(/48/)).toBeNull();
    expect(screen.getByLabelText('Saldo disembunyikan')).toBeTruthy();
  });
});

describe('Button', () => {
  it('memanggil onPress dan memblokir saat loading', async () => {
    const onPress = jest.fn();
    const { rerender } = await wrap(<Button label="Simpan" onPress={onPress} />);
    await fireEvent.press(screen.getByLabelText('Simpan'));
    expect(onPress).toHaveBeenCalledTimes(1);

    await rerender(
      <ThemeProvider initialMode="dark">
        <Button label="Simpan" onPress={onPress} loading />
      </ThemeProvider>,
    );
    await fireEvent.press(screen.getByLabelText('Simpan'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('EmptyState', () => {
  it('state limit menampilkan CTA upgrade', async () => {
    const onAction = jest.fn();
    await wrap(<EmptyState kind="limit" title="Kuota scan habis" actionLabel="Lihat Premium" onAction={onAction} />, 'light');
    await fireEvent.press(screen.getByLabelText('Lihat Premium'));
    expect(onAction).toHaveBeenCalled();
  });
});

describe('ProgressBar', () => {
  it('ambang warna sama dengan ambang notifikasi budget 80% / 100%', async () => {
    expect(progressTone(0.5)).toBe('accent');
    expect(progressTone(0.8)).toBe('warning');
    expect(progressTone(1)).toBe('warning');
    expect(progressTone(1.13)).toBe('negative');
  });

  it('melaporkan persen ke pembaca layar', async () => {
    await wrap(<ProgressBar value={1.13} accessibilityLabel="Nongkrong" />);
    expect(screen.getByLabelText('Nongkrong').props.accessibilityValue.now).toBe(113);
  });
});

describe('DonutChart', () => {
  const segments = [
    { key: 'needs', label: 'Kebutuhan', value: 4380000, color: '#7FB0E6' },
    { key: 'wants', label: 'Keinginan', value: 2615000, color: '#E3B25C' },
  ];

  it('menampilkan total lalu nilai segmen yang dipilih lewat legenda', async () => {
    await wrap(<DonutChart segments={segments} currency="IDR" centerLabel="Terpakai" />);
    expect(screen.getByText('Terpakai')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Keinginan, 37 persen'));
    expect(screen.getAllByText('Keinginan').length).toBeGreaterThan(1);
    expect(screen.getAllByText('37%')).toHaveLength(2); // tengah donat + legenda
  });

  it('state kosong menampilkan pesan, bukan grafik kosong tanpa penjelasan', async () => {
    await wrap(<DonutChart segments={segments.map((s) => ({ ...s, value: 0 }))} currency="IDR" />);
    expect(screen.getByText('Belum ada data bulan ini')).toBeTruthy();
  });
});

describe('HealthGauge', () => {
  it('menampilkan skor dan label tingkat', async () => {
    await wrap(<HealthGauge score={72} delta={6} />);
    expect(screen.getByText('72')).toBeTruthy();
    expect(screen.getByText('dari 100 · Baik')).toBeTruthy();
    expect(screen.getByText(/Naik 6 poin/)).toBeTruthy();
  });

  it('skor null = data belum cukup', async () => {
    await wrap(<HealthGauge score={null} />);
    expect(screen.getByText('Butuh data 1 bulan')).toBeTruthy();
  });
});

describe('CashflowChart', () => {
  it('state kosong memakai EmptyState', async () => {
    await wrap(<CashflowChart data={[{ label: 'Nov', income: 0, expense: 0 }]} currency="IDR" />);
    expect(screen.getByText('Belum ada arus kas')).toBeTruthy();
  });
});

describe('Tabs', () => {
  it('memanggil onChange dengan key tab', async () => {
    const onChange = jest.fn();
    await wrap(
      <Tabs
        value="month"
        onChange={onChange}
        items={[
          { key: 'week', label: 'Minggu ini' },
          { key: 'month', label: 'Bulan ini' },
        ]}
      />,
    );
    await fireEvent.press(screen.getByLabelText('Minggu ini'));
    expect(onChange).toHaveBeenCalledWith('week');
  });
});

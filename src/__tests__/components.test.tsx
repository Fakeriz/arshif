import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import {
  BalanceText,
  BankCard,
  Button,
  Card,
  CashflowChart,
  CurrencyText,
  Dialog,
  DonutChart,
  EmptyState,
  HealthGauge,
  ProgressBar,
  Tabs,
} from '@/components/ui';
import { progressTone } from '@/components/ui/ProgressBar';
import { BootScreen } from '@/components/shell/BootScreen';
import { Screen } from '@/components/shell/Screen';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';
import { StyleSheet, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

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
    expect(progressTone(0.5)).toBe('positive');
    expect(progressTone(0.8)).toBe('warning');
    expect(progressTone(1)).toBe('warning');
    expect(progressTone(1.13)).toBe('negative');
  });

  it('melaporkan persen ke pembaca layar', async () => {
    await wrap(<ProgressBar value={1.13} accessibilityLabel="Nongkrong" />);
    expect(screen.getByLabelText('Nongkrong').props['aria-valuenow']).toBe(113);
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

describe('BalanceText', () => {
  it('memisahkan pecahan desimal dan label aksesibel utuh', async () => {
    await wrap(<BalanceText amount={201709} currency="USD" />);
    expect(screen.getByLabelText('$2,017.09')).toBeTruthy();
    expect(screen.getByText('.09')).toBeTruthy();
  });

  it('mode sembunyi tidak membocorkan nominal', async () => {
    await wrap(<BalanceText amount={201709} currency="USD" hidden />);
    expect(screen.queryByText('.09')).toBeNull();
    expect(screen.getByLabelText('Saldo disembunyikan')).toBeTruthy();
  });
});

describe('CurrencyText over budget', () => {
  it('memberi label pembaca layar, bukan hanya warna', async () => {
    await wrap(<CurrencyText amount={-115000} currency="IDR" kind="over" />);
    expect(screen.getByLabelText('Melebihi batas, \u2212Rp 115.000')).toBeTruthy();
  });
});

describe('BankCard', () => {
  it('nama bank sebagai teks + saldo, tanpa logo', async () => {
    await wrap(<BankCard bank="bca" accountType="Tabungan" last4="2153" balance={21480000} currency="IDR" />);
    expect(screen.getByText('BCA')).toBeTruthy();
    expect(screen.getByText('Rp 21.480.000')).toBeTruthy();
    expect(screen.getByLabelText('BCA Tabungan, akhiran 2153, saldo Rp 21.480.000')).toBeTruthy();
  });
});

describe('Monokrom: tanpa glow, kartu solid', () => {
  const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
  const hostTypes = (node: unknown, out = new Set<string>()): Set<string> => {
    if (Array.isArray(node)) node.forEach((n) => hostTypes(n, out));
    else if (node && typeof node === 'object' && 'type' in node) {
      out.add(String(node.type));
      hostTypes((node as { children?: unknown }).children, out);
    }
    return out;
  };

  it('tidak ada glow, kartu gelap #161616', async () => {
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <ThemeProvider initialMode="dark">
          <Screen>
            <Card accessibilityLabel="kartu">
              <Text>isi</Text>
            </Card>
          </Screen>
          <BootScreen />
        </ThemeProvider>
      </SafeAreaProvider>,
    );
    expect(hostTypes(screen.toJSON()).has('RNSVGRadialGradient')).toBe(false);
    expect(StyleSheet.flatten(screen.getByLabelText('kartu').props.style).backgroundColor).toBe('#161616');
  });
});

describe('Dialog', () => {
  it('saat menutup (animasi 150 ms) tombol konfirmasi tidak menjalankan aksi lagi', async () => {
    const onConfirm = jest.fn();
    const props = { title: 'Hapus transaksi?', confirmLabel: 'Hapus', onConfirm, onCancel: () => undefined };
    const r = await wrap(<Dialog visible {...props} />);
    await fireEvent.press(screen.getByText('Hapus'));
    await r.rerender(<ThemeProvider initialMode="dark"><Dialog visible={false} {...props} /></ThemeProvider>);
    await fireEvent.press(screen.getByText('Hapus'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});

import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AccountsCard } from '@/features/settings/AccountsCard';
import { ToastProvider } from '@/components/ui';
import { sampleState } from '@/data/sample-state';
import { I18nProvider } from '@/i18n';
import { AppStoreProvider } from '@/state/AppStore';
import { ThemeProvider } from '@/theme/ThemeProvider';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn(), canGoBack: () => true }) }));

const wrap = (ui: ReactNode) =>
  render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <I18nProvider initialLang="id">
        <ThemeProvider initialMode="light">
          <ToastProvider>
            <AppStoreProvider preset={sampleState()}>{ui}</AppStoreProvider>
          </ToastProvider>
        </ThemeProvider>
      </I18nProvider>
    </SafeAreaProvider>,
  );

// Panggung kartu baru dirender setelah lebar diketahui (onLayout).
const layout = async () => {
  const root = screen.getByText(/akun · IDR/).parent?.parent?.parent;
  await act(async () => fireEvent(root!, 'layout', { nativeEvent: { layout: { width: 358, height: 600, x: 0, y: 0 } } }));
};

beforeEach(() => mockPush.mockClear());

describe('Akun & kartu: dompet bertumpuk', () => {
  it('tumpukan: ringkasan akun & mata uang, petunjuk ketuk; buka kartu -> transaksi + detail; kembali', async () => {
    await wrap(<AccountsCard />);
    expect(screen.getByText(/^\d+ akun · IDR, MYR/)).toBeTruthy();
    expect(screen.getByText('Ketuk kartu untuk melihat transaksi')).toBeTruthy();
    await layout();
    const cards = screen.getAllByLabelText(/BCA Tabungan|BCA .*akhiran 2153/);
    await act(async () => fireEvent.press(cards[0]!));
    expect(screen.getByText('Semua kartu')).toBeTruthy();
    expect(screen.getByText(/^1 dari \d+$/)).toBeTruthy();
    expect(screen.getByText('Transaksi terakhir')).toBeTruthy();
    expect(screen.queryByText('Ketuk kartu untuk melihat transaksi')).toBeNull();

    await act(async () => fireEvent.press(screen.getByText('Detail akun')));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/akun/[id]', params: { id: 'a-bca' } });

    // Titik halaman: pilih kartu ke-2.
    const tabs = screen.getAllByRole('tab');
    await act(async () => fireEvent.press(tabs[1]!));
    expect(screen.getByText(/^2 dari \d+$/)).toBeTruthy();

    await act(async () => fireEvent.press(screen.getByLabelText('Semua kartu')));
    expect(screen.getByText('Ketuk kartu untuk melihat transaksi')).toBeTruthy();
  });
});

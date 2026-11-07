import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as WebBrowser from 'expo-web-browser';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { PaywallProvider } from '@/components/shell/Paywall';
import { ToastProvider } from '@/components/ui';
import type { Asset, AssetPrice } from '@/data/assets';
import { sampleState } from '@/data/sample-state';
import { I18nProvider } from '@/i18n';
import { AppStoreProvider } from '@/state/AppStore';
import { AssetsProvider } from '@/state/assets';
import { PlanningProvider } from '@/state/planning';
import { ThemeProvider } from '@/theme/ThemeProvider';

/**
 * Regresi crash Expo Go (P0, 2026-11-07): binary tanpa RNCWebViewModule. Mengevaluasi react-native-webview di sana
 * melempar "TurboModuleRegistry.getEnforcing(...): 'RNCWebViewModule' could not be found", dan import statis membuat
 * route detail aset (lalu seluruh aplikasi) gagal dimuat. Di sini modul itu dibuat melempar persis seperti itu.
 */
jest.mock('react-native-webview', () => {
  throw new Error("TurboModuleRegistry.getEnforcing(...): 'RNCWebViewModule' could not be found.");
});
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn(async () => ({ type: 'opened' })) }));
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), navigate: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => mockParams,
  router: { push: jest.fn() },
}));

const at = new Date().toISOString();
const bbca: Asset = { id: 'bbca', type: 'stock_id', symbol: 'BBCA', name: 'Bank Central Asia', quantity: 100, buyPrice: 4800, currency: 'IDR', priceKey: 'IDX:BBCA', createdAt: at };
const prices: Record<string, AssetPrice> = { 'IDX:BBCA': { symbol: 'IDX:BBCA', price: 5200, currency: 'IDR', fetchedAt: at, quotedAt: at } };

it('route detail aset bisa dimuat walau modul WebView native tidak ada (Expo Go)', () => {
  // require di dalam tes: kalau PriceChart masih mengimpor react-native-webview secara statis, baris ini melempar.
  expect(() => require('@/app/aset/[id]')).not.toThrow();
});

it('tanpa modul WebView: kartu cadangan, tombol membuka chart TradingView di browser, angka harga tetap tampil', async () => {
  const AssetDetail = require('@/app/aset/[id]').default as () => React.JSX.Element;
  mockParams = { id: 'bbca' };
  await act(async () => {
    render(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
        <I18nProvider initialLang="id">
          <ThemeProvider initialMode="dark">
            <ToastProvider>
              <AppStoreProvider preset={sampleState()}>
                <PlanningProvider preset={{ goals: [], deposits: [], bills: [], debts: [], payments: [], subscriptions: [], splits: [] }}>
                  <AssetsProvider preset={{ assets: [bbca], prices, snapshots: [] }}>
                    <PaywallProvider>
                      <AssetDetail />
                    </PaywallProvider>
                  </AssetsProvider>
                </PlanningProvider>
              </AppStoreProvider>
            </ToastProvider>
          </ThemeProvider>
        </I18nProvider>
      </SafeAreaProvider>,
    );
  });
  expect(screen.getByText('Grafik harga')).toBeTruthy();
  expect(screen.getByText('Grafik interaktif belum tersedia di versi aplikasi ini.')).toBeTruthy();
  expect(screen.queryByTestId('webview')).toBeNull();
  expect(screen.getByText('Rp 5.200 per lembar')).toBeTruthy();
  await act(async () => {
    fireEvent.press(screen.getByLabelText('Lihat chart di browser'));
  });
  expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith('https://www.tradingview.com/chart/?symbol=IDX%3ABBCA');
});

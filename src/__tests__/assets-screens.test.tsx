import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import HomeScreen from '@/app/(tabs)/index';
import AsetScreen from '@/app/(tabs)/aset';
import AssetDetail from '@/app/aset/[id]';
import { PaywallProvider } from '@/components/shell/Paywall';
import { ToastProvider } from '@/components/ui';
import type { Asset, AssetPrice } from '@/data/assets';
import type { Debt } from '@/data/planning';
import type { PlanningData } from '@/data/remote/planning';
import type { AssetsData } from '@/data/remote/assets';
import { sampleState } from '@/data/sample-state';
import { I18nProvider } from '@/i18n';
import { computeNetWorth } from '@/lib/assets';
import { accountBalance } from '@/lib/transactions';
import { formatMoney } from '@/lib/money';
import { AppStoreProvider } from '@/state/AppStore';
import { AssetsProvider } from '@/state/assets';
import { PlanningProvider } from '@/state/planning';
import type { AppState } from '@/state/reducer';
import { ThemeProvider } from '@/theme/ThemeProvider';

const mockPush = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), navigate: mockPush, replace: mockPush }),
  useLocalSearchParams: () => mockParams,
  router: { push: (...a: unknown[]) => mockPush(...a) },
}));

// Deck kartu memakai Extrapolation reanimated yang tidak ada di mock jest; tidak relevan untuk angka kekayaan bersih.
jest.mock('@/features/home/AccountDeck', () => ({ AccountDeck: () => null }));

const base = sampleState();
const fresh = new Date().toISOString();
const NO_PLANNING: PlanningData = { goals: [], deposits: [], bills: [], debts: [], payments: [], subscriptions: [], splits: [] };
const debt: Debt = { id: 'd1', kind: 'debt', counterparty: 'Budi', principal: 2_000_000, balance: 1_250_000, aprBp: 0, minPayment: 0, currency: 'IDR', status: 'active' };

const bbca: Asset = { id: 'bbca', type: 'stock_id', symbol: 'BBCA', name: 'Bank Central Asia', quantity: 100, buyPrice: 4800, currency: 'IDR', priceKey: 'IDX:BBCA', createdAt: fresh };
const house: Asset = { id: 'rumah', type: 'property', name: 'Rumah', currency: 'IDR', valueOverride: 900_000_000, createdAt: fresh };
const livePrice: Record<string, AssetPrice> = { 'IDX:BBCA': { symbol: 'IDX:BBCA', price: 5200, currency: 'IDR', fetchedAt: fresh } };

function wrap(ui: ReactNode, opts: { assets?: Partial<AssetsData>; planning?: Partial<PlanningData>; state?: Partial<AppState> } = {}) {
  return render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <I18nProvider initialLang="id">
        <ThemeProvider initialMode="dark">
          <ToastProvider>
            <AppStoreProvider preset={{ ...base, ...opts.state }}>
              <PlanningProvider preset={{ ...NO_PLANNING, ...opts.planning }}>
                <AssetsProvider preset={{ assets: [], prices: {}, snapshots: [], ...opts.assets }}>
                  <PaywallProvider>{ui}</PaywallProvider>
                </AssetsProvider>
              </PlanningProvider>
            </AppStoreProvider>
          </ToastProvider>
        </ThemeProvider>
      </I18nProvider>
    </SafeAreaProvider>,
  );
}

const expectedTotal = (assets: Asset[], prices: Record<string, AssetPrice>, debts: Debt[]) =>
  computeNetWorth({
    accounts: base.accounts.map((a) => ({ ...a, balance: accountBalance(a, base.transactions) })),
    assets, prices, debts, main: base.mainCurrency, now: Date.now(),
  }).total;

beforeEach(() => {
  mockPush.mockClear();
  mockParams = {};
});

describe('tab Aset', () => {
  it('kekayaan bersih di tab Aset sama dengan angka di Home (aset + utang ikut dihitung)', async () => {
    const opts = { assets: { assets: [bbca, house], prices: livePrice }, planning: { debts: [debt] } };
    const label = formatMoney(expectedTotal([bbca, house], livePrice, [debt]), base.mainCurrency);
    await wrap(<AsetScreen />, opts);
    expect(screen.getByLabelText(label)).toBeTruthy();
    await screen.unmount();
    await wrap(<HomeScreen />, opts);
    expect(screen.getByLabelText(label)).toBeTruthy();
  });

  it('toggle "Gabungkan aset" mati: Home tanpa aset, tab Aset tetap penuh', async () => {
    const opts = { assets: { assets: [bbca, house], prices: livePrice }, planning: { debts: [debt] }, state: { includeAssets: false } };
    const full = formatMoney(expectedTotal([bbca, house], livePrice, [debt]), base.mainCurrency);
    const noAssets = formatMoney(expectedTotal([], livePrice, [debt]), base.mainCurrency);
    await wrap(<HomeScreen />, opts);
    expect(screen.getByLabelText(noAssets)).toBeTruthy();
    expect(screen.queryByLabelText(full)).toBeNull();
    await screen.unmount();
    await wrap(<AsetScreen />, opts);
    expect(screen.getByLabelText(full)).toBeTruthy();
    const toggle = screen.getByLabelText('Gabungkan aset ke saldo Beranda');
    expect(toggle.props.accessibilityState?.checked ?? toggle.props['aria-checked']).toBe(false);
    await fireEvent.press(toggle);
    const after = screen.getByLabelText('Gabungkan aset ke saldo Beranda');
    expect(after.props.accessibilityState?.checked ?? after.props['aria-checked']).toBe(true);
  });

  it('baris aset: jumlah, harga live + waktu, nilai = jumlah × harga', async () => {
    await wrap(<AsetScreen />, { assets: { assets: [bbca], prices: livePrice } });
    expect(screen.getByText('Bank Central Asia')).toBeTruthy();
    expect(screen.getByText(/^100 lembar · Harga per /)).toBeTruthy();
    expect(screen.getByLabelText(formatMoney(520_000, 'IDR'))).toBeTruthy();
  });

  it('harga hasil sync TradingView (2026-11-06) tampil sebagai harga live untuk keempat jenis', async () => {
    const synced: Record<string, AssetPrice> = {
      'IDX:BBCA': { symbol: 'IDX:BBCA', price: 5200, currency: 'IDR', fetchedAt: fresh },
      'US:AAPL': { symbol: 'US:AAPL', price: 344.17, currency: 'USD', fetchedAt: fresh },
      'CRYPTO:BTC': { symbol: 'CRYPTO:BTC', price: 75996, currency: 'USD', fetchedAt: fresh },
      'GOLD:XAU': { symbol: 'GOLD:XAU', price: 4066.315, currency: 'USD', fetchedAt: fresh },
    };
    const list: Asset[] = [
      bbca,
      { id: 'aapl', type: 'stock_us', symbol: 'AAPL', name: 'Apple', quantity: 2, currency: 'USD', priceKey: 'US:AAPL', createdAt: fresh },
      { id: 'btc', type: 'crypto', symbol: 'BTC', name: 'Bitcoin', quantity: 0.5, currency: 'USD', priceKey: 'CRYPTO:BTC', createdAt: fresh },
      { id: 'xau', type: 'gold', symbol: 'XAU', name: 'Emas', quantity: 10, currency: 'IDR', priceKey: 'GOLD:XAU', createdAt: fresh },
    ];
    await wrap(<AsetScreen />, { assets: { assets: list, prices: synced } });
    expect(screen.getAllByText(/ · Harga per /)).toHaveLength(4);
    expect(screen.queryByText(/Memakai harga beli|Harga live belum tersedia/)).toBeNull();
    expect(screen.queryByText('Harga live tidak tersedia saat ini')).toBeNull();
  });

  it('belum ada aset: ajakan menambah aset', async () => {
    await wrap(<AsetScreen />);
    expect(screen.getByText('Belum ada aset yang dilacak')).toBeTruthy();
    expect(screen.getByText('Tidak ada utang yang tercatat.')).toBeTruthy();
  });

  it('harga live mati: banner, nilai pakai harga beli, tidak Rp 0, tidak crash', async () => {
    await wrap(<AsetScreen />, { assets: { assets: [bbca], prices: {} } });
    expect(screen.getByText('Harga live tidak tersedia saat ini')).toBeTruthy();
    expect(screen.getByText('100 lembar · Memakai harga beli')).toBeTruthy();
    expect(screen.getByLabelText(formatMoney(480_000, 'IDR'))).toBeTruthy();
  });

  it('Free dengan 5 aset: tombol tambah membuka paywall, bukan form', async () => {
    const five = Array.from({ length: 5 }, (_, i) => ({ ...house, id: `m${i}`, name: `Aset ${i}` }));
    await wrap(<AsetScreen />, { assets: { assets: five }, state: { plan: 'free', usage: { ...base.usage, assets: 5 } } });
    expect(screen.getByText('PRO')).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Tambah aset'));
    });
    expect(screen.getByText('Paket Free mencatat sampai 5 aset. Premium mencatat aset tanpa batas.')).toBeTruthy();
    expect(screen.queryByText('Jenis')).toBeNull();
  });
});

describe('detail aset', () => {
  it('harga saat ini, untung/rugi, dan hapus dengan konfirmasi', async () => {
    mockParams = { id: 'bbca' };
    await wrap(<AssetDetail />, { assets: { assets: [bbca], prices: livePrice } });
    expect(screen.getByText('Rp 5.200 per lembar')).toBeTruthy();
    expect(screen.getByText(/^\+Rp 40\.000$/)).toBeTruthy();
    expect(screen.getByLabelText('Naik 8,3% vs harga beli')).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Hapus'));
    });
    expect(screen.getByText('Aset ini tidak lagi dihitung di kekayaan bersih. Riwayat grafik yang sudah tercatat tetap ada.')).toBeTruthy();
  });
});

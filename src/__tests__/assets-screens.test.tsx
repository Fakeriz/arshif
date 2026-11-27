import * as WebBrowser from 'expo-web-browser';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Linking, TurboModuleRegistry } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { processColor, Text } from 'react-native';
import { BalanceBlock } from '@/features/home/BalanceBlock';
import { NetWorthChart } from '@/features/assets/NetWorthChart';
import { PriceChart as WebPriceChart } from '@/features/assets/PriceChart.web';
import { MissingRatesBanner } from '@/features/fx/MissingRatesBanner';
import HomeScreen from '@/app/(tabs)/index';
import AsetScreen from '@/app/(tabs)/aset';
import AssetDetail from '@/app/aset/[id]';
import { PaywallProvider } from '@/components/shell/Paywall';
import { ScanSourceProvider } from '@/components/shell/ScanSourceSheet';
import { Sparkline, StatTile, ToastProvider } from '@/components/ui';
import type { Asset, AssetPrice, NetWorthSnapshot } from '@/data/assets';
import type { Debt } from '@/data/planning';
import { QuotaError } from '@/data/remote/api';
import * as remoteAssets from '@/data/remote/assets';
import * as remoteFunctions from '@/data/remote/functions';
import * as remotePlanning from '@/data/remote/planning';
import { useSaveError } from '@/features/planning/kit';
import type { PlanningData } from '@/data/remote/planning';
import type { AssetsData } from '@/data/remote/assets';
import { sampleState } from '@/data/sample-state';
import { I18nProvider } from '@/i18n';
import { computeNetWorth } from '@/lib/assets';
import { accountBalance } from '@/lib/transactions';
import { formatMoney } from '@/lib/money';
import * as AppStoreMod from '@/state/AppStore';
import { AppStoreProvider } from '@/state/AppStore';
import { AssetsProvider, useAssets } from '@/state/assets';
import { useNetWorth, useNetWorthSnapshot } from '@/state/netWorth';
import { PlanningProvider } from '@/state/planning';
import { useRetry } from '@/state/useRetry';
import type { AppState } from '@/state/reducer';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { chartArea, palettes } from '@/theme/tokens';

const mockPush = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  useFocusEffect: () => undefined,
  useRouter: () => ({ push: mockPush, back: jest.fn(), navigate: mockPush, replace: mockPush }),
  useLocalSearchParams: () => mockParams,
  router: { push: (...a: unknown[]) => mockPush(...a) },
}));

// Jalur build yang membawa modul WebView native (dev/production build). Jalur Expo Go: price-chart-fallback.test.tsx.
const realGet = TurboModuleRegistry.get.bind(TurboModuleRegistry);
jest.spyOn(TurboModuleRegistry, 'get').mockImplementation((name: string) => (name === 'RNCWebViewModule' ? ({} as never) : realGet(name)));

// Deck kartu memakai Extrapolation reanimated yang tidak ada di mock jest; tidak relevan untuk angka kekayaan bersih.

const base = sampleState();
const fresh = new Date().toISOString();
const NO_PLANNING: PlanningData = { goals: [], deposits: [], bills: [], debts: [], payments: [], subscriptions: [], splits: [] };
const debt: Debt = { id: 'd1', kind: 'debt', counterparty: 'Budi', principal: 2_000_000, balance: 1_250_000, aprBp: 0, minPayment: 0, currency: 'IDR', status: 'active' };

const bbca: Asset = { id: 'bbca', type: 'stock_id', symbol: 'BBCA', name: 'Bank Central Asia', quantity: 100, buyPrice: 4800, currency: 'IDR', priceKey: 'IDX:BBCA', createdAt: fresh };
const house: Asset = { id: 'rumah', type: 'property', name: 'Rumah', currency: 'IDR', valueOverride: 900_000_000, createdAt: fresh };
// Quote IDX 12 menit lebih tua dari sync (delay bursa): label harus memakai waktu quote, bukan waktu sync.
const quoted = new Date(Date.now() - 12 * 60_000).toISOString();
const livePrice: Record<string, AssetPrice> = { 'IDX:BBCA': { symbol: 'IDX:BBCA', price: 5200, currency: 'IDR', fetchedAt: fresh, quotedAt: quoted } };

function wrap(ui: ReactNode, opts: { assets?: Partial<AssetsData>; planning?: Partial<PlanningData>; state?: Partial<AppState> } = {}) {
  return render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <I18nProvider initialLang="id">
        <ThemeProvider initialMode="dark">
          <ToastProvider>
            <AppStoreProvider preset={{ ...base, ...opts.state }}>
              <PlanningProvider preset={{ ...NO_PLANNING, ...opts.planning }}>
                <AssetsProvider preset={{ assets: [], prices: {}, snapshots: [], ...opts.assets }}>
                  <PaywallProvider><ScanSourceProvider>{ui}</ScanSourceProvider></PaywallProvider>
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

jest.setTimeout(15_000);

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
    // Toggle ada di menu titik tiga kanan atas, bukan di badan layar.
    expect(screen.queryByLabelText('Gabungkan aset ke saldo Beranda')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Aksi lainnya'));
    const toggle = screen.getByLabelText('Gabungkan aset ke saldo Beranda');
    expect(toggle.props.accessibilityState?.checked ?? toggle.props['aria-checked']).toBe(false);
    await fireEvent.press(toggle);
    const after = screen.getByLabelText('Gabungkan aset ke saldo Beranda');
    expect(after.props.accessibilityState?.checked ?? after.props['aria-checked']).toBe(true);
  });

  it('baris aset: jumlah, harga live + waktu, nilai = jumlah × harga', async () => {
    await wrap(<AsetScreen />, { assets: { assets: [bbca], prices: livePrice } });
    expect(screen.getByText('Bank Central Asia')).toBeTruthy();
    expect(screen.getByText('100 lembar · Harga per 12 mnt lalu · IDX tertunda 10–15 mnt')).toBeTruthy();
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
    // Baris lama tanpa waktu quote: hanya waktu sync yang jujur ditampilkan ("Diambil"), bukan "Harga per".
    expect(screen.getAllByText(/Diambil baru saja/)).toHaveLength(4);
    expect(screen.queryByText(/Harga per/)).toBeNull();
    expect(screen.getAllByText(/IDX tertunda 10–15 mnt/)).toHaveLength(1);
    expect(screen.queryByText(/Memakai harga beli|Harga live belum tersedia/)).toBeNull();
    expect(screen.queryByText('Harga live tidak tersedia saat ini')).toBeNull();
  });

  it('satu aset gagal di semua penyedia: harga terakhir untuk aset itu saja, tanpa banner global', async () => {
    const old = new Date(Date.now() - 3 * 60 * 60_000).toISOString();
    const aapl: Asset = { id: 'aapl', type: 'stock_us', symbol: 'AAPL', name: 'Apple', quantity: 2, currency: 'USD', priceKey: 'US:AAPL', createdAt: fresh };
    const prices = { ...livePrice, 'US:AAPL': { symbol: 'US:AAPL', price: 342.37, currency: 'USD', fetchedAt: old, quotedAt: old } };
    await wrap(<AsetScreen />, { assets: { assets: [bbca, aapl], prices } });
    expect(screen.getByText('2 lembar · Harga terakhir 3 jam lalu')).toBeTruthy();
    expect(screen.getByText(/^100 lembar · Harga per /)).toBeTruthy();
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
    expect(screen.getByText('Paket Free mencatat sampai 5 aset. Pro mencatat aset tanpa batas.')).toBeTruthy();
    expect(screen.queryByText('Jenis')).toBeNull();
  });
});

// Beranda ponsel tidak lagi menampilkan baris kurs (permintaan pemilik); kartu saldo desktop (BalanceBlock) masih.
describe('label kurs di kartu saldo desktop (Fase 4)', () => {
  const usd = { ...base.accounts[0], id: 'usd-acc', name: 'Akun USD', currency: 'USD' };
  const block = <BalanceBlock amount={1_000_000} currency="IDR" accountCount={5} />;
  it('Beranda ponsel tanpa baris kurs', async () => {
    await wrap(<HomeScreen />, { state: { accounts: [...base.accounts, usd], ratesStale: false } });
    expect(screen.queryByText(/kurs per /)).toBeNull();
  });
  it('kurs normal: "kurs per"', async () => {
    await wrap(block, { state: { accounts: [...base.accounts, usd], ratesStale: false } });
    expect(screen.getByText(/kurs per /)).toBeTruthy();
  });
  it('kurs dari cache karena semua sumber gagal: "kurs terakhir"', async () => {
    await wrap(block, { state: { accounts: [...base.accounts, usd], ratesStale: true } });
    expect(screen.getByText(/kurs terakhir /)).toBeTruthy();
    expect(screen.queryByText(/kurs per /)).toBeNull();
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

  it('grafik TradingView: simbol IDX:BBCA, tema gelap dari token, baseUrl, guard subframe, rentang waktu, dan pemulihan error', async () => {
    mockParams = { id: 'bbca' };
    await wrap(<AssetDetail />, { assets: { assets: [bbca], prices: livePrice } });
    expect(screen.getByText('Grafik harga')).toBeTruthy();
    expect(screen.getByLabelText('Grafik harga IDX:BBCA dari TradingView')).toBeTruthy();
    const web = screen.getByTestId('webview');
    expect(web.props.source.baseUrl).toBe('https://arshif.app');
    expect(web.props.source.html).toContain('"symbols":[["IDX:BBCA","IDX:BBCA|3M"]]');
    expect(web.props.source.html).toContain('"colorTheme":"dark"');
    expect(web.props.source.html).toContain('"lineColor":"#A3A3A3"');

    // Ganti rentang waktu ke 1B -> memuat ulang WebView dengan 1M.
    await act(async () => {
      fireEvent.press(screen.getByLabelText('1B'));
    });
    const web1m = screen.getByTestId('webview');
    expect(web1m.props.source.html).toContain('"symbols":[["IDX:BBCA","IDX:BBCA|1M"]]');

    // Guard navigasi: embed subframe & baseUrl diizinkan meski isTopFrame: true (quirk Android), non-https diblokir, https keluar dibuka.
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    expect(web1m.props.onShouldStartLoadWithRequest({ url: 'https://www.tradingview-widget.com/embed-widget/symbol-overview/?locale=id', isTopFrame: true })).toBe(true);
    expect(web1m.props.onShouldStartLoadWithRequest({ url: 'https://arshif.app/', isTopFrame: true })).toBe(true);
    expect(web1m.props.onShouldStartLoadWithRequest({ url: 'about:blank' })).toBe(true);
    expect(web1m.props.onShouldStartLoadWithRequest({ url: 'javascript:alert(1)', isTopFrame: true })).toBe(false);
    expect(web1m.props.onShouldStartLoadWithRequest({ url: 'intent://evil', isTopFrame: true })).toBe(false);
    expect(openURL).not.toHaveBeenCalled();

    expect(web1m.props.onShouldStartLoadWithRequest({ url: 'https://www.tradingview.com/', isTopFrame: true })).toBe(false);
    expect(openURL).toHaveBeenCalledWith('https://www.tradingview.com/');

    // onOpenWindow (target="_blank" Android) hanya membuka https://.
    openURL.mockClear();
    web1m.props.onOpenWindow({ nativeEvent: { targetUrl: 'https://www.tradingview.com/symbols/IDX-BBCA/' } });
    expect(openURL).toHaveBeenCalledWith('https://www.tradingview.com/symbols/IDX-BBCA/');
    openURL.mockClear();
    web1m.props.onOpenWindow({ nativeEvent: { targetUrl: 'tel:123' } });
    expect(openURL).not.toHaveBeenCalled();

    // Error via onMessage atau onHttpError menampilkan tombol Coba lagi & Lihat chart di browser.
    await act(async () => {
      web1m.props.onMessage({ nativeEvent: { data: 'tv-chart-error' } });
    });
    expect(screen.getByText('Grafik tidak bisa dimuat. Periksa koneksimu.')).toBeTruthy();
    const openBrowser = jest.spyOn(WebBrowser, 'openBrowserAsync').mockResolvedValue({ type: 'opened' } as never);
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Lihat chart di browser'));
    });
    expect(openBrowser).toHaveBeenCalledWith('https://www.tradingview.com/chart/?symbol=IDX%3ABBCA');

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Coba lagi'));
    });
    expect(screen.getByTestId('webview')).toBeTruthy();

    await act(async () => {
      screen.getByTestId('webview').props.onHttpError();
    });
    expect(screen.getByText('Grafik tidak bisa dimuat. Periksa koneksimu.')).toBeTruthy();
    openURL.mockRestore();
    openBrowser.mockRestore();
  });

  it('harga sub-sen (SHIB): detail aset, PriceAlertCard, dan FairPriceCard tidak membulatkan ke $0.00', async () => {
    mockParams = { id: 'shib' };
    const shib: Asset = { id: 'shib', type: 'crypto', symbol: 'SHIB', name: 'Shiba Inu', quantity: 1000, currency: 'USD', priceKey: 'CRYPTO:SHIB', createdAt: fresh };
    const shibPrices: Record<string, AssetPrice> = { 'CRYPTO:SHIB': { symbol: 'CRYPTO:SHIB', price: 0.00000363, currency: 'USD', fetchedAt: fresh, quotedAt: fresh } };
    const shibAlerts = [{ id: 'al1', assetId: 'shib', pct: 5, basePrice: 0.00000363, currency: 'USD', createdAt: fresh }];
    const invokeSpy = jest.spyOn(remoteFunctions, 'invokeFn').mockResolvedValue({
      verdict: 'fair',
      targetLow: 0.0000031,
      targetHigh: 0.0000042,
      livePrice: 0.00000363,
      reasons: ['Volume stabil'],
    } as never);

    await wrap(<AssetDetail />, {
      assets: { assets: [shib], prices: shibPrices, alerts: shibAlerts },
      state: { plan: 'premium' },
    });
    expect(screen.getByText('$0.00000363 per koin')).toBeTruthy();
    expect(screen.getByText(/Aktif: beri tahu saat harga bergerak ±5% dari \$0\.00000363\./)).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Tanya Coach'));
    });
    expect(screen.getByText('Kisaran wajar $0.0000031 sampai $0.0000042')).toBeTruthy();
    expect(screen.getByText('Harga sekarang $0.00000363')).toBeTruthy();
    invokeSpy.mockRestore();
  });

  it('PriceChart.web: iframe cross-origin langsung, pemilih rentang, dan fallback error saat preflight gagal', async () => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = jest.fn(() => Promise.resolve({} as Response));
    const view = await wrap(<WebPriceChart symbol="IDX:BBCA" label="Grafik IDX:BBCA" />);
    type JsonNode = { type?: string; props?: Record<string, unknown>; children?: unknown[] };
    const findNode = (node: unknown): JsonNode | null => {
      if (!node || typeof node !== 'object') return null;
      if (Array.isArray(node)) {
        for (const item of node) {
          const hit = findNode(item);
          if (hit) return hit;
        }
        return null;
      }
      const n = node as JsonNode;
      if (n.type === 'iframe') return n;
      return n.children ? findNode(n.children) : null;
    };
    const findIframe = () => {
      const hit = findNode(view.toJSON());
      expect(hit).not.toBeNull();
      return hit!;
    };

    const frame3m = findIframe();
    expect(frame3m.props?.srcDoc).toBeUndefined();
    const src3m = String(frame3m.props?.src);
    expect(src3m).toContain('https://www.tradingview-widget.com/embed-widget/symbol-overview/?locale=id#');
    expect(frame3m.props?.sandbox).toBe('allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox');
    expect(frame3m.props?.referrerPolicy).toBe('no-referrer');
    expect(decodeURIComponent(src3m.split('#')[1]!)).toContain('"symbols":[["IDX:BBCA","IDX:BBCA|3M"]]');

    await act(async () => {
      fireEvent.press(screen.getByLabelText('1T'));
    });
    const src12m = String(findIframe().props?.src);
    expect(decodeURIComponent(src12m.split('#')[1]!)).toContain('"symbols":[["IDX:BBCA","IDX:BBCA|12M"]]');

    // Preflight gagal -> menampilkan pesan error + tombol Coba lagi & Lihat chart di browser.
    globalThis.fetch = jest.fn(() => Promise.reject(new Error('offline')));
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Semua'));
    });
    expect(screen.getByText('Grafik tidak bisa dimuat. Periksa koneksimu.')).toBeTruthy();
    expect(screen.getByLabelText('Coba lagi')).toBeTruthy();
    expect(screen.getByLabelText('Lihat chart di browser')).toBeTruthy();

    globalThis.fetch = jest.fn(() => Promise.resolve({} as Response));
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Coba lagi'));
    });
    expect(findIframe()).toBeTruthy();
    globalThis.fetch = realFetch;
  });

  it('aset manual: tanpa grafik', async () => {
    mockParams = { id: 'rumah' };
    await wrap(<AssetDetail />, { assets: { assets: [house], prices: {} } });
    expect(screen.queryByText('Grafik harga')).toBeNull();
  });

  it('harga segar: tanpa badge harga terakhir dan tanpa ajakan nilai manual', async () => {
    mockParams = { id: 'bbca' };
    await wrap(<AssetDetail />, { assets: { assets: [bbca], prices: livePrice } });
    expect(screen.queryByText('HARGA TERAKHIR')).toBeNull();
    expect(screen.queryByLabelText('Isi nilai manual')).toBeNull();
  });

  it('semua penyedia gagal: harga terakhir + badge + tombol nilai manual; untung/rugi tetap dari harga terakhir', async () => {
    mockParams = { id: 'bbca' };
    const old = new Date(Date.now() - 5 * 60 * 60_000).toISOString();
    await wrap(<AssetDetail />, { assets: { assets: [bbca], prices: { 'IDX:BBCA': { symbol: 'IDX:BBCA', price: 5200, currency: 'IDR', fetchedAt: old, quotedAt: old } } } });
    expect(screen.getByText('HARGA TERAKHIR')).toBeTruthy();
    expect(screen.getByText('Harga terakhir 5 jam lalu · IDX tertunda 10–15 mnt')).toBeTruthy();
    expect(screen.getByText('Semua sumber harga gagal untuk aset ini. Nilai memakai harga terakhir yang diketahui.')).toBeTruthy();
    expect(screen.getByLabelText('Naik 8,3% vs harga beli')).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Isi nilai manual'));
    });
    expect(screen.getByText('Nilai manual (opsional)')).toBeTruthy();
  });

  it('belum pernah ada harga live: tidak Rp 0, tidak ada untung/rugi palsu, tombol nilai manual tersedia', async () => {
    mockParams = { id: 'aapl' };
    const aapl: Asset = { id: 'aapl', type: 'stock_us', symbol: 'AAPL', name: 'Apple', quantity: 23, currency: 'USD', priceKey: 'US:AAPL', createdAt: fresh };
    await wrap(<AssetDetail />, { assets: { assets: [aapl], prices: {} } });
    expect(screen.getAllByText('Harga live belum tersedia').length).toBeGreaterThan(0);
    expect(screen.queryByLabelText(/vs harga beli/)).toBeNull();
    expect(screen.getByLabelText('Isi nilai manual')).toBeTruthy();
  });

  it('Hero /aset/[id] mengikuti mainCurrency (IDR) dengan nilai asli ($) sebagai pendamping, dan fallback aman tanpa kurs', async () => {
    mockParams = { id: 'aapl' };
    const aapl: Asset = { id: 'aapl', type: 'stock_us', symbol: 'AAPL', name: 'Apple', quantity: 2, currency: 'USD', priceKey: 'US:AAPL', createdAt: fresh };
    const aaplPrices: Record<string, AssetPrice> = { 'US:AAPL': { symbol: 'US:AAPL', price: 200, currency: 'USD', fetchedAt: fresh, quotedAt: fresh } };
    // SAMPLE_USD_RATES memasang USD: 1, IDR: 16250 -> 2 × $200 = $400 -> Rp 6.500.000.
    await wrap(<AssetDetail />, { assets: { assets: [aapl], prices: aaplPrices }, state: { mainCurrency: 'IDR' } });
    expect(screen.getByLabelText(formatMoney(6_500_000, 'IDR'))).toBeTruthy();
    expect(screen.getByText('$400.00')).toBeTruthy();
    await screen.unmount();

    // Kurs ke XYZ tidak tersedia -> fallback aman tetap menampilkan $400.00 di Hero tanpa crash.
    await wrap(<AssetDetail />, { assets: { assets: [aapl], prices: aaplPrices }, state: { mainCurrency: 'XYZ' } });
    expect(screen.getByLabelText('$400.00')).toBeTruthy();
  });

  it('hideBalance: menyembunyikan Hero, Jumlah, Harga beli, Harga saat ini, dan Untung/rugi di /aset/[id]', async () => {
    mockParams = { id: 'bbca' };
    const noted: Asset = { ...bbca, buyDate: '2026-01-15', notes: 'Dividen panjang' };
    await wrap(<AssetDetail />, { assets: { assets: [noted], prices: livePrice }, state: { hideBalance: true } });
    expect(screen.getByLabelText('Saldo disembunyikan')).toBeTruthy();
    expect(screen.queryByText('100 lembar')).toBeNull();
    expect(screen.queryByText('Rp 4.800 per lembar')).toBeNull();
    expect(screen.queryByText('Rp 5.200 per lembar')).toBeNull();
    expect(screen.queryByText(/^\+Rp 40\.000$/)).toBeNull();
    expect(screen.getAllByText('••••').length).toBeGreaterThanOrEqual(4);
    // Mata uang harga, tanggal beli, dan catatan tetap terlihat.
    expect(screen.getByText('IDR')).toBeTruthy();
    expect(screen.getByText('Dividen panjang')).toBeTruthy();
  });
});

describe('Paket 2 (P1): NetWorthChart, Sparkline, StatTile, snapshot, FX, pending & refresh', () => {
  type JsonNode = { type?: string; props?: Record<string, unknown>; children?: unknown[] };
  const findAllNodes = (node: unknown, pred: (n: JsonNode) => boolean, out: JsonNode[] = []): JsonNode[] => {
    if (!node || typeof node !== 'object') return out;
    if (Array.isArray(node)) {
      for (const item of node) findAllNodes(item, pred, out);
      return out;
    }
    const n = node as JsonNode;
    if (pred(n)) out.push(n);
    if (n.children) findAllNodes(n.children, pred, out);
    return out;
  };

  it('NetWorthChart: konversi lintas mata uang, chip periode 1B/3B/1T, dan mode hideBalance tanpa bocor nominal', async () => {
    const snaps: NetWorthSnapshot[] = [
      { date: '2026-06-01', total: 16_250_000, assetsTotal: 16_250_000, liabilitiesTotal: 0, currency: 'IDR' },
      { date: '2026-10-25', total: 24_375_000, assetsTotal: 24_375_000, liabilitiesTotal: 0, currency: 'IDR' },
      { date: '2026-11-10', total: 32_500_000, assetsTotal: 32_500_000, liabilitiesTotal: 0, currency: 'IDR' },
    ];
    const view = await wrap(<NetWorthChart snapshots={snaps} currency="USD" />);
    // 16.25jt -> $1,000 (1k), 32.5jt -> $2,000 (2k).
    expect(screen.getByText('1k – 2k')).toBeTruthy();
    expect(screen.getByLabelText(/terakhir \$2,000\.00/)).toBeTruthy();
    // Span > 30 hari -> chip 1B, 3B, 1T tampil; klik 1B mempersempit rentang ke 25 Okt – 10 Nov ($1.5k – $2k).
    expect(screen.getByLabelText('1B')).toBeTruthy();
    expect(screen.getByLabelText('3B')).toBeTruthy();
    expect(screen.getByLabelText('1T')).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByLabelText('1B'));
    });
    expect(screen.getByText('1.5k – 2k')).toBeTruthy();
    await view.unmount();

    // hideBalance: label umum, tanpa nominal dan tanpa SVG path.
    const hiddenView = await wrap(<NetWorthChart snapshots={snaps} currency="USD" hidden />);
    expect(screen.getByLabelText('Saldo disembunyikan')).toBeTruthy();
    expect(screen.queryByLabelText(/\$2,000/)).toBeNull();
    expect(findAllNodes(hiddenView.toJSON(), (n) => n.type === 'RNSVGPath' || n.type === 'Path')).toHaveLength(0);
  });

  it('Sparkline memakai warna netral saat perubahan < 0,05% (selaras TrendBadge)', async () => {
    const strokeOf = (tree: unknown) => {
      const paths = findAllNodes(tree, (n) => (n.type === 'RNSVGPath' || n.type === 'Path') && n.props?.stroke != null);
      const s = paths[0]?.props?.stroke as string | { payload?: number } | undefined;
      return typeof s === 'string' ? processColor(s) : s?.payload;
    };
    const flatView = await wrap(<Sparkline values={[100_000_000, 100_000_400]} />);
    expect(strokeOf(flatView.toJSON())).toBe(processColor(chartArea.dark.line));
    await flatView.unmount();

    const upView = await wrap(<Sparkline values={[100_000_000, 101_000_000]} />);
    expect(strokeOf(upView.toJSON())).toBe(processColor(palettes.dark.positive));
  });

  it('StatTile menyesuaikan lebar Sparkline dari onLayout footer agar tidak meluber di layar sempit', async () => {
    await wrap(<StatTile label="Total aset" amount={10_000_000} currency="IDR" change={0.05} series={[9_000_000, 10_000_000]} />);
    const spark = screen.getByLabelText(/Tren 2 periode/);
    let node: typeof spark | null = spark;
    while (node && typeof node.props.onLayout !== 'function') node = node.parent;
    expect(node).not.toBeNull();
    await act(async () => {
      fireEvent(node!, 'layout', { nativeEvent: { layout: { width: 126.7, height: 60 } } });
    });
    expect(screen.getByLabelText(/Tren 2 periode/).props.style).toEqual({ width: 126, height: 36 });
  });

  it('useNetWorthSnapshot tidak mencatat snapshot saat ada aset live tanpa nilai (nw.unvalued > 0)', async () => {
    function SnapshotProbe() {
      const nw = useNetWorth();
      const { snapshots } = useAssets();
      useNetWorthSnapshot(nw);
      return <Text testID="snap-count">{snapshots.length}</Text>;
    }
    const unvaluedAapl: Asset = { id: 'aapl', type: 'stock_us', symbol: 'AAPL', name: 'Apple', quantity: 2, currency: 'USD', priceKey: 'US:AAPL', createdAt: fresh };
    await wrap(<SnapshotProbe />, { assets: { assets: [unvaluedAapl], prices: {}, snapshots: [] } });
    expect(screen.getByTestId('snap-count').props.children).toBe(0);
    await screen.unmount();

    await wrap(<SnapshotProbe />, { assets: { assets: [bbca], prices: livePrice, snapshots: [] } });
    expect(screen.getByTestId('snap-count').props.children).toBe(1);
  });

  it('useMissingRates mendeteksi mata uang aset dan utang aktif, serta aman tanpa AssetsProvider', async () => {
    const sarHouse: Asset = { id: 'sar1', type: 'property', name: 'Ruko', currency: 'SAR', valueOverride: 500_000_00, createdAt: fresh };
    await wrap(<AsetScreen />, { assets: { assets: [sarHouse] } });
    expect(screen.getByText('Kurs SAR belum ada')).toBeTruthy();
    await screen.unmount();

    const sarDebt: Debt = { id: 'd-sar', kind: 'debt', counterparty: 'Ahmad', principal: 100_000, balance: 50_000, aprBp: 0, minPayment: 0, currency: 'SAR', status: 'active' };
    await wrap(<AsetScreen />, { planning: { debts: [sarDebt] } });
    expect(screen.getByText('Kurs SAR belum ada')).toBeTruthy();
    await screen.unmount();

    // Terisolasi tanpa AssetsProvider / PlanningProvider: tetap jalan tanpa error.
    await render(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
        <I18nProvider initialLang="id">
          <ThemeProvider initialMode="dark">
            <ToastProvider>
              <AppStoreProvider preset={base}>
                <MissingRatesBanner />
              </AppStoreProvider>
            </ToastProvider>
          </ThemeProvider>
        </I18nProvider>
      </SafeAreaProvider>,
    );
    expect(screen.queryByText(/Kurs .* belum ada/)).toBeNull();
  });

  it('kode baru tanpa harga server menampilkan banner menunggu harga pertama, serta useRetry & refresh memuat ulang semua provider', async () => {
    const storeReload = jest.fn(async () => undefined);
    const useStoreSpy = jest.spyOn(AppStoreMod, 'useStore').mockReturnValue({
      state: base,
      dispatch: jest.fn(),
      reload: storeReload,
      refreshUsage: jest.fn(),
      commitTx: jest.fn(async (tx) => tx),
      applyLocal: jest.fn(),
      refreshing: false,
      userId: 'user-test',
    });
    const loadAssetsSpy = jest.spyOn(remoteAssets, 'loadAssets').mockResolvedValue({ assets: [], prices: {}, snapshots: [] });
    const loadPlanningSpy = jest.spyOn(remotePlanning, 'loadPlanning').mockResolvedValue(NO_PLANNING);
    const setTzSpy = jest.spyOn(remotePlanning, 'setTimezone').mockResolvedValue(undefined);
    const nvda: Asset = { id: 'nvda', type: 'stock_us', symbol: 'NVDA', name: 'Nvidia', quantity: 1, currency: 'USD', priceKey: 'US:NVDA', createdAt: fresh };
    const insertSpy = jest.spyOn(remoteAssets, 'insertAsset').mockResolvedValue(nvda);
    const loadPricesSpy = jest.spyOn(remoteAssets, 'loadPrices').mockResolvedValue({});

    try {
      let triggerAdd: (() => Promise<void>) | null = null;
      let triggerRetry: (() => void) | null = null;
      function Harness() {
        const { addAsset } = useAssets();
        const retry = useRetry();
        triggerAdd = async () => {
          await addAsset('stock_us', { symbol: 'NVDA', name: 'Nvidia', quantity: 1, currency: 'USD' });
        };
        triggerRetry = retry;
        return <AsetScreen />;
      }

      const view = await render(
        <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
          <I18nProvider initialLang="id">
            <ThemeProvider initialMode="dark">
              <ToastProvider>
                <PlanningProvider>
                  <AssetsProvider>
                    <PaywallProvider>
                      <ScanSourceProvider>
                        <Harness />
                      </ScanSourceProvider>
                    </PaywallProvider>
                  </AssetsProvider>
                </PlanningProvider>
              </ToastProvider>
            </ThemeProvider>
          </I18nProvider>
        </SafeAreaProvider>,
      );

      await act(async () => {
        await triggerAdd?.();
      });
      expect(screen.getByText('Menunggu harga live pertama')).toBeTruthy();
      expect(screen.queryByText('Harga live tidak tersedia saat ini')).toBeNull();

      storeReload.mockClear();
      loadAssetsSpy.mockClear();
      loadPlanningSpy.mockClear();
      await act(async () => {
        triggerRetry?.();
      });
      expect(storeReload).toHaveBeenCalledTimes(1);
      expect(loadAssetsSpy).toHaveBeenCalledTimes(1);
      expect(loadPlanningSpy).toHaveBeenCalledTimes(1);

      const findRefresh = (el: ReturnType<typeof screen.getByText>): (() => void) => {
        let cur: typeof el | null = el;
        while (cur) {
          const rc = cur.props?.refreshControl as { props?: { onRefresh?: () => void } } | undefined;
          if (rc?.props?.onRefresh) return rc.props.onRefresh;
          cur = cur.parent;
        }
        throw new Error('RefreshControl tidak ditemukan');
      };

      storeReload.mockClear();
      loadAssetsSpy.mockClear();
      loadPlanningSpy.mockClear();
      const onAsetRefresh = findRefresh(screen.getByText('Total kekayaan bersih'));
      await act(async () => {
        onAsetRefresh();
      });
      expect(storeReload).toHaveBeenCalledTimes(1);
      expect(loadAssetsSpy).toHaveBeenCalledTimes(1);
      expect(loadPlanningSpy).toHaveBeenCalledTimes(1);
      await view.unmount();

      // Pull-to-refresh di /aset/[id] memuat ulang AppStore dan AssetsProvider.
      mockParams = { id: 'bbca' };
      loadAssetsSpy.mockResolvedValue({ assets: [bbca], prices: livePrice, snapshots: [] });
      const detailView = await render(
        <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
          <I18nProvider initialLang="id">
            <ThemeProvider initialMode="dark">
              <ToastProvider>
                <AssetsProvider>
                  <PaywallProvider>
                    <AssetDetail />
                  </PaywallProvider>
                </AssetsProvider>
              </ToastProvider>
            </ThemeProvider>
          </I18nProvider>
        </SafeAreaProvider>,
      );
      storeReload.mockClear();
      loadAssetsSpy.mockClear();
      const onDetailRefresh = findRefresh(screen.getByText('Bank Central Asia'));
      await act(async () => {
        onDetailRefresh();
      });
      expect(storeReload).toHaveBeenCalledTimes(1);
      expect(loadAssetsSpy).toHaveBeenCalledTimes(1);
      await detailView.unmount();
    } finally {
      useStoreSpy.mockRestore();
      loadAssetsSpy.mockRestore();
      loadPlanningSpy.mockRestore();
      setTzSpy.mockRestore();
      insertSpy.mockRestore();
      loadPricesSpy.mockRestore();
    }
  });
});

describe('Paket 3: manual override, navigasi baris rekening/kartu kredit, gain/loss di /aset, dan batas 200 aset', () => {
  it('PriceAlertCard & FairPriceCard disembunyikan ketika aset live memiliki valueOverride', async () => {
    mockParams = { id: 'bbca-manual' };
    const overridden: Asset = { ...bbca, id: 'bbca-manual', valueOverride: 600_000 };
    await wrap(<AssetDetail />, {
      assets: { assets: [overridden], prices: livePrice },
      state: { plan: 'premium' },
    });
    expect(screen.queryByText('Alert harga')).toBeNull();
    expect(screen.queryByText('Harga wajar menurut Coach')).toBeNull();
  });

  it('tab Aset: baris aset menampilkan gain/loss di kolom kanan (tersembunyi saat hideBalance) dan Rekening/Kartu kredit menavigasi ke /pengaturan/akun', async () => {
    const creditAcc = { ...base.accounts[0], id: 'cc-1', name: 'BCA Visa', type: 'kartu_kredit' as const, currency: 'IDR', openingBalance: -500_000 };
    await wrap(<AsetScreen />, {
      assets: { assets: [bbca], prices: livePrice },
      state: { accounts: [...base.accounts, creditAcc] },
    });
    expect(screen.getByText(/^\+Rp 40\.000$/)).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByText('Rekening'));
    });
    expect(mockPush).toHaveBeenCalledWith('/pengaturan/akun');

    mockPush.mockClear();
    await act(async () => {
      fireEvent.press(screen.getByText('Kartu kredit dan paylater'));
    });
    expect(mockPush).toHaveBeenCalledWith('/pengaturan/akun');
    await screen.unmount();

    // Saat hideBalance aktif, gain/loss tidak bocor di baris aset.
    await wrap(<AsetScreen />, {
      assets: { assets: [bbca], prices: livePrice },
      state: { hideBalance: true },
    });
    expect(screen.queryByText(/^\+Rp 40\.000$/)).toBeNull();
  });

  it('useSaveError menampilkan toast batas 200 aset pada limit_assets_max atau QuotaError pengguna Premium (bukan paywall Free)', async () => {
    let fireErr: ((e: unknown) => void) | null = null;
    function ErrProbe() {
      const saveError = useSaveError();
      fireErr = (e) => saveError(e, 'Paket Free mencatat sampai 5 aset.');
      return null;
    }

    await wrap(<ErrProbe />, { state: { plan: 'premium' } });
    await act(async () => {
      fireErr?.(new Error('limit_assets_max'));
    });
    expect(screen.getByText('Batas maksimum 200 aset tercapai.')).toBeTruthy();
    expect(screen.queryByText('Paket Free mencatat sampai 5 aset.')).toBeNull();

    await act(async () => {
      fireErr?.(new QuotaError('assets'));
    });
    expect(screen.getByText('Batas maksimum 200 aset tercapai.')).toBeTruthy();
    expect(screen.queryByText('Paket Free mencatat sampai 5 aset.')).toBeNull();
  });
});

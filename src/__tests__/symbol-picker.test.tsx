import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { COINGECKO_IDS } from '../../supabase/functions/_shared/price-coingecko';
import { neutralCode, searchSymbols } from '../../supabase/functions/_shared/symbol-search';
import { PaywallProvider } from '@/components/shell/Paywall';
import { ToastProvider } from '@/components/ui';
import type { Asset } from '@/data/assets';
import { IDX_STOCKS } from '@/data/idxStocks';
import { sampleState } from '@/data/sample-state';
import { AssetForm } from '@/features/assets/AssetForm';
import { I18nProvider } from '@/i18n';
import { CRYPTO_COINS, knownName, searchCrypto, searchIdx } from '@/lib/symbols';
import { AppStoreProvider } from '@/state/AppStore';
import { AssetsProvider } from '@/state/assets';
import { PlanningProvider } from '@/state/planning';
import { ThemeProvider } from '@/theme/ThemeProvider';

const mockSearch = jest.fn();
jest.mock('@/data/remote/symbols', () => ({ searchSymbolsRemote: (...a: unknown[]) => mockSearch(...a) }));
const mockInsert = jest.fn();
jest.mock('@/data/remote/assets', () => ({
  ...jest.requireActual('@/data/remote/assets'),
  insertAsset: (...a: unknown[]) => mockInsert(...a),
  loadPrices: async () => ({}),
}));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn() }), router: { push: jest.fn() } }));

const base = sampleState();

function wrap(ui: ReactNode) {
  return render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <I18nProvider initialLang="id">
        <ThemeProvider initialMode="dark">
          <ToastProvider>
            <AppStoreProvider preset={{ ...base, plan: 'premium' }}>
              <PlanningProvider preset={{ goals: [], deposits: [], bills: [], debts: [], payments: [], subscriptions: [], splits: [] }}>
                <AssetsProvider preset={{ assets: [], prices: {}, snapshots: [] }}>
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

beforeEach(() => {
  mockSearch.mockReset();
  mockInsert.mockReset();
  mockInsert.mockImplementation(async (id: string, type: Asset['type'], a: { symbol?: string; name: string; currency: string; quantity?: number }) => ({
    id, type, symbol: a.symbol, name: a.name, currency: a.currency, quantity: a.quantity, priceKey: `X:${a.symbol}`, createdAt: new Date().toISOString(),
  }));
});

const open = async () => {
  await act(async () => {
    wrap(<AssetForm visible onClose={() => undefined} />);
  });
};
const type = async (label: string, text: string) => {
  await act(async () => {
    fireEvent.changeText(screen.getByLabelText(label), text);
  });
};
const press = async (label: string) => {
  await act(async () => {
    fireEvent.press(screen.getByLabelText(label));
  });
};
const save = () => press('Simpan');

describe('daftar dan pencarian lokal', () => {
  it('IDX: kode persis di depan; nama dan singkatan ketemu ("bri" -> BBRI)', () => {
    expect(searchIdx('bbca')[0].code).toBe('BBCA');
    expect(searchIdx('bri').map((o) => o.code)).toContain('BBRI');
    expect(searchIdx('bank central asia')[0]).toEqual({ code: 'BBCA', name: 'PT Bank Central Asia Tbk', market: 'IDX' });
    expect(searchIdx('telkom').map((o) => o.code)).toContain('TLKM');
    expect(searchIdx('zzzzqq')).toEqual([]);
    expect(IDX_STOCKS.every(([c]) => /^[A-Z0-9.]{1,15}$/.test(c))).toBe(true);
  });

  it('kripto = tepat 18 koin yang dipetakan ke CoinGecko; TON ketemu lewat nama barunya', () => {
    expect(CRYPTO_COINS.map(([c]) => c).sort()).toEqual(Object.keys(COINGECKO_IDS).sort());
    expect(searchCrypto('gram')[0].code).toBe('TON');
    expect(searchCrypto('bitcoin').map((o) => o.code)).toEqual(['BTC', 'BCH']);
    expect(searchCrypto('pepe')).toEqual([]);
    expect(knownName('CRYPTO', 'ETH')).toBe('Ethereum');
    expect(knownName('US', 'AAPL')).toBeNull();
  });
});

describe('symbol-search (server, fetch dipalsukan)', () => {
  const realFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = realFetch; });

  it('hanya simbol yang bisa diberi harga oleh penyedia: JKT/.JK untuk IDX, bursa utama AS untuk US', async () => {
    const quotes = [
      { symbol: 'BBCA', exchange: 'BTS', quoteType: 'ETF', longname: 'JPMorgan BetaBuilders Canada ETF' },
      { symbol: 'BBCA.JK', exchange: 'JKT', quoteType: 'EQUITY', shortname: 'Bank Central Asia Tbk', longname: 'PT Bank Central Asia Tbk' },
      { symbol: 'PBCRY', exchange: 'PNK', quoteType: 'EQUITY', longname: 'PT Bank Central Asia Tbk' },
      { symbol: 'BRK-B', exchange: 'NYQ', quoteType: 'EQUITY', longname: 'Berkshire  Hathaway Inc.' },
      { symbol: 'SAAPL=F', exchange: 'CME', quoteType: 'FUTURE' },
    ];
    globalThis.fetch = jest.fn(async () => ({ ok: true, status: 200, json: async () => ({ quotes }) }) as Response);
    expect(await searchSymbols('IDX', 'bbca')).toEqual([{ code: 'BBCA', name: 'PT Bank Central Asia Tbk', market: 'IDX' }]);
    expect(await searchSymbols('US', 'bbca')).toEqual([
      { code: 'BBCA', name: 'JPMorgan BetaBuilders Canada ETF', market: 'US' },
      { code: 'BRK.B', name: 'Berkshire Hathaway Inc.', market: 'US' },
    ]);
    expect(neutralCode('IDX', { symbol: 'BBCA', exchange: 'JKT', quoteType: 'EQUITY' })).toBeNull();
  });
});

describe('pemilih kode di form tambah aset', () => {
  it('IDX lokal: ketik "bri", pilih BBRI -> kode terisi, nama ikut terisi, tersimpan sebagai BBRI', async () => {
    await open();
    await type('Kode', 'bri');
    const option = screen.getByLabelText(/, kode BBRI, IDX$/);
    await act(async () => {
      fireEvent.press(option);
    });
    expect(screen.getByText('BBRI · IDX')).toBeTruthy();
    expect(screen.getByDisplayValue('PT Bank Rakyat Indonesia (Persero) Tbk Class B')).toBeTruthy();
    await type('Jumlah (lembar)', '100');
    await save();
    expect(mockSearch).not.toHaveBeenCalled();
    expect(mockInsert.mock.calls[0].slice(1)).toEqual(['stock_id', expect.objectContaining({ symbol: 'BBRI', quantity: 100 })]);
  });

  it('kode tidak dikenal: tidak bisa disimpan diam-diam, errornya menyebut kueri', async () => {
    mockSearch.mockResolvedValue([]);
    await open();
    await type('Kode', 'ZZZZ');
    expect(await screen.findByText('Tidak ada kode IDX yang cocok dengan "ZZZZ".')).toBeTruthy();
    expect(mockSearch).toHaveBeenCalledWith('IDX', 'ZZZZ');
    await type('Nama', 'Coba');
    await type('Jumlah (lembar)', '1');
    await save();
    expect(screen.getByText('"ZZZZ" belum dipilih. Pilih kode dari daftar hasil.')).toBeTruthy();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('belum memilih sama sekali: error "pilih kode"', async () => {
    await open();
    await type('Nama', 'Coba');
    await type('Jumlah (lembar)', '1');
    await save();
    expect(screen.getByText('Pilih kode dari daftar.')).toBeTruthy();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('US lewat server: pilih AAPL; tombol Ganti mengosongkan pilihan', async () => {
    mockSearch.mockResolvedValue([{ code: 'AAPL', name: 'Apple Inc.', market: 'US' }]);
    await open();
    await press('Saham US');
    await type('Kode', 'apple');
    await screen.findByText('Apple Inc.');
    await press('Apple Inc., kode AAPL, Bursa AS');
    expect(mockSearch).toHaveBeenCalledWith('US', 'apple');
    expect(screen.getByText('AAPL · Bursa AS')).toBeTruthy();
    await press('Ganti');
    expect(screen.queryByText('AAPL · Bursa AS')).toBeNull();
    expect(screen.getByLabelText('Kode')).toBeTruthy();
  });

  it('server mati: pesan error + coba lagi; kode yang lolos SYMBOL_RE boleh dipakai (perilaku lama)', async () => {
    mockSearch.mockRejectedValue(new Error('network'));
    await open();
    await press('Saham US');
    await type('Kode', 'nvda');
    expect(await screen.findByText('Pencarian kode tidak tersedia saat ini.')).toBeTruthy();
    expect(screen.getByLabelText('Coba lagi')).toBeTruthy();
    await press('Pakai kode NVDA');
    expect(screen.getByText('NVDA · Bursa AS')).toBeTruthy();
    await type('Nama', 'Nvidia');
    await type('Jumlah (lembar)', '2');
    await save();
    expect(mockInsert.mock.calls[0].slice(1)).toEqual(['stock_us', expect.objectContaining({ symbol: 'NVDA', name: 'Nvidia' })]);
  });

  it('kripto di luar 18 koin: ditolak dengan penjelasan, tanpa panggilan server', async () => {
    await open();
    await press('Kripto');
    await type('Kode', 'pepe');
    expect(screen.getAllByText('Kripto ini belum didukung. Pilih dari daftar, atau catat sebagai aset Lainnya dengan nilai manual.').length).toBeGreaterThan(0);
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it('emas: tanpa pemilih, selalu XAU', async () => {
    await open();
    await press('Emas');
    expect(screen.queryByLabelText('Kode')).toBeNull();
  });

  it('mode ubah: kode tersimpan tampil sebagai pilihan (tidak perlu memilih ulang)', async () => {
    const btc: Asset = { id: 'b', type: 'crypto', symbol: 'BTC', name: 'BTC saya', quantity: 0.1, currency: 'USD', priceKey: 'CRYPTO:BTC', createdAt: new Date().toISOString() };
    await act(async () => {
      wrap(<AssetForm visible onClose={() => undefined} asset={btc} />);
    });
    expect(screen.getByText('Bitcoin')).toBeTruthy();
    expect(screen.getByText('BTC · Kripto')).toBeTruthy();
  });
});

import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import AssetDetail from '@/app/aset/[id]';
import { NotificationsSheet } from '@/components/shell/NotificationsSheet';
import { PaywallProvider } from '@/components/shell/Paywall';
import { ToastProvider } from '@/components/ui';
import type { Asset, AssetAlert, AssetPrice } from '@/data/assets';
import type { AssetsData } from '@/data/remote/assets';
import { sampleState } from '@/data/sample-state';
import { RecapTab } from '@/features/coach/RecapTab';
import { I18nProvider } from '@/i18n';
import { AppStoreProvider } from '@/state/AppStore';
import { AssetsProvider } from '@/state/assets';
import { PlanningProvider } from '@/state/planning';
import type { AppState } from '@/state/reducer';
import { ThemeProvider } from '@/theme/ThemeProvider';

const mockSaveAlert = jest.fn();
const mockDeleteAlert = jest.fn();
jest.mock('@/data/remote/assets', () => ({
  ...jest.requireActual('@/data/remote/assets'),
  saveAlert: (...a: unknown[]) => mockSaveAlert(...a),
  deleteAlert: (...a: unknown[]) => mockDeleteAlert(...a),
}));
const mockInvoke = jest.fn();
jest.mock('@/data/remote/functions', () => {
  const actual = jest.requireActual('@/data/remote/functions');
  return { ...actual, invokeFn: (...a: unknown[]) => mockInvoke(...a) };
});
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), navigate: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({ id: 'bbca' }),
  router: { push: jest.fn() },
}));

const base = sampleState();
const at = new Date().toISOString();
const bbca: Asset = { id: 'bbca', type: 'stock_id', symbol: 'BBCA', name: 'Bank Central Asia', quantity: 100, buyPrice: 4800, currency: 'IDR', priceKey: 'IDX:BBCA', createdAt: at, notes: 'catatan pribadi' };
const prices: Record<string, AssetPrice> = { 'IDX:BBCA': { symbol: 'IDX:BBCA', price: 5200, currency: 'IDR', fetchedAt: at, quotedAt: at } };

async function wrap(ui: ReactNode, opts: { assets?: Partial<AssetsData>; state?: Partial<AppState> } = {}) {
  await act(async () => {
    render(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
        <I18nProvider initialLang="id">
          <ThemeProvider initialMode="dark">
            <ToastProvider>
              <AppStoreProvider preset={{ ...base, ...opts.state }}>
                <PlanningProvider preset={{ goals: [], deposits: [], bills: [], debts: [], payments: [], subscriptions: [], splits: [] }}>
                  <AssetsProvider preset={{ assets: [bbca], prices, snapshots: [], ...opts.assets }}>
                    <PaywallProvider>{ui}</PaywallProvider>
                  </AssetsProvider>
                </PlanningProvider>
              </AppStoreProvider>
            </ToastProvider>
          </ThemeProvider>
        </I18nProvider>
      </SafeAreaProvider>,
    );
  });
}
const press = async (label: string) => {
  await act(async () => {
    fireEvent.press(screen.getByLabelText(label));
  });
};

beforeEach(() => {
  mockSaveAlert.mockReset();
  mockDeleteAlert.mockReset();
  mockInvoke.mockReset();
});

describe('alert harga di detail aset', () => {
  it('pasang alert ambang kecil 0,1%: patokan dari server tampil sebagai status aktif', async () => {
    mockSaveAlert.mockResolvedValue({ id: 'al1', assetId: 'bbca', pct: 0.1, basePrice: 5200, currency: 'IDR' } satisfies AssetAlert);
    await wrap(<AssetDetail />);
    await act(async () => {
      fireEvent.changeText(screen.getByLabelText('Ambang (%)'), '0,1');
    });
    await press('Pasang alert');
    expect(mockSaveAlert).toHaveBeenCalledWith('bbca', 0.1, undefined);
    expect(screen.getByText('Aktif: beri tahu saat harga bergerak ±0,1% dari Rp 5.200.')).toBeTruthy();
    expect(screen.getByText('Dicek tiap jam. Notifikasi muncul di lonceng, sekali saja.')).toBeTruthy();
  });

  it('ambang di luar 0,1 sampai 50 ditolak sebelum dikirim', async () => {
    await wrap(<AssetDetail />);
    await act(async () => {
      fireEvent.changeText(screen.getByLabelText('Ambang (%)'), '0');
    });
    await press('Pasang alert');
    expect(screen.getByText('Isi angka 0,1 sampai 50.')).toBeTruthy();
    expect(mockSaveAlert).not.toHaveBeenCalled();
  });

  it('alert terkirim: status + pasang lagi memakai alert yang sama (patokan baru dari server)', async () => {
    const sent: AssetAlert = { id: 'al1', assetId: 'bbca', pct: 0.1, basePrice: 5200, currency: 'IDR', triggeredAt: '2026-11-07T03:05:00Z' };
    mockSaveAlert.mockResolvedValue({ ...sent, basePrice: 5206, triggeredAt: undefined });
    await wrap(<AssetDetail />, { assets: { alerts: [sent] } });
    expect(screen.getByText(/^Terkirim .*: harga bergerak melewati ±0,1%\.$/)).toBeTruthy();
    await press('Pasang lagi dari harga sekarang');
    expect(mockSaveAlert).toHaveBeenCalledWith('bbca', 0.1, 'al1');
    expect(screen.getByText('Aktif: beri tahu saat harga bergerak ±0,1% dari Rp 5.206.')).toBeTruthy();
  });
});

describe('Tanya harga wajar di detail aset', () => {
  it('Premium: request hanya angka ringkasan; jawaban memakai harga live yang sama dengan layar', async () => {
    mockInvoke.mockResolvedValue({ verdict: 'fair', targetLow: 4900, targetHigh: 5600, livePrice: 5200, currency: 'IDR', reasons: ['Harga sekarang Rp 5.200 ada di tengah kisaran.', 'Ini perkiraan, bukan rekomendasi.'] });
    await wrap(<AssetDetail />, { state: { plan: 'premium' } });
    await press('Tanya Coach');
    expect(mockInvoke).toHaveBeenCalledTimes(1);
    const [fn, body] = mockInvoke.mock.calls[0];
    expect(fn).toBe('coach-price');
    expect(body).toEqual({ lang: 'id', asset: { market: 'IDX', symbol: 'BBCA', currency: 'IDR', livePrice: 5200, buyPrice: 4800, changePct: 8.3 } });
    expect(JSON.stringify(body)).not.toMatch(/Bank Central Asia|catatan|quantity/);
    expect(screen.getByText('Dalam kisaran wajar')).toBeTruthy();
    expect(screen.getByText('Kisaran wajar Rp 4.900 sampai Rp 5.600')).toBeTruthy();
    expect(screen.getByText('Harga sekarang Rp 5.200')).toBeTruthy();
    expect(screen.getByText('Rp 5.200 per lembar')).toBeTruthy();
  });

  it('Free: badge PRO, tombol membuka paywall, tidak ada panggilan ke server', async () => {
    await wrap(<AssetDetail />, { state: { plan: 'free' } });
    expect(screen.getAllByText('PRO').length).toBeGreaterThan(0);
    await press('Tanya Coach');
    expect(mockInvoke).not.toHaveBeenCalled();
    expect(screen.getAllByText('Tanya Coach (20 pertanyaan/hari) hanya ada di Premium.').length).toBeGreaterThan(1);
  });

  it('kuota harian habis dari server: pesan batas, bukan diam', async () => {
    const { FnError } = jest.requireActual('@/data/remote/functions');
    mockInvoke.mockRejectedValue(new FnError('quota', 'coachAsk'));
    await wrap(<AssetDetail />, { state: { plan: 'premium' } });
    await press('Tanya Coach');
    expect(screen.getByText('Batas 20 pertanyaan hari ini tercapai. Coba lagi besok.')).toBeTruthy();
  });
});

it('notifikasi alert di lonceng: harga dan persen diformat, arah naik', async () => {
  const n = {
    id: 'n1', type: 'price_alert' as const, titleKey: 'domain.notif.priceUpTitle' as const, messageKey: 'domain.notif.priceAlertMessage' as const,
    vars: { name: 'Bank Central Asia', symbol: 'BBCA', change: 0.1, threshold: 0.1, price: 5206, base: 5200, priceCurrency: 'IDR' },
    date: '2026-11-07', time: '10:05', read: false,
  };
  await wrap(<NotificationsSheet visible onClose={() => undefined} />, { state: { notifications: [n] } });
  expect(screen.getByText('Bank Central Asia naik 0,1%')).toBeTruthy();
  expect(screen.getByText('BBCA sekarang Rp 5.206, bergerak +0,1% dari Rp 5.200 saat alert dipasang (ambang ±0,1%). Alert ini sudah selesai; pasang lagi di detail aset bila perlu.')).toBeTruthy();
});

it('Weekly Replay menyebut penggerak portofolio 7 hari', async () => {
  const weekAgo = new Date(Date.now() - 8 * 86_400_000).toISOString().slice(0, 10);
  await wrap(<RecapTab transactions={[]} currency="IDR" />, { assets: { history: { 'IDX:BBCA': [{ day: weekAgo, price: 5000, currency: 'IDR' }] } } });
  expect(screen.getByText('Portofolio di harga live')).toBeTruthy();
  expect(screen.getByText('Naik Rp 20.000 dalam 7 hari, terutama karena BBCA +4%.')).toBeTruthy();
});

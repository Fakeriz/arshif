import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import AutomationScreen from '@/app/otomasi/index';
import ReviewScreen from '@/app/otomasi/tinjau';
import { ToastProvider } from '@/components/ui';
import type { SmartLogItem } from '@/data/remote/smartlog';
import { sampleState } from '@/data/sample-state';
import { I18nProvider } from '@/i18n';
import { AppStoreProvider } from '@/state/AppStore';
import { SmartLogContext, type SmartLogValue } from '@/state/smartlog';
import { ThemeProvider } from '@/theme/ThemeProvider';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), navigate: mockPush }),
  router: { push: (...a: unknown[]) => mockPush(...a) },
}));

const preset = sampleState();
const bca = preset.accounts.find((a) => a.currency === 'IDR')!;

const item = (o: Partial<SmartLogItem> = {}): SmartLogItem => ({
  id: 'item-1', pkg: 'id.dana', bank: 'dana', date: '2026-11-05', time: '14:30', type: 'expense', amount: 30000, currency: 'IDR',
  merchant: 'WARTEG', accountId: null, status: 'review', reasons: ['no_link'], excerpt: 'Pembayaran Rp 30.000 ke WARTEG berhasil',
  createdAt: '2026-11-05T07:30:00Z', ...o,
});

function fake(o: Partial<SmartLogValue> = {}): SmartLogValue {
  return {
    supported: true, status: 'ready', enabled: false, permission: false, links: [], review: [], recent: [], held: 0,
    reload: jest.fn(async () => undefined), setEnabled: jest.fn(async () => undefined), openPermission: jest.fn(),
    setLink: jest.fn(async () => undefined), processNow: jest.fn(async () => undefined), confirm: jest.fn(async () => undefined),
    dismiss: jest.fn(async () => undefined), undo: jest.fn(async () => undefined), ...o,
  };
}

function wrap(ui: ReactNode, value: SmartLogValue) {
  return render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <I18nProvider initialLang="id">
        <ThemeProvider initialMode="dark">
          <ToastProvider>
            <AppStoreProvider preset={preset}>
              <SmartLogContext.Provider value={value}>{ui}</SmartLogContext.Provider>
            </AppStoreProvider>
          </ToastProvider>
        </ThemeProvider>
      </I18nProvider>
    </SafeAreaProvider>,
  );
}

beforeEach(() => mockPush.mockClear());

describe('layar Automation', () => {
  it('menyalakan Smart Log tanpa izin: dialog penjelasan lalu buka izin Android', async () => {
    const v = fake();
    await wrap(<AutomationScreen />, v);
    await act(async () => fireEvent.press(screen.getByRole('switch', { name: 'Smart Log' })));
    expect(v.setEnabled).toHaveBeenCalledWith(true);
    expect(await screen.findByText('Izinkan Arshif membaca notifikasi bank?')).toBeTruthy();
    await fireEvent.press(screen.getByText('Buka izin Android'));
    expect(v.openPermission).toHaveBeenCalled();
  });

  it('status: ON tapi izin belum ada = menunggu izin + tombol Beri izin', async () => {
    await wrap(<AutomationScreen />, fake({ enabled: true }));
    expect(screen.getByText('Menunggu izin akses notifikasi')).toBeTruthy();
    expect(screen.getByLabelText('Beri izin')).toBeTruthy();
  });

  it('aktif hanya bila izin + ON', async () => {
    await wrap(<AutomationScreen />, fake({ enabled: true, permission: true }));
    expect(screen.getByText('Aktif')).toBeTruthy();
    expect(screen.queryByLabelText('Beri izin')).toBeNull();
  });

  it('tautkan aplikasi ke kartu lewat sheet, lalu lepas', async () => {
    const v = fake({ links: [{ pkg: 'com.bca', accountId: bca.id }] });
    await wrap(<AutomationScreen />, v);
    expect(screen.getByLabelText(`BCA mobile, ${bca.name}`)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('myBCA, Belum ditautkan'));
    await fireEvent.press(await screen.findByText(`${bca.name} · ${bca.currency}`));
    expect(v.setLink).toHaveBeenCalledWith('com.bca.mybca.omni.android', bca.id);
    await fireEvent.press(screen.getByLabelText(`BCA mobile, ${bca.name}`));
    await fireEvent.press(await screen.findByLabelText('Lepas tautan'));
    expect(v.setLink).toHaveBeenCalledWith('com.bca', null);
  });

  it('kuota habis: jumlah yang ditahan + jalan ke Premium', async () => {
    await wrap(<AutomationScreen />, fake({ enabled: true, permission: true, held: 3 }));
    expect(screen.getByText(/3 notifikasi bank ditahan/)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Lihat Premium'));
    expect(mockPush).toHaveBeenCalledWith('/premium');
  });

  it('di luar Android: penjelasan, bukan sakelar mati tanpa alasan', async () => {
    await wrap(<AutomationScreen />, fake({ supported: false }));
    expect(screen.getByText('Smart Log butuh aplikasi Android')).toBeTruthy();
  });

  it('state memuat', async () => {
    await wrap(<AutomationScreen />, fake({ status: 'loading' }));
    expect(screen.getByLabelText('Memuat pengaturan Smart Log')).toBeTruthy();
  });

  it('state gagal + coba lagi', async () => {
    const v = fake({ status: 'error' });
    await wrap(<AutomationScreen />, v);
    await fireEvent.press(screen.getByLabelText('Coba lagi'));
    expect(v.reload).toHaveBeenCalled();
  });
});

describe('layar To Review', () => {
  it('dibuka = antrean perangkat dikuras (sekali pakai)', async () => {
    const v = fake();
    await wrap(<ReviewScreen />, v);
    expect(v.processNow).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Tidak ada yang perlu dicek')).toBeTruthy();
  });

  it('kartu tertaut: Catat mengonfirmasi dengan id baris; Abaikan', async () => {
    const it1 = item({ accountId: bca.id, reasons: ['duplicate'], pkg: 'com.bca.mybca.omni.android', bank: 'bca' });
    const v = fake({ review: [it1] });
    await wrap(<ReviewScreen />, v);
    expect(screen.getByText('Mungkin sudah tercatat')).toBeTruthy();
    expect(screen.getByText('Pembayaran Rp 30.000 ke WARTEG berhasil')).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByLabelText('Catat')));
    expect(v.confirm).toHaveBeenCalledWith(it1, expect.objectContaining({ id: 'item-1', source: 'smartlog', amount: 30000, accountId: bca.id }));
    expect(await screen.findByText('Dicatat')).toBeTruthy();
  });

  it('Abaikan', async () => {
    const it1 = item({ accountId: bca.id });
    const v = fake({ review: [it1] });
    await wrap(<ReviewScreen />, v);
    await act(async () => fireEvent.press(screen.getByLabelText('Abaikan')));
    expect(v.dismiss).toHaveBeenCalledWith(it1);
  });

  it('belum tertaut: tidak ada Catat langsung, Ubah dulu membuka form', async () => {
    await wrap(<ReviewScreen />, fake({ review: [item()] }));
    expect(screen.queryByLabelText('Catat')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Ubah dulu'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/otomasi/catat', params: { id: 'item-1' } });
  });

  it('yang tercatat otomatis: Batalkan dan Ubah', async () => {
    const v = fake({ recent: [item({ id: 'auto-1', status: 'applied', accountId: bca.id, reasons: [], excerpt: null })] });
    await wrap(<ReviewScreen />, v);
    await act(async () => fireEvent.press(screen.getByLabelText('Batalkan')));
    expect(v.undo).toHaveBeenCalledWith('auto-1');
    await fireEvent.press(screen.getByLabelText('Ubah'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/tambah', params: { id: 'auto-1' } });
  });
});

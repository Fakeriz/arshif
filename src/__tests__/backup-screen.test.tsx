import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import CadanganScreen from '@/app/pengaturan/cadangan';
import { ToastProvider } from '@/components/ui';
import { sampleState } from '@/data/sample-state';
import { I18nProvider } from '@/i18n';
import { AppStoreProvider } from '@/state/AppStore';
import { AssetsProvider } from '@/state/assets';
import { InvoicesProvider } from '@/state/invoices';
import { PlanningProvider } from '@/state/planning';
import { ThemeProvider } from '@/theme/ThemeProvider';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true }) }));
jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(async () => null), setItemAsync: jest.fn(async () => undefined) }));
const mockAuth = jest.fn((..._a: unknown[]) => [{}, null, jest.fn()]);
jest.mock('expo-auth-session/providers/google', () => ({ useAuthRequest: (...a: unknown[]) => mockAuth(...a) }));
const ENV = ['EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID', 'EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID', 'EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID'];
afterEach(() => {
  ENV.forEach((k) => delete process.env[k]);
  mockAuth.mockClear();
});
jest.mock('expo-web-browser', () => ({ maybeCompleteAuthSession: jest.fn() }));

const wrap = (ui: ReactNode) =>
  render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <I18nProvider initialLang="id">
        <ThemeProvider initialMode="light">
          <ToastProvider>
            <AppStoreProvider preset={sampleState()}>
              <PlanningProvider preset={{ goals: [], deposits: [], bills: [], debts: [], payments: [], subscriptions: [], splits: [] }}>
                <AssetsProvider preset={{ assets: [], prices: {}, snapshots: [] }}>
                  <InvoicesProvider preset={[]}>{ui}</InvoicesProvider>
                </AssetsProvider>
              </PlanningProvider>
            </AppStoreProvider>
          </ToastProvider>
        </ThemeProvider>
      </I18nProvider>
    </SafeAreaProvider>,
  );

describe('Pengaturan > Cadangan', () => {
  it('(b) client ID kosong: halaman tetap tampil, hook login Google TIDAK dipanggil, Drive nonaktif dengan keterangan', async () => {
    ENV.forEach((k) => (process.env[k] = ''));
    await wrap(<CadanganScreen />);
    expect(mockAuth).not.toHaveBeenCalled();
    expect(screen.getByText('Dari file')).toBeTruthy();
    expect(screen.getAllByText('Belum tersedia: Google Drive belum diatur di aplikasi ini.').length).toBeGreaterThan(0);
    expect(screen.queryByText('Hubungkan Google Drive')).toBeNull();
    // Tanpa kunci: baris Lihat kunci tidak tampil (bukan kontrol mati).
    expect(screen.queryByText('Lihat kunci pemulihan')).toBeNull();
    expect(screen.getByText('Belum pernah')).toBeTruthy();
  });

  it('(a) client ID terisi: hook login dipanggil dengan scope drive.file, Drive aktif, tanpa error', async () => {
    ENV.forEach((k) => (process.env[k] = '123456789-abcdefgh.apps.googleusercontent.com'));
    await wrap(<CadanganScreen />);
    expect(mockAuth).toHaveBeenCalledWith(expect.objectContaining({ scopes: ['https://www.googleapis.com/auth/drive.file'] }));
    expect(screen.getByText('Belum terhubung')).toBeTruthy();
    expect(screen.getByText('Hubungkan Google Drive')).toBeTruthy();
    expect(screen.queryByText('Belum tersedia: Google Drive belum diatur di aplikasi ini.')).toBeNull();
  });

  it('cadangan pertama: kunci baru ditampilkan dan harus dibuktikan tersimpan (4 karakter terakhir)', async () => {
    await wrap(<CadanganScreen />);
    await fireEvent.press(screen.getAllByText('Buat cadangan').at(-1)!);
    expect(screen.getByText('Simpan kunci pemulihan')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Ketik 4 huruf terakhir kunci'), 'XXXX');
    await fireEvent.press(screen.getByText('Saya sudah menyimpannya'));
    expect(screen.getByText('Tidak cocok. Periksa 4 huruf terakhir.')).toBeTruthy();
  });
});

describe('login Google Drive di web (tanpa popup)', () => {
  const { Platform } = require('react-native');
  const { captureDriveRedirect, loadWebToken } = require('@/features/backup/driveToken');
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    jest.replaceProperty(Platform, 'OS', 'web');
    Object.assign(globalThis, {
      sessionStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v), removeItem: (k: string) => store.delete(k) },
    });
  });
  const withUrl = (hash: string) => {
    const replaceState = jest.fn();
    Object.assign(globalThis, { window: { location: { hash, pathname: '/pengaturan/cadangan', search: '' }, history: { replaceState } } });
    return replaceState;
  };

  it('token dari URL disimpan hanya bila state cocok, lalu dihapus dari URL', () => {
    store.set('arshif.drive.state', 'abc');
    const replaceState = withUrl('#access_token=TOKEN123&expires_in=3599&state=abc');
    captureDriveRedirect();
    expect(loadWebToken()?.token).toBe('TOKEN123');
    expect(replaceState).toHaveBeenCalledWith(null, '', '/pengaturan/cadangan');
  });

  it('state asing (bukan dari Hubungkan di perangkat ini) ditolak', () => {
    store.set('arshif.drive.state', 'abc');
    const replaceState = withUrl('#access_token=EVIL&expires_in=3599&state=lain');
    captureDriveRedirect();
    expect(loadWebToken()).toBeNull();
    expect(replaceState).toHaveBeenCalled();
  });
});

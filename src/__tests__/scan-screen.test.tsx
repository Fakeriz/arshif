import { act, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import ScanScreen from '@/app/scan';
import { PaywallProvider } from '@/components/shell/Paywall';
import { acquireReceipts, startScan } from '@/features/capture/scanLaunch';
import { ToastProvider } from '@/components/ui';
import { sampleState } from '@/data/sample-state';
import { I18nProvider } from '@/i18n';
import { AppStoreProvider } from '@/state/AppStore';
import type { AppState } from '@/state/reducer';
import { ThemeProvider } from '@/theme/ThemeProvider';

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, canGoBack: () => true, replace: jest.fn(), push: jest.fn() }),
  useLocalSearchParams: () => ({}),
}));
const mockLaunchCamera = jest.fn();
const mockPermission = jest.fn();
jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: () => mockPermission(),
  launchCameraAsync: (...a: unknown[]) => mockLaunchCamera(...a),
  launchImageLibraryAsync: () => Promise.resolve({ canceled: true, assets: null }),
}));

// Modul native pemindai (ML Kit / VisionKit): null = tidak tersedia (Expo Go, build lama), seperti di jest.
let mockScanner: { isAvailable: () => boolean; scan: jest.Mock } | null = null;
jest.mock('../../modules/doc-scanner', () => ({
  get DocScannerNative() {
    return mockScanner;
  },
}));

const base = sampleState();
const wrap = (ui: ReactNode, state: Partial<AppState> = {}) =>
  render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <I18nProvider initialLang="id">
        <ThemeProvider initialMode="dark">
          <ToastProvider>
            <AppStoreProvider preset={{ ...base, ...state }}>
              <PaywallProvider>{ui}</PaywallProvider>
            </AppStoreProvider>
          </ToastProvider>
        </ThemeProvider>
      </I18nProvider>
    </SafeAreaProvider>,
  );

/** ML Kit hanya dicoba di Android. */
const asAndroid = () => jest.replaceProperty(Platform, 'OS', 'android');
afterEach(() => jest.restoreAllMocks());

beforeEach(() => {
  mockScanner = null;
  mockBack.mockReset();
  mockLaunchCamera.mockReset().mockResolvedValue({ canceled: true, assets: null });
  mockPermission.mockReset().mockResolvedValue({ granted: true });
});

describe('Ambil struk (acquireReceipts): pemindai dulu, kamera bawaan sebagai cadangan', () => {
  it('tanpa pemindai: kamera bawaan; batal = kosong (tetap di layar asal)', async () => {
    expect(await acquireReceipts('camera')).toEqual([]);
    expect(mockLaunchCamera).toHaveBeenCalledTimes(1);
  });

  it('Android dengan ML Kit: pemindai ML Kit (dengan galeri) yang dibuka, bukan kamera bawaan', async () => {
    asAndroid();
    mockScanner = { isAvailable: () => true, scan: jest.fn().mockResolvedValue('file://scan.jpg') };
    expect(await acquireReceipts('camera')).toEqual([{ uri: 'file://scan.jpg' }]);
    expect(mockScanner.scan).toHaveBeenCalledWith(true);
    expect(mockLaunchCamera).not.toHaveBeenCalled();
  });

  it('ML Kit gagal dibuka: jatuh ke kamera bawaan, bukan error', async () => {
    asAndroid();
    mockScanner = { isAvailable: () => true, scan: jest.fn().mockRejectedValue(new Error('ERR_UNAVAILABLE')) };
    await acquireReceipts('camera');
    expect(mockScanner.scan).toHaveBeenCalledTimes(1);
    expect(mockLaunchCamera).toHaveBeenCalledTimes(1);
  });
});

describe('Layar Scan: hanya progres dan error, tanpa tombol pilihan', () => {
  it('dibuka tanpa struk (muat ulang/tautan langsung): kembali, tidak membuka kamera, tanpa tombol pilihan', async () => {
    await act(async () => {
      wrap(<ScanScreen />);
    });
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockLaunchCamera).not.toHaveBeenCalled();
    expect(screen.queryByText('Pilih dari galeri')).toBeNull();
    expect(screen.queryByText('Ambil foto struk')).toBeNull();
  });

  it('izin kamera ditolak: layar error menawarkan galeri', async () => {
    asAndroid();
    mockPermission.mockResolvedValueOnce({ granted: false });
    const go = jest.fn();
    await act(async () => {
      startScan('camera', go);
    });
    expect(go).toHaveBeenCalledWith('/scan');
    await act(async () => {
      wrap(<ScanScreen />);
    });
    expect(mockBack).not.toHaveBeenCalled();
    expect(screen.getByText('Pilih dari galeri')).toBeTruthy();
  });

  it('kuota scan habis: ajakan Premium tampil', async () => {
    await act(async () => {
      wrap(<ScanScreen />, { plan: 'free', usage: { ...base.usage, scan: 20 } });
    });
    expect(screen.getByText('Kuota scan bulan ini habis')).toBeTruthy();
  });
});

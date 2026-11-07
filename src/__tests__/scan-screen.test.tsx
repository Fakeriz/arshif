import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import ScanScreen from '@/app/scan';
import { PaywallProvider } from '@/components/shell/Paywall';
import { ToastProvider } from '@/components/ui';
import { sampleState } from '@/data/sample-state';
import { I18nProvider } from '@/i18n';
import { AppStoreProvider } from '@/state/AppStore';
import type { AppState } from '@/state/reducer';
import { ThemeProvider } from '@/theme/ThemeProvider';

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, replace: jest.fn(), push: jest.fn() }),
  useLocalSearchParams: () => ({}),
}));
const mockLaunchCamera = jest.fn();
jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: () => Promise.resolve({ granted: true }),
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
});

describe('Receipt OCR: kamera langsung, tanpa layar kamera perantara', () => {
  it('tanpa pemindai: kamera bawaan langsung terbuka; batal = pilihan ambil foto / galeri (kamera bawaan tanpa galeri)', async () => {
    await act(async () => {
      wrap(<ScanScreen />);
    });
    expect(mockLaunchCamera).toHaveBeenCalledTimes(1);
    expect(mockBack).not.toHaveBeenCalled();
    expect(screen.getByText('Pilih dari galeri')).toBeTruthy();
    // Ketuk "Ambil foto struk" membuka kamera lagi.
    await act(async () => fireEvent.press(screen.getByText('Ambil foto struk')));
    expect(mockLaunchCamera).toHaveBeenCalledTimes(2);
  });

  it('iOS dengan VisionKit: pemindai Apple yang dibuka; batal = pilihan galeri (VisionKit tanpa galeri)', async () => {
    mockScanner = { isAvailable: () => true, scan: jest.fn().mockResolvedValue(null) };
    await act(async () => {
      wrap(<ScanScreen />);
    });
    expect(mockScanner.scan).toHaveBeenCalledTimes(1);
    expect(mockLaunchCamera).not.toHaveBeenCalled();
    expect(mockBack).not.toHaveBeenCalled();
    expect(screen.getByText('Pilih dari galeri')).toBeTruthy();
  });

  it('Android dengan ML Kit: pemindai ML Kit yang dibuka; batal = kembali (galeri sudah ada di dalam ML Kit)', async () => {
    asAndroid();
    mockScanner = { isAvailable: () => true, scan: jest.fn().mockResolvedValue(null) };
    await act(async () => {
      wrap(<ScanScreen />);
    });
    expect(mockScanner.scan).toHaveBeenCalledWith(true);
    expect(mockLaunchCamera).not.toHaveBeenCalled();
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('ML Kit gagal dibuka: jatuh ke kamera bawaan, bukan layar error', async () => {
    asAndroid();
    mockScanner = { isAvailable: () => true, scan: jest.fn().mockRejectedValue(new Error('ERR_UNAVAILABLE')) };
    await act(async () => {
      wrap(<ScanScreen />);
    });
    expect(mockScanner.scan).toHaveBeenCalledTimes(1);
    expect(mockLaunchCamera).toHaveBeenCalledTimes(1);
  });

  it('kuota scan habis: kamera tidak dibuka, ajakan Premium tampil', async () => {
    await act(async () => {
      wrap(<ScanScreen />, { plan: 'free', usage: { ...base.usage, scan: 20 } });
    });
    expect(mockLaunchCamera).not.toHaveBeenCalled();
    expect(screen.getByText('Kuota scan bulan ini habis')).toBeTruthy();
  });
});

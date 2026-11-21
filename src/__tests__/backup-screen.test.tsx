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
jest.mock('expo-auth-session/providers/google', () => ({ useAuthRequest: () => [null, null, jest.fn()] }));
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
  it('tanpa client ID Google: tidak ada tombol Drive; tanpa kunci: tidak ada baris Lihat kunci (bukan kontrol mati)', async () => {
    await wrap(<CadanganScreen />);
    expect(screen.getByText('Dari file')).toBeTruthy();
    expect(screen.queryByText('Dari Google Drive')).toBeNull();
    expect(screen.queryByText('Lihat kunci pemulihan')).toBeNull();
    expect(screen.getByText('Belum pernah')).toBeTruthy();
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

import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { act } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import HomeScreen from '@/app/(tabs)/index';
import { PaywallProvider } from '@/components/shell/Paywall';
import { ToastProvider } from '@/components/ui';
import { sampleState } from '@/data/sample-state';
import { resetSessionDismiss } from '@/features/home/sessionDismiss';
import { I18nProvider } from '@/i18n';
import { AppStoreProvider } from '@/state/AppStore';
import { AssetsProvider } from '@/state/assets';
import { PlanningProvider } from '@/state/planning';
import { ThemeProvider } from '@/theme/ThemeProvider';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), navigate: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({}),
  router: { push: jest.fn() },
}));
// Deck kartu memakai Extrapolation reanimated yang tidak ada di mock jest; tidak relevan di sini.
jest.mock('@/features/home/AccountDeck', () => ({ AccountDeck: () => null }));

const base = sampleState();
const RECAP = 'Recap mingguanmu sudah siap';

const home = () =>
  render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <I18nProvider initialLang="id">
        <ThemeProvider initialMode="dark">
          <ToastProvider>
            <AppStoreProvider preset={{ ...base, notifPrefs: { ...base.notifPrefs, weekly_recap: true } }}>
              <PlanningProvider preset={{ goals: [], deposits: [], bills: [], debts: [], payments: [], subscriptions: [], splits: [] }}>
                <AssetsProvider preset={{ assets: [], prices: {}, snapshots: [] }}>
                  <PaywallProvider>
                    <HomeScreen />
                  </PaywallProvider>
                </AssetsProvider>
              </PlanningProvider>
            </AppStoreProvider>
          </ToastProvider>
        </ThemeProvider>
      </I18nProvider>
    </SafeAreaProvider>,
  );

beforeEach(() => resetSessionDismiss());

describe('Home', () => {
  it('tanpa kartu Anggaran periode ini dan Kesehatan keuangan', async () => {
    await home();
    expect(screen.getByText(RECAP)).toBeTruthy();
    expect(screen.queryByText(/Anggaran periode ini/)).toBeNull();
    expect(screen.queryByText(/Kesehatan keuangan/)).toBeNull();
    expect(screen.queryByText(/\/100/)).toBeNull();
  });

  it('Recap mingguan ditutup untuk sesi ini saja: hanya di memori, muncul lagi setelah aplikasi dibuka ulang', async () => {
    const setItem = jest.spyOn(AsyncStorage, 'setItem');
    await home();
    await act(async () => {
      let node = screen.getByText(RECAP) as { props: Record<string, unknown>; parent: unknown } | null;
      while (node && !node.props.accessibilityActions) node = node.parent as typeof node;
      (node!.props.onAccessibilityAction as (e: unknown) => void)({ nativeEvent: { actionName: 'dismiss' } });
    });
    expect(screen.queryByText(RECAP)).toBeNull();

    // Pindah layar lalu kembali di sesi yang sama: tetap tertutup.
    await screen.unmount();
    await home();
    expect(screen.queryByText(RECAP)).toBeNull();
    expect(setItem.mock.calls.some(([k, v]) => /recap/i.test(`${k}${v}`))).toBe(false);

    // Aplikasi dibuka ulang (memori kosong): muncul lagi.
    resetSessionDismiss();
    await screen.unmount();
    await home();
    expect(screen.getByText(RECAP)).toBeTruthy();
  });
});

import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { ToastProvider } from '@/components/ui';
import { sampleState } from '@/data/sample-state';
import { I18nProvider } from '@/i18n';
import { AppStoreProvider } from '@/state/AppStore';
import { useBudget } from '@/state/derived';
import { ThemeProvider } from '@/theme/ThemeProvider';

const preset = { ...sampleState(), payday: 25 };
const wrapper = ({ children }: { children: ReactNode }) => (
  <I18nProvider initialLang="id">
    <ThemeProvider initialMode="dark">
      <ToastProvider>
        <AppStoreProvider preset={preset}>{children}</AppStoreProvider>
      </ToastProvider>
    </ThemeProvider>
  </I18nProvider>
);

afterEach(() => jest.useRealTimers());

it('aplikasi terbuka melewati tengah malam ke hari gajian: periode anggaran ikut berganti (audit 18)', async () => {
  jest.useFakeTimers({ now: new Date(2026, 10, 24, 23, 59) });
  const { result, rerender } = await renderHook(() => useBudget(), { wrapper });
  expect(result.current.period.start).toBe('2026-10-25');

  // Tengah malam lewat; tidak ada transaksi atau pengaturan yang berubah, layar hanya dirender ulang.
  jest.setSystemTime(new Date(2026, 10, 25, 0, 1));
  await act(async () => rerender({}));
  expect(result.current.period.start).toBe('2026-11-25');
});

import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, screen } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import { Platform, Text, View } from 'react-native';

import { ForceDark } from '@/components/shell/ForceDark';
import { UploadProgress, VoicePlayer } from '@/components/ui';
import type { Transaction } from '@/data/types';
import { peekHandoff, putHandoff } from '@/features/capture/handoff';
import { I18nProvider, makeT } from '@/i18n';
import { bucketLimits } from '@/lib/budget';
import { findDuplicate } from '@/lib/dedupe';
import { invoiceTotals } from '@/lib/invoice';
import { loanSchedule } from '@/lib/loan';
import { occurrencesInMonth } from '@/lib/planning/schedule';
import { computeShares } from '@/lib/planning/split';
import { effectivePlan } from '@/state/limits';
import { clearUserLocalData } from '@/state/sessionCleanup';
import { InkCard, ThemeProvider, useTheme } from '@/theme/ThemeProvider';
import { buildPalette } from '@/theme/tokens';

const wrap = (ui: React.ReactElement, mode: 'dark' | 'light' = 'dark') =>
  render(
    <I18nProvider initialLang="id">
      <ThemeProvider initialMode={mode}>{ui}</ThemeProvider>
    </I18nProvider>,
  );

describe('clearUserLocalData', () => {
  it('membersihkan kunci AsyncStorage, handoff AI, token Drive, dan SecureStore', async () => {
    await AsyncStorage.multiSet([
      ['arshif.drive.history', '["b1"]'],
      ['arshif.backup.lastAt', '2026-11-26T00:00:00Z'],
      ['arshif.backup.everyDays', '7'],
      ['arshif.smartlog.held', '["h1"]'],
      ['arshif.smartlog.held.user-42', '["h2"]'],
      ['arshif.unrelated', 'keep'],
    ]);
    putHandoff('import', {
      accountId: 'acc-1',
      result: { rows: [], pages: 1 },
    });
    const deleteSpy = jest.spyOn(SecureStore, 'deleteItemAsync').mockResolvedValue();

    try {
      await clearUserLocalData('user-42');
      expect(peekHandoff('import')).toBeNull();
      const entries = await AsyncStorage.multiGet([
        'arshif.drive.history',
        'arshif.backup.lastAt',
        'arshif.backup.everyDays',
        'arshif.smartlog.held',
        'arshif.smartlog.held.user-42',
        'arshif.unrelated',
      ]);
      expect(entries).toEqual([
        ['arshif.drive.history', null],
        ['arshif.backup.lastAt', null],
        ['arshif.backup.everyDays', null],
        ['arshif.smartlog.held', null],
        ['arshif.smartlog.held.user-42', null],
        ['arshif.unrelated', 'keep'],
      ]);
      expect(deleteSpy).toHaveBeenCalledWith('arshif.backup.key');
    } finally {
      deleteSpy.mockRestore();
      await AsyncStorage.removeItem('arshif.unrelated');
    }
  });
});

describe('effectivePlan', () => {
  it('menurunkan premium yang sudah kedaluwarsa ke free', () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    const future = new Date(Date.now() + 86_400_000).toISOString();
    expect(effectivePlan('premium', past)).toBe('free');
    expect(effectivePlan('premium', future)).toBe('premium');
    expect(effectivePlan('premium', null)).toBe('premium');
    expect(effectivePlan('free', future)).toBe('free');
  });
});

describe('findDuplicate', () => {
  const baseTx: Transaction = {
    id: 'tx-1',
    type: 'expense',
    merchant: 'İstanbul Kahve Dünyası',
    categoryKey: 'food',
    accountId: 'acc-try',
    date: '2026-11-20',
    time: '12:00',
    amount: 50000,
    currency: 'TRY',
    accountAmount: 245000,
    source: 'manual',
  };

  it('menangani huruf Turki ı/İ, nominal lintas mata uang accountAmount, dan usedIds stateful', () => {
    const used = new Set<string>();
    const row = {
      date: '2026-11-21',
      description: 'ISTANBUL KAHVE DUNYASI POS',
      amount: 245000,
      currency: 'IDR',
      type: 'expense' as const,
    };
    const first = findDuplicate(row, [baseTx], 'acc-try', used);
    expect(first?.id).toBe('tx-1');
    // Baris mutasi identik kedua tidak mencocokkan transaksi yang sama lagi.
    const second = findDuplicate(row, [baseTx], 'acc-try', used);
    expect(second).toBeNull();
  });
});

describe('occurrencesInMonth & matematika finansial aman', () => {
  it('occurrencesInMonth melompat O(1) lintas dekade dan menangani input tidak valid', () => {
    expect(occurrencesInMonth('1990-01-31', 'monthly', 31, 2026, 2)).toEqual(['2026-02-28']);
    const weekly = occurrencesInMonth('2000-01-01', 'weekly', 1, 2026, 11);
    expect(weekly.length).toBeGreaterThanOrEqual(4);
    expect(weekly.every((d) => d.startsWith('2026-11-'))).toBe(true);
    expect(occurrencesInMonth('2026-01-01', 'monthly', 1, 2026, 13)).toEqual([]);
  });

  it('bucketLimits & computeShares menahan NaN, negatif, dan angka ekstrem', () => {
    expect(bucketLimits(Number.NaN, { needs: 50, wants: 30, savings: 20 })).toEqual({ needs: 0, wants: 0, savings: 0 });
    expect(bucketLimits(-5000, { needs: 50, wants: 30, savings: 20 })).toEqual({ needs: 0, wants: 0, savings: 0 });
    const capped = bucketLimits(1e20, { needs: 50, wants: 30, savings: 20 });
    expect(capped.needs + capped.wants + capped.savings).toBe(90_000_000_000_000);

    const shares = computeShares({
      mode: 'items',
      total: 10000,
      participants: [
        { id: 'me', owner: true },
        { id: 'budi', owner: false },
      ],
      items: [
        { amount: 25000, assigned: ['me'] },
        { amount: 25000, assigned: ['budi'] },
      ],
    });
    expect(shares.me).toBeGreaterThanOrEqual(0);
    expect(shares.budi).toBeGreaterThanOrEqual(0);
    expect(shares.me + shares.budi).toBe(10000);
  });

  it('loanSchedule & invoiceTotals presisi BigInt untuk nominal besar IDR & pembatasan aman', () => {
    const loan = loanSchedule(10_000_000_000_000, 1200, 120, 'flat');
    expect(Number.isSafeInteger(loan.totalInterest)).toBe(true);
    expect(Number.isSafeInteger(loan.totalPaid)).toBe(true);
    expect(loan.totalPaid).toBe(10_000_000_000_000 + loan.totalInterest);

    const maxTenor = loanSchedule(1_000_000, 500, 999_999, 'flat');
    expect(maxTenor.months).toBe(1200);
    expect(loanSchedule(Number.NaN, 500, 12, 'annuity').totalPaid).toBe(0);

    const discounted = invoiceTotals([{ qty: 1.5, unitPrice: 100_000 }], 999_999_999, 1100);
    expect(discounted).toEqual({ subtotal: 150_000, discount: 150_000, tax: 0, total: 0 });

    const bigInv = invoiceTotals([{ qty: 1, unitPrice: 10_000_000_000_000 }], Number.NaN, 1100);
    expect(bigInv.subtotal).toBe(10_000_000_000_000);
    expect(bigInv.tax).toBe(1_100_000_000_000);
    expect(bigInv.total).toBe(11_100_000_000_000);
  });
});

describe('VoicePlayer & UploadProgress', () => {
  it('VoicePlayer merender aksesibilitas putar/jeda dan memicu onToggle', async () => {
    const t = makeT('id');
    const onToggle = jest.fn();
    const { rerender } = await wrap(
      <VoicePlayer title="Catatan kopi" subtitle="Kopi susu 28rb" playing={false} onToggle={onToggle} progress={0.5} durationSec={60} />,
    );
    expect(screen.getByText('Catatan kopi')).toBeTruthy();
    expect(screen.getByText('Kopi susu 28rb')).toBeTruthy();
    expect(screen.getByText('0:30')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText(t('common.ui.play')));
    expect(onToggle).toHaveBeenCalledTimes(1);

    await rerender(
      <I18nProvider initialLang="id">
        <ThemeProvider initialMode="dark">
          <VoicePlayer title="Catatan kopi" playing onToggle={onToggle} progress={0.5} durationSec={60} />
        </ThemeProvider>
      </I18nProvider>,
    );
    expect(screen.getByLabelText(t('common.ui.pause'))).toBeTruthy();
  });

  it('UploadProgress menampilkan progress bar & berubah selesai di 100%', async () => {
    const t = makeT('id');
    const { rerender } = await wrap(<UploadProgress fileName="mutasi-bca.pdf" progress={0.45} />);
    expect(screen.getByText('mutasi-bca.pdf')).toBeTruthy();
    expect(screen.getByRole('progressbar').props.accessibilityLabel).toContain('mutasi-bca.pdf');

    await rerender(
      <I18nProvider initialLang="id">
        <ThemeProvider initialMode="dark">
          <UploadProgress fileName="mutasi-bca.pdf" progress={1} />
        </ThemeProvider>
      </I18nProvider>,
    );
    expect(screen.getByText(t('common.ui.uploaded'))).toBeTruthy();
  });
});

function ThemeProbe({ testID }: { testID: string }) {
  const { scheme, colors } = useTheme();
  return (
    <View testID={testID} accessibilityValue={{ text: `${scheme}:${colors.accent}` }}>
      <Text>{`${scheme}:${colors.accent}`}</Text>
    </View>
  );
}

describe('ForceDark & InkCard', () => {
  it('ForceDark menimpa preferensi light termasuk dari localStorage web', async () => {
    const origOS = Platform.OS;
    const origStorage = (globalThis as { localStorage?: Storage }).localStorage;
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: { getItem: (k: string) => (k === 'arshif.themeMode' ? 'light' : null), setItem: jest.fn(), removeItem: jest.fn() },
    });

    try {
      await wrap(
        <>
          <ThemeProbe testID="outer-probe" />
          <ForceDark>
            <ThemeProbe testID="force-dark-probe" />
          </ForceDark>
        </>,
        'dark',
      );
      expect(screen.getByTestId('outer-probe').props.accessibilityValue.text).toBe(`light:${buildPalette('light').accent}`);
      expect(screen.getByTestId('force-dark-probe').props.accessibilityValue.text).toBe(`dark:${buildPalette('dark').accent}`);
    } finally {
      Object.defineProperty(Platform, 'OS', { configurable: true, value: origOS });
      Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: origStorage });
    }
  });

  it('InkCard membalik scheme dan colors.accent untuk anak di tema gelap maupun terang', async () => {
    await wrap(
      <ThemeProvider initialMode="dark">
        <InkCard>
          <ThemeProbe testID="ink-in-dark" />
        </InkCard>
        <ThemeProvider initialMode="light">
          <InkCard>
            <ThemeProbe testID="ink-in-light" />
          </InkCard>
        </ThemeProvider>
      </ThemeProvider>,
    );
    expect(screen.getByTestId('ink-in-dark').props.accessibilityValue.text).toBe(`light:${buildPalette('light').accent}`);
    expect(screen.getByTestId('ink-in-light').props.accessibilityValue.text).toBe(`dark:${buildPalette('dark').accent}`);
  });
});

import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import AccountDetail from '@/app/akun/[id]';
import MyRates from '@/app/kurs-saya';
import { PaywallProvider } from '@/components/shell/Paywall';
import { ToastProvider } from '@/components/ui';
import type { Bill } from '@/data/planning';
import { sampleState } from '@/data/sample-state';
import type { Account, Transaction } from '@/data/types';
import { RecapTab } from '@/features/coach/RecapTab';
import { BillCalendar } from '@/features/planning/BillCalendar';
import { StepAccount } from '@/features/setup/StepAccount';
import { ReimbursementCard } from '@/features/transactions/ReimbursementCard';
import { I18nProvider } from '@/i18n';
import { AppStoreProvider, useStore } from '@/state/AppStore';
import type { AppState } from '@/state/reducer';
import { ThemeProvider } from '@/theme/ThemeProvider';

const mockPush = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), navigate: mockPush, replace: mockPush }),
  useLocalSearchParams: () => mockParams,
  router: { push: (...a: unknown[]) => mockPush(...a) },
}));

const base = sampleState();
let store: ReturnType<typeof useStore> | null = null;
function Probe() {
  store = useStore();
  return null;
}

function wrap(ui: ReactNode, state: Partial<AppState> = {}) {
  return render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <I18nProvider initialLang="id">
        <ThemeProvider initialMode="dark">
          <ToastProvider>
            <AppStoreProvider preset={{ ...base, ...state }}>
              <PaywallProvider>
                <Probe />
                {ui}
              </PaywallProvider>
            </AppStoreProvider>
          </ToastProvider>
        </ThemeProvider>
      </I18nProvider>
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  mockPush.mockClear();
  mockParams = {};
});

const cards: Account[] = [
  { id: 'c1', bank: 'bca', name: 'BCA Visa', type: 'kartu_kredit', currency: 'IDR', openingBalance: -4_000_000, creditLimit: 10_000_000, limitGroupId: 'g' },
  { id: 'c2', bank: 'bca', name: 'BCA Master', type: 'kartu_kredit', currency: 'IDR', openingBalance: -6_000_000, creditLimit: 15_000_000, limitGroupId: 'g' },
];

describe('Paylater di pemilih akun', () => {
  it('muncul sebagai jenis akun dan memunculkan isian limit', async () => {
    const onChange = jest.fn();
    await act(async () => {
      wrap(<StepAccount value={{ name: '', type: 'paylater', bank: 'cash', currency: 'IDR', opening: null, creditLimit: null }} mainCurrency="IDR" nameError={false} onChange={onChange} />);
    });
    expect(screen.getAllByText('Paylater').length).toBeGreaterThan(0);
    expect(screen.getByText('Limit')).toBeTruthy();
    expect(screen.getByText('Tagihan berjalan')).toBeTruthy();
  });
});

describe('detail akun', () => {
  it('kartu di grup menampilkan utilisasi grup (gabungan ÷ limit gabungan)', async () => {
    mockParams = { id: 'c1' };
    await act(async () => {
      wrap(<AccountDetail />, { accounts: [...base.accounts, ...cards], limitGroups: [{ id: 'g', name: 'BCA gabungan', currency: 'IDR', sharedLimit: 20_000_000 }] });
    });
    expect(screen.getAllByText('50% limit gabungan BCA gabungan terpakai').length).toBeGreaterThan(0);
    expect(screen.getByText('Rp 10.000.000 terpakai dari Rp 20.000.000')).toBeTruthy();
  });

  it('iuran tahunan: tandai dibayar masuk riwayat', async () => {
    mockParams = { id: 'c1' };
    const withFee = { ...cards[0]!, limitGroupId: undefined, annualFee: { amount: 300_000, month: 1, day: 15, waiverThreshold: 20_000_000, paid: [] } };
    await act(async () => {
      wrap(<AccountDetail />, { accounts: [withFee] });
    });
    expect(screen.getByText('Belum dibayar')).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByText('Tandai dibayar')));
    expect(store!.state.accounts[0]!.annualFee!.paid).toHaveLength(1);
    expect(screen.getByText('Dibayar')).toBeTruthy();
  });

  it('akun tidak ditemukan: empty state', async () => {
    mockParams = { id: 'tidak-ada' };
    await act(async () => {
      wrap(<AccountDetail />);
    });
    expect(screen.getByText('Akun tidak ditemukan')).toBeTruthy();
  });
});

describe('Kurs saya', () => {
  it('mata uang tanpa kurs harian diminta diisi; simpan kurs = tidak hilang lagi', async () => {
    const sar: Transaction = { id: 'x', type: 'expense', merchant: 'Toko', categoryKey: 'food', accountId: 'a-bca', date: '2026-11-01', time: '10:00', amount: 1000, currency: 'SAR', source: 'manual' };
    await act(async () => {
      wrap(<MyRates />, { transactions: [sar, ...base.transactions] });
    });
    expect(screen.getByText('Perlu diisi')).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByText('SAR · Riyal Saudi')));
    await act(async () => fireEvent.changeText(screen.getByLabelText('1 SAR = berapa IDR?'), '4350'));
    await act(async () => fireEvent.press(screen.getByText('Simpan')));
    expect(store!.state.userRates).toEqual([{ code: 'SAR', base: 'IDR', rate: '4350' }]);
    expect(screen.queryByText('Perlu diisi')).toBeNull();
  });
});

describe('kalender tagihan', () => {
  const bill = (o: Partial<Bill>): Bill => ({ id: 'b', name: 'Listrik', amount: 150_000, currency: 'IDR', frequency: 'monthly', dueDate: '2026-11-20', anchorDay: 20, categoryKey: 'utilities', paidPeriods: [], ...o });

  it('tagihan muncul di tanggal jatuhnya; filter Belum lunas', async () => {
    const bills = [bill({}), bill({ id: 'p', name: 'Internet', dueDate: '2026-12-10', anchorDay: 10, paidPeriods: ['2026-11-10'] })];
    await act(async () => {
      wrap(<BillCalendar bills={bills} today="2026-11-05" filter="unpaid" onPressBill={jest.fn()} />);
    });
    expect(screen.getByLabelText(/20 Nov.*Listrik/)).toBeTruthy();
    expect(screen.queryByLabelText(/10 Nov.*Internet/)).toBeNull();
  });

  it('filter Lunas: hanya periode yang lunas', async () => {
    const bills = [bill({}), bill({ id: 'p', name: 'Internet', dueDate: '2026-12-10', anchorDay: 10, paidPeriods: ['2026-11-10'] })];
    await act(async () => {
      wrap(<BillCalendar bills={bills} today="2026-11-05" filter="paid" onPressBill={jest.fn()} />);
    });
    expect(screen.getByLabelText(/10 Nov.*Internet/)).toBeTruthy();
    expect(screen.queryByLabelText(/20 Nov.*Listrik/)).toBeNull();
  });
});

describe('Weekly Replay', () => {
  it('empty state bila minggu ini belum ada data', async () => {
    await act(async () => {
      wrap(<RecapTab transactions={[]} currency="IDR" />);
    });
    expect(screen.getByText('Minggu ini masih kosong')).toBeTruthy();
  });
});

describe('reimbursement', () => {
  it('tandai pengeluaran sebagai reimbursement: status pending', async () => {
    const e = base.transactions.find((t) => t.type === 'expense')!;
    await act(async () => {
      wrap(<ReimbursementCard tx={e} />);
    });
    await act(async () => fireEvent.press(screen.getByLabelText('Diganti teman (reimbursement)')));
    expect(store!.state.transactions.find((t) => t.id === e.id)!.reimburseStatus).toBe('pending');
  });
});

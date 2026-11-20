import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import AccountDetail from '@/app/akun/[id]';
import { PaywallProvider } from '@/components/shell/Paywall';
import { BankCard, ToastProvider } from '@/components/ui';
import { CARD_PRODUCTS } from '@/data/cardProducts';
import { toAccount } from '@/data/remote/mappers';
import { sampleState } from '@/data/sample-state';
import type { Account } from '@/data/types';
import { AccountDeck } from '@/features/home/AccountDeck';
import { AddAccountSheet } from '@/features/settings/AddAccountSheet';
import { I18nProvider } from '@/i18n';
import { formatMoney } from '@/lib/money';
import { AppStoreProvider, useStore } from '@/state/AppStore';
import { AssetsProvider } from '@/state/assets';
import { PlanningProvider } from '@/state/planning';
import { reducer, type AppState } from '@/state/reducer';
import { ThemeProvider } from '@/theme/ThemeProvider';

const mockInsertAccount = jest.fn();
jest.mock('@/data/remote/api', () => ({
  ...jest.requireActual('@/data/remote/api'),
  insertAccount: (...a: unknown[]) => mockInsertAccount(...a),
}));
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), navigate: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => mockParams,
  router: { push: jest.fn() },
}));

const base = sampleState();
const batman = CARD_PRODUCTS.find((p) => p.id === 'bca-credit-visa-batman')!;
const acc: Account = { id: 'acc-1', bank: 'bca', name: 'BCA Utama', type: 'tabungan', currency: 'IDR', openingBalance: 1_250_000, last4: '1234' };

/** Menampilkan cardStyle akun dari store, untuk memastikan pilihan benar-benar masuk state aplikasi. */
function StyleProbe({ id }: { id: string }) {
  const { state } = useStore();
  return <Text>{`style:${state.accounts.find((a) => a.id === id)?.cardStyle ?? 'none'}`}</Text>;
}

async function wrap(ui: ReactNode, state: Partial<AppState> = {}) {
  await act(async () => {
    await render(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
        <I18nProvider initialLang="id">
          <ThemeProvider initialMode="dark">
            <ToastProvider>
              <AppStoreProvider preset={{ ...base, ...state }}>
                <PlanningProvider preset={{ goals: [], deposits: [], bills: [], debts: [], payments: [], subscriptions: [], splits: [] }}>
                  <AssetsProvider preset={{ assets: [], prices: {}, snapshots: [] }}>
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
const layoutGrid = async () => {
  await act(async () => {
    fireEvent(screen.getByTestId('card-grid'), 'layout', { nativeEvent: { layout: { width: 358, height: 100, x: 0, y: 0 } } });
  });
};

describe('penyimpanan tampilan kartu', () => {
  it('kolom card_style dibaca ke akun; kosong = desain bawaan', () => {
    const row = { id: 'a', bank: 'bca', name: 'BCA', type: 'tabungan' as const, currency: 'IDR', opening_balance: 0, balance: 0, last4: null };
    expect(toAccount({ ...row, card_style: 'bca-credit-visa-batman' }).cardStyle).toBe('bca-credit-visa-batman');
    expect(toAccount(row).cardStyle).toBeUndefined();
  });
  it('reducer menyimpan dan menghapus pilihan per akun tanpa menyentuh bank/nama/saldo', () => {
    const s0 = { ...base, accounts: [acc] };
    const s1 = reducer(s0, { type: 'account/setCardStyle', id: 'acc-1', cardStyle: batman.id });
    expect(s1.accounts[0]).toEqual({ ...acc, cardStyle: batman.id });
    expect(reducer(s1, { type: 'account/setCardStyle', id: 'acc-1', cardStyle: null }).accounts[0].cardStyle).toBeUndefined();
  });
});

describe('artwork di kartu akun', () => {
  it('tampilan dipilih: artwork + isi kartu tetap (jenis, 4 digit, saldo)', async () => {
    await wrap(<BankCard bank="bca" accountType="Tabungan" last4="1234" balance={1_250_000} currency="IDR" cardStyle={batman.id} />);
    expect(screen.getByText('Visa Batman')).toBeTruthy();
    expect(screen.getByText('Tabungan · •••• 1234')).toBeTruthy();
    expect(screen.getByText(formatMoney(1_250_000, 'IDR'))).toBeTruthy();
  });
  it('belum memilih atau id tidak dikenal: desain bawaan bank seperti sebelumnya (tidak kosong, tidak error)', async () => {
    await wrap(<BankCard bank="bca" accountType="Tabungan" balance={1000} currency="IDR" cardStyle="produk-sudah-dihapus" />);
    expect(screen.getByText('BCA')).toBeTruthy();
    expect(screen.queryByText('Visa Batman')).toBeNull();
  });
  it('deck Beranda memakai artwork pilihan tiap akun; akun tanpa pilihan tetap desain bawaan', async () => {
    const other: Account = { ...acc, id: 'acc-2', bank: 'mandiri', name: 'Mandiri', last4: '9999' };
    await wrap(<AccountDeck accounts={[{ ...acc, cardStyle: batman.id, balance: 1_250_000 }, { ...other, balance: 500 }]} hidden={false} limitReached={false} activeId="acc-1" onActiveChange={jest.fn()} />);
    // Deck tertutup secara default (strip); buka seperti pengguna, lalu kartu terlihat.
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { expanded: false }));
    });
    expect(screen.getAllByText('Visa Batman').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Mandiri').length).toBeGreaterThan(0);
  });
});

describe('jalan masuk dari dalam aplikasi', () => {
  it('detail akun: baris Tampilan kartu membuka picker, centang menyimpan ke akun; bisa kembali ke desain bawaan', async () => {
    mockParams = { id: 'acc-1' };
    await wrap(
      <>
        <AccountDetail />
        <StyleProbe id="acc-1" />
      </>,
      { accounts: [acc] },
    );
    expect(screen.getByText('Desain bawaan bank')).toBeTruthy();
    await press('Tampilan kartu');
    await layoutGrid();
    await press('Visa Batman, BCA');
    await press('Terapkan tampilan kartu');
    expect(screen.getByText(`style:${batman.id}`)).toBeTruthy();
    expect(screen.getAllByText('Visa Batman').length).toBeGreaterThan(0);
    await press('Pakai desain bawaan bank');
    expect(screen.getByText('style:none')).toBeTruthy();
  });

  it('detail akun: X di picker menutup tanpa perubahan', async () => {
    mockParams = { id: 'acc-1' };
    await wrap(
      <>
        <AccountDetail />
        <StyleProbe id="acc-1" />
      </>,
      { accounts: [acc] },
    );
    await press('Tampilan kartu');
    await layoutGrid();
    await press('Visa Batman, BCA');
    await press('Tutup tanpa mengubah');
    expect(screen.getByText('style:none')).toBeTruthy();
  });

  it('tambah akun: tampilan kartu dipilih di form ikut tersimpan saat akun dibuat', async () => {
    mockInsertAccount.mockImplementation(async (a: Omit<Account, 'id'>) => ({ ...a, id: 'new-1' }));
    await wrap(<AddAccountSheet visible onClose={jest.fn()} />);
    await act(async () => {
      fireEvent.changeText(screen.getByLabelText('Nama akun'), 'Kartu Batman');
    });
    await press('Tampilan kartu');
    await layoutGrid();
    await press('Visa Batman, BCA');
    await press('Terapkan tampilan kartu');
    expect(screen.getByText('Visa Batman')).toBeTruthy();
    await press('Tambah akun');
    expect(mockInsertAccount).toHaveBeenCalledWith(expect.objectContaining({ name: 'Kartu Batman', cardStyle: batman.id }));
  });
});

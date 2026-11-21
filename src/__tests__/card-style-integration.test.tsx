import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import AccountDetail from '@/app/akun/[id]';
import { PaywallProvider } from '@/components/shell/Paywall';
import { BankCard, ToastProvider } from '@/components/ui';
import { toAccount } from '@/data/remote/mappers';
import { sampleState } from '@/data/sample-state';
import type { Account } from '@/data/types';
import { AccountDeck } from '@/features/home/AccountDeck';
import { AddAccountSheet } from '@/features/settings/AddAccountSheet';
import { I18nProvider } from '@/i18n';
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
const acc: Account = { id: 'acc-1', bank: 'bca', name: 'BCA Utama', type: 'tabungan', currency: 'IDR', openingBalance: 1_250_000, last4: '1234' };

/** Menampilkan cardStyle akun dari store, untuk memastikan pilihan benar-benar masuk state aplikasi. */
function StyleProbe({ id }: { id: string }) {
  const { state } = useStore();
  return <Text>{`style:${state.accounts.find((a) => a.id === id)?.cardStyle ?? 'none'} holder:${state.accounts.find((a) => a.id === id)?.holder ?? 'none'} last4:${state.accounts.find((a) => a.id === id)?.last4 ?? 'none'}`}</Text>;
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
    fireEvent(screen.getByTestId('pattern-grid'), 'layout', { nativeEvent: { layout: { width: 350, height: 100, x: 0, y: 0 } } });
  });
};

describe('penyimpanan wajah kartu', () => {
  it('kolom card_style, card_holder, card_expiry dibaca ke akun; kosong = tidak ditampilkan', () => {
    const row = { id: 'a', bank: 'bca', name: 'BCA', type: 'tabungan' as const, currency: 'IDR', opening_balance: 0, balance: 0, last4: null };
    expect(toAccount({ ...row, card_style: 'waves', card_holder: 'MAYA', card_expiry: '09/29' })).toMatchObject({ cardStyle: 'waves', holder: 'MAYA', expiry: '09/29' });
    expect(toAccount(row)).toMatchObject({ cardStyle: undefined, holder: undefined, expiry: undefined, last4: undefined });
  });
  it('reducer: sakelar detail kartu menyimpan/menghapus hanya kunci yang dikirim', () => {
    const s0 = { ...base, accounts: [{ ...acc, holder: 'MAYA' }] };
    const s1 = reducer(s0, { type: 'account/setCardDetails', id: 'acc-1', patch: { expiry: '09/29' } });
    expect(s1.accounts[0]).toMatchObject({ holder: 'MAYA', expiry: '09/29', last4: '1234', name: 'BCA Utama' });
    const s2 = reducer(s1, { type: 'account/setCardDetails', id: 'acc-1', patch: { holder: null, last4: null } });
    expect(s2.accounts[0]!.holder).toBeUndefined();
    expect(s2.accounts[0]!.last4).toBeUndefined();
    expect(s2.accounts[0]!.expiry).toBe('09/29');
  });
});

describe('wajah kartu gaya dompet', () => {
  it('kartu bank: nama bank, jenis · mata uang, saldo, nomor tersamar; nama & masa berlaku hanya bila diisi', async () => {
    await wrap(<BankCard bank="bca" accountType="Tabungan" type="tabungan" last4="4821" balance={1_250_000} currency="IDR" />);
    expect(screen.getByText('Tabungan · IDR')).toBeTruthy();
    expect(screen.getByText('•••• •••• •••• 4821')).toBeTruthy();
    expect(screen.queryByText('09/29')).toBeNull();
  });
  it('detail lengkap tampil; tunai menulis "Uang di dompet" tanpa nomor', async () => {
    await wrap(
      <>
        <BankCard bank="bca" accountType="Kartu Kredit" type="kartu_kredit" last4="0937" holder="MAYA LESTARI" expiry="08/28" balance={-50_000} currency="IDR" />
        <BankCard bank="cash" accountType="Tunai" type="cash" last4="1111" balance={50_000} currency="IDR" />
      </>,
    );
    expect(screen.getByText('MAYA LESTARI')).toBeTruthy();
    expect(screen.getByText('08/28')).toBeTruthy();
    expect(screen.getByText('Uang di dompet')).toBeTruthy();
    expect(screen.queryByText(/1111/)).toBeNull();
  });
});

describe('jalan masuk dari dalam aplikasi', () => {
  it('detail akun: pilih motif kartu tersimpan ke akun', async () => {
    mockParams = { id: 'acc-1' };
    await wrap(
      <>
        <AccountDetail />
        <StyleProbe id="acc-1" />
      </>,
      { accounts: [acc] },
    );
    // Belum memilih: motif bawaan tabungan = Lingkar.
    expect(screen.getByText('Lingkar')).toBeTruthy();
    await press('Motif kartu');
    await layoutGrid();
    await press('Gelombang');
    expect(screen.getByText(/style:waves/)).toBeTruthy();
  });

  it('detail akun: sakelar nama pemegang -> isi -> tampil; matikan sakelar nomor -> nomor hilang', async () => {
    mockParams = { id: 'acc-1' };
    await wrap(
      <>
        <AccountDetail />
        <StyleProbe id="acc-1" />
      </>,
      { accounts: [acc] },
    );
    await act(async () => fireEvent(screen.getByLabelText('Tampilkan Nama pemegang di kartu'), 'press'));
    const input = screen.getByLabelText('Nama seperti di kartu');
    await act(async () => fireEvent.press(screen.getByText('Simpan')));
    expect(screen.getByText('Isi nama, maksimal 40 karakter')).toBeTruthy();
    await act(async () => fireEvent.changeText(input, ' maya  lestari '));
    await act(async () => fireEvent.press(screen.getByText('Simpan')));
    expect(screen.getByText(/holder:MAYA LESTARI/)).toBeTruthy();
    await act(async () => fireEvent(screen.getByLabelText('Tampilkan Nomor kartu di kartu'), 'press'));
    expect(screen.getByText(/last4:none/)).toBeTruthy();
  });

  it('tambah akun: motif dipilih di form ikut tersimpan saat akun dibuat', async () => {
    mockInsertAccount.mockImplementation(async (a: Omit<Account, 'id'>) => ({ ...a, id: 'new-1' }));
    await wrap(<AddAccountSheet visible onClose={jest.fn()} />);
    await act(async () => {
      fireEvent.changeText(screen.getByLabelText('Nama akun'), 'Kartu Harian');
    });
    await press('Motif kartu');
    await layoutGrid();
    await press('Titik');
    await press('Tambah akun');
    expect(mockInsertAccount).toHaveBeenCalledWith(expect.objectContaining({ name: 'Kartu Harian', cardStyle: 'grid' }));
  });
});

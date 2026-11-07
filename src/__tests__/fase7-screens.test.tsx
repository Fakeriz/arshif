import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import AccountDetail from '@/app/akun/[id]';
import MyRates from '@/app/kurs-saya';
import TransaksiScreen from '@/app/(tabs)/transaksi';
import { CaptureSheet } from '@/components/shell/CaptureSheet';
import { CurrencySheet } from '@/components/shell/CurrencySheet';
import { moreOptions } from '@/components/shell/captureOptions';
import { AskTab } from '@/features/coach/AskTab';
import { PaywallProvider } from '@/components/shell/Paywall';
import { ToastProvider } from '@/components/ui';
import type { Bill } from '@/data/planning';
import { sampleState } from '@/data/sample-state';
import type { Account, Transaction } from '@/data/types';
import { RecapTab } from '@/features/coach/RecapTab';
import { BillCalendar } from '@/features/planning/BillCalendar';
import { StepAccount } from '@/features/setup/StepAccount';
import { ReimbursementCard } from '@/features/transactions/ReimbursementCard';
import { I18nProvider, useT as useI18nT } from '@/i18n';
import { AppStoreProvider, useStore } from '@/state/AppStore';
import { SmartLogProvider } from '@/state/smartlog';
import type { AppState } from '@/state/reducer';
import type { Asset } from '@/data/assets';
import { computeNetWorth } from '@/lib/assets';
import { toMajor } from '@/lib/coachAsk';
import { accountBalance } from '@/lib/transactions';
import { AssetsProvider } from '@/state/assets';
import { PlanningProvider } from '@/state/planning';
import { ThemeProvider } from '@/theme/ThemeProvider';

const mockPush = jest.fn();
const mockInvoke = jest.fn();
jest.mock('@/data/remote/functions', () => ({
  ...jest.requireActual('@/data/remote/functions'),
  invokeFn: (...a: unknown[]) => mockInvoke(...a),
}));
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

function wrap(ui: ReactNode, state: Partial<AppState> = {}, assets: Asset[] = []) {
  return render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <I18nProvider initialLang="id">
        <ThemeProvider initialMode="dark">
          <ToastProvider>
            <AppStoreProvider preset={{ ...base, ...state }}>
              <PlanningProvider preset={{ goals: [], deposits: [], bills: [], debts: [], payments: [], subscriptions: [], splits: [] }}>
                <AssetsProvider preset={{ assets, prices: {}, snapshots: [] }}>
                  <PaywallProvider>
                    <Probe />
                    {ui}
                  </PaywallProvider>
                </AssetsProvider>
              </PlanningProvider>
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

describe('perbaikan uji HP', () => {
  it('pemilih mata uang: semua mata uang ada di dalam ScrollView (bisa digulir sampai bawah)', async () => {
    await act(async () => {
      wrap(<CurrencySheet visible value="IDR" onSelect={jest.fn()} onClose={jest.fn()} />);
    });
    const last = screen.getByText('VND · Dong Vietnam');
    let node: { type?: unknown; parent: unknown } | null = last as unknown as { parent: unknown };
    let inScroll = false;
    while (node) {
      if ((node as { type?: unknown }).type === 'RCTScrollView') inScroll = true;
      node = (node as { parent: typeof node }).parent;
    }
    expect(inScroll).toBe(true);
  });

  it('Free: Tanya Coach terkunci, tombol membuka Premium', async () => {
    await act(async () => {
      wrap(<AskTab />, { plan: 'free' });
    });
    expect(screen.getByText('Tanya Coach khusus Premium')).toBeTruthy();
    expect(screen.queryByLabelText('Kirim pertanyaan')).toBeNull();
  });

  it('Premium: kirim pertanyaan -> jawaban Coach; hanya ringkasan angka yang dikirim', async () => {
    let resolve: (v: unknown) => void = () => undefined;
    mockInvoke.mockReturnValueOnce(new Promise((r) => (resolve = r)));
    // Rumah Rp900 juta: kekayaan bersih untuk Coach harus sama dengan Beranda (termasuk aset), bukan hanya rekening.
    const house: Asset = { id: 'rumah', type: 'property', name: 'Rumah', currency: 'IDR', valueOverride: 900_000_000, createdAt: new Date().toISOString() };
    await act(async () => {
      wrap(<AskTab />, { plan: 'premium' }, [house]);
    });
    expect(screen.getByText('Sisa 20 pertanyaan hari ini')).toBeTruthy();
    await act(async () => fireEvent.changeText(screen.getByLabelText('Pertanyaanmu'), 'Kategori mana yang paling boros?'));
    await act(async () => fireEvent.press(screen.getByLabelText('Kirim pertanyaan')));
    // Selama menunggu: skeleton berbentuk kartu jawaban.
    expect(screen.getByLabelText('Coach sedang menjawab')).toBeTruthy();
    await act(async () => resolve({ answer: 'Makan & Minum paling besar periode ini.', points: ['Rp1.650.000, lewat batas Rp1.500.000.'], tip: 'Batasi makan di luar Rp100.000 per hari.' }));
    expect(screen.queryByLabelText('Coach sedang menjawab')).toBeNull();
    expect(screen.getByText('Makan & Minum paling besar periode ini.')).toBeTruthy();
    expect(screen.getByText('Rp1.650.000, lewat batas Rp1.500.000.')).toBeTruthy();
    expect(screen.getByText('Langkah berikutnya')).toBeTruthy();
    expect(screen.getByText('Batasi makan di luar Rp100.000 per hari.')).toBeTruthy();
    const [name, body] = mockInvoke.mock.calls[0]!;
    expect(name).toBe('coach-ask');
    expect(body).toMatchObject({ lang: 'id', question: 'Kategori mana yang paling boros?', history: [] });
    const home = computeNetWorth({
      accounts: base.accounts.map((a) => ({ ...a, balance: accountBalance(a, base.transactions) })),
      assets: [house], prices: {}, debts: [], main: base.mainCurrency, now: Date.now(),
    }).total;
    expect((body as { context: { netWorth: number } }).context.netWorth).toBe(toMajor(home, base.mainCurrency));
    const sent = JSON.stringify(body);
    for (const merchant of base.transactions.map((x) => x.merchant).filter((m) => m.length > 3)) expect(sent).not.toContain(merchant);
  });

  it('Premium: kuota 20/hari habis -> input dimatikan dengan pesan', async () => {
    await act(async () => {
      wrap(<AskTab />, { plan: 'premium', usage: { ...base.usage, coachAsk: 20 } });
    });
    expect(screen.getByText('Batas 20 pertanyaan hari ini tercapai. Coba lagi besok.')).toBeTruthy();
  });

  const octTx: Transaction[] = [{ id: 'm', type: 'expense', merchant: 'Toko', categoryKey: 'food', accountId: 'a-bca', date: '2026-10-10', time: '10:00', amount: 50_000, currency: 'IDR', source: 'manual' }];
  const atNov5 = () => jest.useFakeTimers({ now: new Date('2026-11-05T10:00:00'), doNotFake: ['setTimeout', 'setInterval', 'nextTick', 'setImmediate', 'queueMicrotask', 'requestAnimationFrame'] });

  it('Free: tab Bulan lalu menampilkan ajakan Premium', async () => {
    atNov5();
    try {
      await act(async () => {
        wrap(<RecapTab transactions={octTx} currency="IDR" />, { plan: 'free' });
      });
      await act(async () => fireEvent.press(screen.getByText('Bulan lalu')));
      expect(screen.getByText('Recap bulanan')).toBeTruthy();
    } finally {
      jest.useRealTimers();
    }
  });

  it('Premium: tab Bulan lalu menampilkan recap bulanan', async () => {
    atNov5();
    try {
      await act(async () => {
        wrap(<RecapTab transactions={octTx} currency="IDR" />, { plan: 'premium' });
      });
      await act(async () => fireEvent.press(screen.getByText('Bulan lalu')));
      expect(screen.getByText('Belanjamu bulan lalu')).toBeTruthy();
      expect(screen.queryByText('Recap bulanan')).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  it('Lainnya: seksi Catat dan Bisnis & alat dengan item yang sama seperti sebelumnya', async () => {
    await act(async () => {
      wrap(<MoreSheet />);
    });
    for (const title of ['Catat', 'Bisnis & alat']) expect(screen.getByText(title)).toBeTruthy();
    for (const item of ['Scan Dokumen', 'Import Rekening Koran', 'Catat Manual', 'Invoice & Penawaran', 'Alat']) expect(screen.getByText(item)).toBeTruthy();
  });

  it('daftar transaksi dirender bertahap (60 baris dulu)', async () => {
    const many: Transaction[] = Array.from({ length: 150 }, (_, i) => ({
      id: `t${i}`, type: 'expense', merchant: `Toko ${i}`, categoryKey: 'food', accountId: 'a-bca', date: `2026-10-${String((i % 28) + 1).padStart(2, '0')}`, time: '10:00', amount: 1000, currency: 'IDR', source: 'manual',
    }));
    await act(async () => {
      wrap(
        <SmartLogProvider>
          <TransaksiScreen />
        </SmartLogProvider>,
        { transactions: many },
      );
    });
    expect(screen.getAllByText(/^Toko \d+$/)).toHaveLength(60);
  });
});

/** Sheet Lainnya dengan seksi yang sama seperti Home. */
function MoreSheet() {
  const limits = { scan: false, automation: false, importPdf: false, invoice: false, accounts: false, goals: false, billsDebts: false, subscriptions: false, assets: false, scanLeft: 20, importLeft: 3 };
  const t = useI18nT();
  const items = moreOptions(limits, t);
  return (
    <CaptureSheet
      visible
      onClose={jest.fn()}
      sections={[
        { key: 'log', title: t('home.more.sectionLog'), keys: ['docscan', 'pdf', 'manual'] },
        { key: 'business', title: t('home.more.sectionBusiness'), extras: items },
      ]}
    />
  );
}

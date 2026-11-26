import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import AnggaranScreen from '@/app/(tabs)/anggaran';
import PdfExport from '@/app/alat/ekspor';
import Converter from '@/app/alat/kurs';
import AnnualTaxReport from '@/app/alat/laporan';
import AutomationScreen from '@/app/otomasi/index';
import ReviewScreen from '@/app/otomasi/tinjau';
import BillsScreen from '@/app/rencana/tagihan';
import { PaywallProvider } from '@/components/shell/Paywall';
import { ToastProvider } from '@/components/ui';
import type { Bill, Subscription } from '@/data/planning';
import type { SmartLogItem } from '@/data/remote/smartlog';
import { sampleState } from '@/data/sample-state';
import type { Account, Transaction } from '@/data/types';
import { BillCalendar } from '@/features/planning/BillCalendar';
import { ImportReview } from '@/features/capture/ImportReview';
import { fiscalBundleDocument, invoiceFiscalSummary } from '@/features/tools/documents';
import { TransactionDetail } from '@/features/transactions/TransactionDetail';
import { I18nProvider, makeT } from '@/i18n';
import { todayYmd } from '@/lib/dates';
import { BACKUP_TABLES } from '@/lib/backup/data';
import { txFxBasis, summarizeFxBasis } from '@/lib/fxBasis';
import type { Invoice } from '@/lib/invoice';
import { loanSchedule } from '@/lib/loan';
import { computePaydayProjection } from '@/lib/planning/paydayCycle';
import { matchSmartLogRule, type SmartLogRule } from '@/lib/smartlog/rules';
import { reconcileStatement } from '@/lib/statement';
import { annualReport } from '@/lib/tax';
import { AppStoreProvider } from '@/state/AppStore';
import { InvoicesProvider } from '@/state/invoices';
import { PlanningProvider } from '@/state/planning';
import type { AppState } from '@/state/reducer';
import { draftFromItem, SmartLogContext, type SmartLogValue } from '@/state/smartlog';
import { ThemeProvider } from '@/theme/ThemeProvider';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), navigate: mockPush, replace: mockPush }),
  useLocalSearchParams: () => ({}),
  router: { push: (...a: unknown[]) => mockPush(...a) },
}));
jest.mock('@/data/remote/invoices', () => ({
  ...jest.requireActual('@/data/remote/invoices'),
  featureGate: jest.fn(async () => undefined),
}));

const base = sampleState();
const accIdr = base.accounts.find((a) => a.currency === 'IDR')!;
const accMyr = base.accounts.find((a) => a.currency === 'MYR')!;

function wrap(
  ui: ReactNode,
  opts: {
    state?: Partial<AppState>;
    invoices?: Invoice[];
    bills?: Bill[];
    subscriptions?: Subscription[];
    smartlog?: SmartLogValue;
    withPlanning?: boolean;
  } = {},
) {
  let content = ui;
  if (opts.smartlog) {
    content = <SmartLogContext.Provider value={opts.smartlog}>{content}</SmartLogContext.Provider>;
  }
  if (opts.withPlanning !== false) {
    content = (
      <PlanningProvider
        preset={{
          goals: [],
          deposits: [],
          bills: opts.bills ?? [],
          debts: [],
          payments: [],
          subscriptions: opts.subscriptions ?? [],
          splits: [],
        }}
      >
        {content}
      </PlanningProvider>
    );
  }
  return render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <I18nProvider initialLang="id">
        <ThemeProvider initialMode="dark">
          <ToastProvider>
            <AppStoreProvider preset={{ ...base, ...opts.state }}>
              <PaywallProvider>
                <InvoicesProvider preset={opts.invoices ?? []}>{content}</InvoicesProvider>
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
});

describe('perbaikan sisa: loanSchedule annuity clamp', () => {
  it('memakai safeApr pada anuitas dan menahan NaN atau aprBp ekstrem', () => {
    const clamped = loanSchedule(10_000_000, 99_999_999, 12, 'annuity');
    const maxAllowed = loanSchedule(10_000_000, 100_000, 12, 'annuity');
    expect(clamped).toEqual(maxAllowed);
    expect(Number.isSafeInteger(clamped.totalPaid)).toBe(true);
    expect(loanSchedule(10_000_000, Number.NaN, 12, 'annuity').totalInterest).toBe(0);
  });
});

describe('Fitur 1: pelacakan kurs cost-basis & remitansi', () => {
  const remitTx: Transaction = {
    id: 'remit-1',
    type: 'transfer',
    merchant: 'Remitansi KL',
    categoryKey: 'savings',
    accountId: accIdr.id,
    toAccountId: accMyr.id,
    date: '2026-11-05',
    time: '10:00',
    amount: 1_625_000,
    currency: 'IDR',
    // Kurs contoh: 1 USD = 16250 IDR & 4.28 MYR => 1.625.000 IDR = 428.00 MYR (42800 sen).
    // Pengguna mendapat 450.00 MYR -> untung kurs +22.00 MYR.
    toAmount: 45_000,
    source: 'manual',
  };

  it('menghitung kurs efektif & selisih FX untuk remitansi dan transaksi lintas mata uang', () => {
    const basis = txFxBasis(remitTx, accIdr, accMyr)!;
    expect(basis.kind).toBe('remittance');
    expect(basis.liveToAmount).toBe(42_800);
    expect(basis.fxDeltaTo).toBe(2_200);

    const summary = summarizeFxBasis([remitTx], base.accounts, 'IDR');
    expect(summary.totalCount).toBe(1);
    expect(summary.remittanceCount).toBe(1);
    expect(summary.netDeltaMain).toBeGreaterThan(0);
  });

  it('menampilkan detail remitansi di TransactionDetail dan ringkasan di Konverter (/alat/kurs)', async () => {
    await wrap(<TransactionDetail id="remit-1" onDeleted={jest.fn()} />, {
      state: { transactions: [remitTx, ...base.transactions] },
    });
    expect(screen.getByText('Selisih kurs vs hari ini')).toBeTruthy();
    expect(screen.getByText('+RM 22.00')).toBeTruthy();

    await wrap(<Converter />, { state: { transactions: [remitTx] } });
    expect(screen.getByText('Kurs efektif & remitansi')).toBeTruthy();
    expect(screen.getByText(/1 transaksi lintas mata uang · 1 remitansi/)).toBeTruthy();
  });
});

describe('Fitur 2: aturan Smart Log untuk merchant & transfer dompet sendiri', () => {
  const rules: SmartLogRule[] = [
    { id: 'r1', pattern: 'kopi', action: 'categorize', categoryKey: 'food', toAccountId: null },
    { id: 'r2', pattern: 'kopi kenangan', action: 'categorize', categoryKey: 'hangout', toAccountId: null },
    { id: 'r3', pattern: 'gopay', action: 'transfer', categoryKey: 'savings', toAccountId: accMyr.id },
  ];

  const reviewItem: SmartLogItem = {
    id: 'item-topup',
    pkg: 'com.bca',
    bank: 'bca',
    date: '2026-11-05',
    time: '12:00',
    type: 'expense',
    amount: 100_000,
    currency: 'IDR',
    merchant: 'GOPAY TOPUP',
    accountId: accIdr.id,
    status: 'review',
    reasons: ['topup'],
    excerpt: 'Top up GoPay Rp 100.000',
    createdAt: '2026-11-05T05:00:00Z',
  };

  it('mencocokkan pola terpanjang lebih dulu & mengubah draft topup menjadi transfer', () => {
    expect(BACKUP_TABLES).toContain('smartlog_rules');
    expect(BACKUP_TABLES.indexOf('accounts')).toBeLessThan(BACKUP_TABLES.indexOf('smartlog_rules'));
    expect(matchSmartLogRule(rules, 'KOPI KENANGAN KEMANG')?.categoryKey).toBe('hangout');
    const draft = draftFromItem(reviewItem, rules);
    expect(draft.type).toBe('transfer');
    expect(draft.toAccountId).toBe(accMyr.id);
    expect(draft.categoryKey).toBe('savings');
  });

  it('mengelola aturan di AutomationScreen & membuka preset rule dari ReviewScreen', async () => {
    const saveRule = jest.fn(async () => undefined);
    const removeRule = jest.fn(async () => undefined);
    const slog: SmartLogValue = {
      supported: true,
      status: 'ready',
      enabled: true,
      permission: true,
      links: [],
      rules: [rules[0]!],
      review: [reviewItem],
      recent: [],
      held: 0,
      reload: jest.fn(async () => undefined),
      setEnabled: jest.fn(async () => undefined),
      openPermission: jest.fn(),
      setLink: jest.fn(async () => undefined),
      saveRule,
      removeRule,
      processNow: jest.fn(async () => undefined),
      confirm: jest.fn(async () => undefined),
      dismiss: jest.fn(async () => undefined),
      undo: jest.fn(async () => undefined),
    };

    await wrap(<AutomationScreen />, { smartlog: slog });
    expect(screen.getByText('Aturan otomatis')).toBeTruthy();
    expect(screen.getByText('kopi')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Tambah aturan'));
    await fireEvent.changeText(await screen.findByLabelText('Kata kunci merchant / notifikasi'), 'GOPAY');
    await fireEvent.press(screen.getByText('Transfer akun sendiri'));
    await act(async () => fireEvent.press(screen.getByLabelText('Simpan aturan')));
    expect(saveRule).toHaveBeenCalledWith(expect.objectContaining({ pattern: 'GOPAY', action: 'transfer', categoryKey: 'savings' }));

    await fireEvent.press(screen.getByLabelText('Hapus aturan kopi'));
    expect(removeRule).toHaveBeenCalledWith('r1');

    await wrap(<ReviewScreen />, { smartlog: slog });
    await fireEvent.press(screen.getByLabelText('Buat aturan'));
    expect(await screen.findByDisplayValue('GOPAY TOPUP')).toBeTruthy();
  });
});

describe('Fitur 3: bundel PDF laporan pajak & invoice lintas bahasa', () => {
  const thisYear = new Date().getFullYear();
  const invPaid: Invoice = {
    id: 'inv-1',
    kind: 'invoice',
    number: `INV-${thisYear}-0001`,
    status: 'paid',
    clientName: 'PT Nusantara',
    issueDate: `${thisYear}-05-10`,
    paidAt: `${thisYear}-05-15T00:00:00Z`,
    currency: 'USD',
    items: [{ id: 'i1', name: 'Jasa Audit', qty: 1, unitPrice: 10_000 }], // $100.00
    discount: 0,
    taxBp: 1100, // $11.00
    subtotal: 10_000,
    tax: 1_100,
    total: 11_100,
    createdAt: `${thisYear}-05-10T00:00:00Z`,
  };

  it('menggabungkan invoice lintas mata uang dan pajak keluaran ke bundel PDF ID/TR', () => {
    const sum = invoiceFiscalSummary([invPaid], thisYear, 'IDR');
    expect(sum.paidCount).toBe(1);
    expect(sum.paidSubtotal).toBe(1_625_000);
    expect(sum.paidTax).toBe(178_750);
    expect(sum.paidTotal).toBe(1_803_750);

    const report = annualReport([], thisYear, 'ID', { married: false, dependents: 0 });
    const htmlId = fiscalBundleDocument(report, [invPaid], { t: makeT('id'), lang: 'id', owner: 'Budi' });
    expect(htmlId).toContain(`INV-${thisYear}-0001`);
    expect(htmlId).toContain('Pajak keluaran');
    expect(htmlId).not.toContain('{year}');

    const htmlTr = fiscalBundleDocument(annualReport([], thisYear, 'TR', { married: false, dependents: 0 }), [invPaid], { t: makeT('tr'), lang: 'tr', owner: 'Budi' });
    expect(htmlTr).toContain('Hesaplanan vergi');
    expect(htmlTr).not.toContain('{year}');
  });

  it('menampilkan kartu invoice & opsi bundel PDF di Laporan Pajak dan Ekspor PDF', async () => {
    await wrap(<AnnualTaxReport />, { state: { plan: 'premium' }, invoices: [invPaid] });
    expect(screen.getByText('Ringkasan invoice & pajak keluaran')).toBeTruthy();
    expect(screen.getByText('Ekspor PDF pajak + invoice')).toBeTruthy();

    await wrap(<PdfExport />, { state: { plan: 'premium' }, invoices: [invPaid] });
    expect(screen.getByText('Paket pajak & invoice tahunan')).toBeTruthy();
  });
});

describe('Fitur 4: proyeksi tagihan & langganan siklus gajian multi-akun', () => {
  const lowAcc: Account = { ...accIdr, id: 'acc-low', name: 'Bank Gajian', openingBalance: 100_000 };
  const today = todayYmd();
  const todayDay = Number(today.slice(8, 10));
  const safePayday = todayDay >= 25 ? 10 : 28;
  const billDue: Bill = {
    id: 'bill-1',
    name: 'Listrik',
    amount: 250_000,
    currency: 'IDR',
    frequency: 'monthly',
    dueDate: today,
    anchorDay: todayDay,
    accountId: lowAcc.id,
    categoryKey: 'utilities',
    paidPeriods: [],
  };

  it('mendeteksi akun kurang dana sebelum payday dan tetap aman di Anggaran tanpa PlanningProvider', async () => {
    const unitBill: Bill = { ...billDue, dueDate: '2026-11-20', anchorDay: 20 };
    const proj = computePaydayProjection({
      bills: [unitBill],
      subscriptions: [],
      accounts: [lowAcc],
      transactions: [],
      today: '2026-11-10',
      payday: 25,
      mainCurrency: 'IDR',
    });
    expect(proj.nextPayday).toBe('2026-11-25');
    expect(proj.shortfallAccountsCount).toBe(1);
    expect(proj.accounts[0]?.shortfall).toBe(150_000);

    await wrap(<BillsScreen />, {
      state: { accounts: [lowAcc], transactions: [], payday: safePayday },
      bills: [billDue],
    });
    expect(screen.getByText('Proyeksi sebelum gajian')).toBeTruthy();
    expect(screen.getByText('Kurang Rp 150.000')).toBeTruthy();

    await wrap(<BillCalendar bills={[unitBill]} today="2026-11-10" paydayDate="2026-11-25" onPressBill={jest.fn()} />);
    expect(screen.getByText('Gajian')).toBeTruthy();

    // Dengan PlanningProvider: tampilkan baris ringkasan tagihan di Anggaran.
    await wrap(<AnggaranScreen />, {
      state: { accounts: [lowAcc], transactions: [], payday: safePayday },
      bills: [billDue],
      withPlanning: true,
    });
    expect(screen.getByText('1 akun kurang')).toBeTruthy();

    // Tanpa kewajiban sebelum gajian: tetap aman dirender tanpa banner payday.
    await wrap(<AnggaranScreen />, {
      state: { accounts: [lowAcc], transactions: [], payday: safePayday },
      bills: [],
      subscriptions: [],
      withPlanning: true,
    });
    expect(screen.getByText('Aman dibelanjakan')).toBeTruthy();

    // Tanpa PlanningProvider saat memuat: tidak melempar error usePlanningOptional.
    await wrap(<AnggaranScreen />, { state: { status: 'loading' }, withPlanning: false });
    expect(screen.getByLabelText('Memuat anggaran')).toBeTruthy();
  });
});

describe('Fitur 5: rekonsiliasi saldo akhir rekening koran otomatis saat import PDF', () => {
  const bankAcc: Account = { ...accIdr, id: 'acc-recon', name: 'BCA Rekening', openingBalance: 1_000_000 };
  const afterCloseTx: Transaction = {
    id: 'tx-after',
    type: 'expense',
    merchant: 'Jajan setelah tutup periode',
    categoryKey: 'food',
    accountId: bankAcc.id,
    date: '2026-11-05',
    time: '09:00',
    amount: 50_000,
    currency: 'IDR',
    source: 'manual',
  };
  const stmtRow = {
    date: '2026-11-04',
    description: 'DEBIT TOKO BUKU',
    type: 'expense' as const,
    amount: 100_000,
    currency: 'IDR',
    categoryKey: 'shopping',
    time: null,
  };

  it('mengabaikan transaksi sesudah closingDate dan menghitung selisih saldo dengan tepat', () => {
    const matched = reconcileStatement(
      { rows: [stmtRow], closingBalance: 900_000, closingDate: '2026-11-04', closingCurrency: 'IDR' },
      [stmtRow],
      bankAcc,
      [afterCloseTx],
    )!;
    expect(matched.matched).toBe(true);
    expect(matched.projectedBalance).toBe(900_000);
    expect(matched.difference).toBe(0);

    const diff = reconcileStatement(
      { rows: [stmtRow], closingBalance: 915_000, closingDate: '2026-11-04', closingCurrency: 'IDR' },
      [stmtRow],
      bankAcc,
      [afterCloseTx],
    )!;
    expect(diff.matched).toBe(false);
    expect(diff.difference).toBe(15_000);
  });

  it('menampilkan kartu rekonsiliasi & menyertakan transaksi penyesuaian saat toggle diaktifkan', async () => {
    const onImport = jest.fn();
    await wrap(
      <ImportReview
        result={{ pages: 1, rows: [stmtRow], closingBalance: 915_000, closingDate: '2026-11-04', closingCurrency: 'IDR' }}
        accountId={bankAcc.id}
        accountName={bankAcc.name}
        account={bankAcc}
        existing={[afterCloseTx]}
        onImport={onImport}
      />,
    );

    expect(screen.getByText('Rekonsiliasi saldo akhir')).toBeTruthy();
    expect(screen.getByText('Ada selisih')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Tambahkan penyesuaian saldo'));
    expect(screen.getByText('Import 2 transaksi')).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByText('Import 2 transaksi'));
      await new Promise((r) => setTimeout(r, 500));
    });

    expect(onImport).toHaveBeenCalledTimes(1);
    const imported = onImport.mock.calls[0]![0] as Transaction[];
    expect(imported).toHaveLength(2);
    expect(imported[1]).toMatchObject({
      type: 'income',
      amount: 15_000,
      date: '2026-11-04',
      time: '23:59',
      categoryKey: 'other',
      source: 'import',
      merchant: 'Penyesuaian saldo rekening koran',
    });
  });
});

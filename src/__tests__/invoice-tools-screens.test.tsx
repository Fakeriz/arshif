import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import TaxEstimator from '@/app/alat/pajak';
import ToolsHub from '@/app/alat/index';
import InvoiceDetail from '@/app/invoice/[id]';
import InvoiceList from '@/app/invoice/index';
import { PaywallProvider } from '@/components/shell/Paywall';
import { ToastProvider } from '@/components/ui';
import * as remote from '@/data/remote/invoices';
import { sampleState } from '@/data/sample-state';
import { I18nProvider } from '@/i18n';
import type { Invoice } from '@/lib/invoice';
import { AppStoreProvider, useStore } from '@/state/AppStore';
import { InvoicesProvider, useInvoices } from '@/state/invoices';
import type { AppState } from '@/state/reducer';
import { ThemeProvider } from '@/theme/ThemeProvider';

const mockPush = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), navigate: mockPush, replace: mockPush }),
  useLocalSearchParams: () => mockParams,
  router: { push: (...a: unknown[]) => mockPush(...a) },
}));
jest.mock('@/data/remote/invoices', () => ({
  ...jest.requireActual('@/data/remote/invoices'),
  invoiceMarkPaid: jest.fn(),
  featureGate: jest.fn(async () => undefined),
}));
const markPaidApi = remote.invoiceMarkPaid as jest.MockedFunction<typeof remote.invoiceMarkPaid>;

const base = sampleState();
const idr = base.accounts.find((a) => a.currency === 'IDR')!;

const invoice = (o: Partial<Invoice> = {}): Invoice => ({
  id: '00000000-0000-4000-8000-0000000000f1', kind: 'invoice', number: 'INV-2026-0001', status: 'sent', clientName: 'PT Klien Contoh',
  issueDate: '2026-11-01', dueDate: '2026-11-15', currency: 'IDR', items: [{ id: 'a', name: 'Desain logo', qty: 1, unitPrice: 2_500_000 }],
  discount: 0, taxBp: 0, subtotal: 2_500_000, tax: 0, total: 2_500_000, createdAt: '2026-11-01T00:00:00Z', ...o,
});

let store: ReturnType<typeof useStore> | null = null;
let invoices: ReturnType<typeof useInvoices> | null = null;
function Probe() {
  store = useStore();
  invoices = useInvoices();
  return null;
}

function wrap(ui: ReactNode, opts: { state?: Partial<AppState>; invoices?: Invoice[] } = {}) {
  return render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <I18nProvider initialLang="id">
        <ThemeProvider initialMode="dark">
          <ToastProvider>
            <AppStoreProvider preset={{ ...base, ...opts.state }}>
              <InvoicesProvider preset={opts.invoices ?? []}>
                <PaywallProvider>
                  <Probe />
                  {ui}
                </PaywallProvider>
              </InvoicesProvider>
            </AppStoreProvider>
          </ToastProvider>
        </ThemeProvider>
      </I18nProvider>
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  mockPush.mockClear();
  markPaidApi.mockReset();
  mockParams = {};
});

describe('tandai Dibayar', () => {
  it('membuat tepat satu transaksi pemasukan (id = invoice), mata uang invoice, akun pilihan; dua kali tetap satu', async () => {
    const inv = invoice();
    markPaidApi.mockImplementation(async () => ({ ...inv, status: 'paid', transactionId: inv.id, accountId: idr.id, paidAt: '2026-11-06T03:00:00Z' }));
    await wrap(null, { invoices: [inv] });
    const before = store!.state.transactions.length;

    // Dua ketukan bersamaan: yang kedua ditolak di klien.
    let second: unknown = null;
    await act(async () => {
      const a = invoices!.markPaid(inv, { accountId: idr.id, date: '2026-11-06' });
      const b = invoices!.markPaid(inv, { accountId: idr.id, date: '2026-11-06' }).catch((e) => (second = e));
      await Promise.all([a, b]);
    });
    expect(second).toBeTruthy();
    // Percobaan ulang dengan objek lama (belum berstatus paid): transaksi sudah ada, tidak dibuat lagi.
    await act(async () => {
      await invoices!.markPaid(inv, { accountId: idr.id, date: '2026-11-06' });
    });

    const added = store!.state.transactions.filter((t) => t.id === inv.id);
    expect(store!.state.transactions.length).toBe(before + 1);
    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({ type: 'income', amount: 2_500_000, currency: 'IDR', accountId: idr.id, source: 'invoice', categoryKey: 'freelance', note: 'INV-2026-0001' });
    expect(markPaidApi).toHaveBeenCalledWith(inv.id, inv.id);
    expect(invoices!.invoices[0].status).toBe('paid');
  });

  it('dari layar detail: tombol, sheet akun, lalu status Dibayar', async () => {
    const inv = invoice();
    mockParams = { id: inv.id };
    markPaidApi.mockImplementation(async () => ({ ...inv, status: 'paid', transactionId: inv.id, accountId: idr.id, paidAt: '2026-11-06T03:00:00Z' }));
    await wrap(<InvoiceDetail />, { invoices: [inv] });
    await act(async () => fireEvent.press(screen.getByText('Tandai dibayar')));
    expect(await screen.findByText('Pemasukan Rp 2.500.000 dicatat satu kali ke akun yang Anda pilih.')).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByText('Catat pemasukan dan tandai dibayar')));
    expect(markPaidApi).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Dibayar. Pemasukan Rp 2.500.000 sudah tercatat.')).toBeTruthy();
    expect(screen.queryByText('Tandai dibayar')).toBeNull();
  });
});

describe('batas invoice Free', () => {
  it('5/bulan terpakai: badge PRO dan tombol Buat membuka paywall, bukan form', async () => {
    await wrap(<InvoiceList />, { state: { usage: { ...base.usage, invoice: 5 } }, invoices: [invoice()] });
    expect(screen.getByText('Bulan ini: 5 dari 5 invoice dan penawaran (paket Free)')).toBeTruthy();
    expect(screen.getByText('PRO')).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByText('Buat')));
    expect(await screen.findByText('Buka batas dengan Premium')).toBeTruthy();
    expect(screen.getByText('Paket Free bisa membuat 5 invoice dan penawaran per bulan. Premium tanpa batas.')).toBeTruthy();
    expect(mockPush).not.toHaveBeenCalledWith(expect.objectContaining({ pathname: '/invoice/form' }));
  });

  it('Premium: tanpa baris kuota, tombol Buat membuka form', async () => {
    await wrap(<InvoiceList />, { state: { plan: 'premium', usage: { ...base.usage, invoice: 40 } } });
    expect(screen.queryByText(/dari 5 invoice/)).toBeNull();
    await act(async () => fireEvent.press(screen.getByText('Buat')));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/invoice/form', params: { jenis: 'invoice' } });
  });
});

describe('Money & Tax Tools', () => {
  it('Free: konverter + cicilan terbuka, pajak/laporan/ekspor PRO membuka paywall', async () => {
    await wrap(<ToolsHub />);
    await act(async () => fireEvent.press(screen.getByText('Konverter mata uang')));
    expect(mockPush).toHaveBeenCalledWith('/alat/kurs');
    await act(async () => fireEvent.press(screen.getByText('Estimasi pajak penghasilan')));
    expect(await screen.findByText('Buka batas dengan Premium')).toBeTruthy();
    expect(mockPush).not.toHaveBeenCalledWith('/alat/pajak');
    expect(screen.getAllByText('PRO')).toHaveLength(3);
  });

  it('Free membuka layar pajak langsung: terkunci + paywall, tanpa kalkulator', async () => {
    await wrap(<TaxEstimator />);
    expect(await screen.findByText('Estimasi pajak untuk Premium')).toBeTruthy();
    expect(screen.getByText('Buka batas dengan Premium')).toBeTruthy();
    expect(screen.queryByText('Penghasilan bruto per bulan')).toBeNull();
  });

  it('Premium: estimasi PPh 21 dengan rincian, tarif, dan disclaimer', async () => {
    await wrap(<TaxEstimator />, { state: { plan: 'premium' } });
    expect(screen.getByText(/Hasil ini hanya estimasi, bukan nasihat pajak resmi/)).toBeTruthy();
    await act(async () => fireEvent.changeText(screen.getByLabelText('Penghasilan bruto per bulan'), '10000000'));
    expect(await screen.findAllByText('Rp 200.000')).toHaveLength(2);
    expect(screen.getByText('TER kategori A (TK/0): 2% × bruto sebulan')).toBeTruthy();
    expect(screen.getByText('Tarif 2026 yang dipakai')).toBeTruthy();
    expect(screen.getByText('Rp 800.000')).toBeTruthy();
  });
});

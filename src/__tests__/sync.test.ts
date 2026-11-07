import type { Account, Transaction } from '@/data/types';
import { MissingRateError } from '@/lib/fx';
import { initialState } from '@/state/reducer';
import { syncAction } from '@/state/sync';

const mockRatesOn = jest.fn();
const mockInsert = jest.fn();
jest.mock('@/data/remote/api', () => ({
  ratesOn: (...a: unknown[]) => mockRatesOn(...a),
  insertTransactions: (...a: unknown[]) => mockInsert(...a),
}));

const idr: Account = { id: 'acc-idr', bank: 'bca', name: 'BCA', type: 'tabungan', currency: 'IDR', openingBalance: 0 };
const state = { ...initialState(), accounts: [idr] };
// Invoice AED 1.000,00 dibayar ke rekening IDR, tanpa accountAmount (jalur markPaid/planning).
const tx: Transaction = {
  id: 'tx-1', type: 'income', merchant: 'Klien Dubai', categoryKey: 'salary', accountId: 'acc-idr',
  date: '2026-11-07', time: '10:00', amount: 100_000, currency: 'AED', source: 'invoice',
};

beforeEach(() => {
  mockRatesOn.mockReset();
  mockInsert.mockReset().mockResolvedValue(undefined);
});

describe('syncAction — kurs pada tanggal transaksi', () => {
  it('kurs mata uang transaksi tidak ada: gagal dengan MissingRateError, tidak menyimpan nominal mentah', async () => {
    mockRatesOn.mockResolvedValue({ table: { USD: '1', IDR: '16000' }, date: '2026-11-07' });
    await expect(syncAction({ type: 'tx/add', tx }, state, 'u1')).rejects.toBeInstanceOf(MissingRateError);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('kurs tersedia: nominal akun dikonversi dengan kurs hari itu', async () => {
    // 1 USD = 3,6725 AED = 16.000 IDR → AED 1.000,00 ≈ Rp4.356.705.
    mockRatesOn.mockResolvedValue({ table: { USD: '1', IDR: '16000', AED: '3.6725' }, date: '2026-11-07' });
    const [saved] = await syncAction({ type: 'tx/add', tx }, state, 'u1');
    expect(saved.accountAmount).toBe(4_356_705);
    expect(mockInsert).toHaveBeenCalledWith([saved]);
  });

  it('nominal akun sudah diberikan (form): dipakai apa adanya walau kurs harian tidak ada', async () => {
    mockRatesOn.mockResolvedValue({ table: { USD: '1', IDR: '16000' }, date: '2026-11-07' });
    const [saved] = await syncAction({ type: 'tx/add', tx: { ...tx, accountAmount: 4_400_000 } }, state, 'u1');
    expect(saved.accountAmount).toBe(4_400_000);
  });
});

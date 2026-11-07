import { loadTransactions } from '@/data/remote/api';
import type { TransactionRow } from '@/data/remote/mappers';

const row = (i: number): TransactionRow => ({
  id: `t${i}`, type: 'expense', merchant: `M${i}`, category_key: 'food', account_id: 'a1', to_account_id: null,
  date: '2026-11-07', time: '10:00', amount: 1000, currency: 'IDR', account_amount: null, to_amount: null,
  note: null, source: 'manual', receipt_path: null,
});

// Halaman 1: t0..t999. Sebelum halaman 2 diminta, satu transaksi baru masuk di atas: semua baris bergeser satu,
// jadi halaman 2 dimulai lagi dari t999 (baris terakhir halaman 1).
const mockPages: Record<number, TransactionRow[]> = {
  0: Array.from({ length: 1000 }, (_, i) => row(i)),
  1000: Array.from({ length: 51 }, (_, i) => row(999 + i)),
};

jest.mock('@/lib/supabase', () => {
  const query = (from: number) => {
    const q: Record<string, unknown> = {};
    for (const m of ['select', 'order']) q[m] = () => q;
    q.range = (start: number) => query(start);
    q.returns = () => Promise.resolve({ data: mockPages[from] ?? [], error: null });
    return q;
  };
  return { supabase: { from: () => query(-1) } };
});

it('halaman bergeser saat memuat (> 1000 transaksi): tidak ada transaksi yang terhitung dua kali (audit 15)', async () => {
  const txs = await loadTransactions();
  expect(txs).toHaveLength(1050);
  expect(new Set(txs.map((t) => t.id)).size).toBe(txs.length);
  expect(txs.filter((t) => t.id === 't999')).toHaveLength(1);
  expect(txs[txs.length - 1]!.id).toBe('t1049');
});

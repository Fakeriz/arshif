import { sampleScan, sampleStatement, seedTransactions } from '@/data/seed';
import { findDuplicate, similarity } from '@/lib/dedupe';
import { QUOTAS, isLimited, remaining } from '@/lib/quota';
import { isLowConfidence, itemsTotal, subtotalMismatch } from '@/lib/receipt';
import { lastFullWeek, weeklyRecap } from '@/lib/recap';
import { validateTx } from '@/lib/validate';
import type { Transaction } from '@/data/types';

describe('review struk', () => {
  it('keyakinan < 0,7 ditandai kuning', () => {
    expect(isLowConfidence(0.62)).toBe(true);
    expect(isLowConfidence(0.7)).toBe(false);
  });

  it('selisih item vs subtotal > 1% memicu peringatan', () => {
    expect(itemsTotal(sampleScan.items)).toBe(84_500);
    expect(subtotalMismatch(sampleScan.items, sampleScan.subtotal)).toEqual({ mismatch: true, diff: -3_000 });
    expect(subtotalMismatch(sampleScan.items, 84_900).mismatch).toBe(false); // selisih 0,47%
    expect(subtotalMismatch([], 0).mismatch).toBe(false);
  });
});

describe('deteksi duplikat rekening koran', () => {
  it('kemiripan deskripsi memakai irisan kata', () => {
    expect(similarity('APOTEK K-24 KEMANG', 'Apotek K-24')).toBe(0.5);
    expect(similarity('Sewa kos', 'Bioskop XXI')).toBe(0);
    expect(similarity('', 'x')).toBe(0);
  });

  it('menandai baris yang tanggal ±1 hari, nominal sama, deskripsi mirip', () => {
    const dup = sampleStatement.rows.filter((r) => findDuplicate(r, seedTransactions, 'a-bca')).map((r) => r.id);
    expect(dup).toEqual(['s1', 's2', 's5']);
  });

  it('akun atau nominal beda = bukan duplikat', () => {
    const row = sampleStatement.rows[0];
    expect(findDuplicate(row, seedTransactions, 'a-jago')).toBeNull();
    expect(findDuplicate({ ...row, amount: 87_501 }, seedTransactions, 'a-bca')).toBeNull();
    expect(findDuplicate({ ...row, date: '2026-11-02' }, seedTransactions, 'a-bca')).toBeNull();
  });
});

describe('kuota Free vs Premium', () => {
  it('mengikuti tabel PRD Bab 7', () => {
    expect(QUOTAS.free.scan).toBe(20);
    expect(QUOTAS.premium.scan).toBe(300);
    expect(QUOTAS.premium.accounts).toBeNull();
  });

  it('batas tercapai pada used >= limit; Premium tanpa batas tidak pernah terbatas', () => {
    expect(isLimited('free', 'scan', 19)).toBe(false);
    expect(isLimited('free', 'scan', 20)).toBe(true);
    expect(isLimited('free', 'accounts', 4)).toBe(true);
    expect(isLimited('premium', 'accounts', 9999)).toBe(false);
    expect(remaining('free', 'scan', 14)).toBe(6);
    expect(remaining('free', 'scan', 25)).toBe(0);
    expect(remaining('premium', 'automation', 5)).toBeNull();
  });
});

describe('recap mingguan', () => {
  const mk = (id: string, date: string, categoryKey: string, amount: number): Transaction => ({
    id, date, time: '10:00', merchant: id, categoryKey, accountId: 'a', amount, currency: 'IDR', type: 'expense', source: 'manual',
  });

  it('minggu penuh terakhir = Senin-Minggu sebelum minggu berjalan', () => {
    expect(lastFullWeek('2026-11-05')).toEqual({ start: '2026-10-26', end: '2026-11-01' });
    expect(lastFullWeek('2026-11-02')).toEqual({ start: '2026-10-26', end: '2026-11-01' }); // Senin
    expect(lastFullWeek('2026-11-01')).toEqual({ start: '2026-10-19', end: '2026-10-25' }); // Minggu
  });

  it('merangkum total, perubahan, kategori teratas, terbesar, hari tanpa belanja', () => {
    const txs = [
      mk('p', '2026-10-20', 'food', 200_000),
      mk('a', '2026-10-27', 'food', 100_000),
      mk('b', '2026-10-28', 'shopping', 300_000),
      mk('c', '2026-10-28', 'food', 50_000),
      mk('out', '2026-11-02', 'food', 999_999),
    ];
    const r = weeklyRecap(txs, '2026-11-05', 'IDR');
    expect(r).toMatchObject({ spent: 450_000, previousSpent: 200_000, changePct: 125, topCategoryKey: 'shopping', topCategorySpent: 300_000, noSpendDays: 5, txCount: 3 });
    expect(r.biggest?.id).toBe('b');
  });

  it('minggu sebelumnya kosong: persen perubahan null, bukan Infinity', () => {
    expect(weeklyRecap([mk('a', '2026-10-27', 'food', 1)], '2026-11-05', 'IDR').changePct).toBeNull();
  });
});

describe('validasi form transaksi', () => {
  const ok = { type: 'expense' as const, amount: 28_000, merchant: 'Kopi', accountId: 'a-gopay', toAccountId: null, categoryKey: 'hangout', date: '2026-11-05' };

  it('data lengkap lolos', () => expect(validateTx(ok)).toEqual({}));

  it('pesan error spesifik per field', () => {
    const e = validateTx({ ...ok, amount: null, merchant: ' ', accountId: null, categoryKey: null });
    expect(Object.keys(e).sort()).toEqual(['accountId', 'amount', 'categoryKey', 'merchant']);
  });

  it('transfer butuh akun asal dan tujuan berbeda, tanpa kategori', () => {
    const t = { ...ok, type: 'transfer' as const, merchant: '', categoryKey: null, toAccountId: 'a-gopay' };
    expect(validateTx(t).toAccountId).toBe('Akun tujuan harus berbeda dari akun asal.');
    expect(validateTx({ ...t, toAccountId: 'a-bca' })).toEqual({});
    expect(validateTx({ ...t, toAccountId: null }).toAccountId).toBe('Pilih akun tujuan.');
  });

  it('tanggal salah format ditolak', () => expect(validateTx({ ...ok, date: '5/11/2026' }).date).toBeDefined());
});

import { categorizeStatementRow, prettifyDescription } from '@/lib/statement';

describe('kategori awal rekening koran', () => {
  it.each([
    ['APOTEK K-24 KEMANG', 'expense', 'health'],
    ['SEWA KOS NOVEMBER', 'expense', 'housing'],
    ['BIAYA ADM BULANAN', 'expense', 'bank'],
    ['GAJI OKTOBER', 'income', 'salary'],
    ['TRF DARI AYAH', 'income', 'other'],
    ['SESUATU TAK DIKENAL', 'expense', 'other'],
  ] as const)('%s (%s) -> %s', (desc, type, expected) => {
    expect(categorizeStatementRow(desc, type)).toBe(expected);
  });

  it('pengeluaran tidak pernah jadi Gaji', () => {
    expect(categorizeStatementRow('POTONGAN GAJI', 'expense')).not.toBe('salary');
  });

  it('merapikan huruf kapital deskripsi bank', () => {
    expect(prettifyDescription('APOTEK K-24 KEMANG')).toBe('Apotek K-24 Kemang');
    expect(prettifyDescription('TRF DARI AYAH')).toBe('Transfer Dari Ayah');
  });
});

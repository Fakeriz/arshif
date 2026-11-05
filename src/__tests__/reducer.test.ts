import type { Transaction } from '@/data/types';
import { accountBalance } from '@/lib/transactions';
import { sampleState as initialState } from '@/data/sample-state';
import { reducer } from '@/state/reducer';

const tx: Transaction = { id: 'new1', type: 'expense', merchant: 'Bakso Solo', categoryKey: 'food', accountId: 'a-gopay', date: '2026-11-05', time: '12:00', amount: 30_000, currency: 'IDR', source: 'scan' };
const gopay = (s: ReturnType<typeof initialState>) => accountBalance(s.accounts.find((a) => a.id === 'a-gopay')!, s.transactions);

describe('store memori', () => {
  it('tambah transaksi: saldo turun, kuota scan +1 hanya saat sukses disimpan', () => {
    const s0 = initialState();
    const s1 = reducer(s0, { type: 'tx/add', tx, consumes: 'scan' });
    expect(gopay(s1)).toBe(gopay(s0) - 30_000);
    expect(s1.usage.scan).toBe(s0.usage.scan + 1);
    expect(reducer(s0, { type: 'tx/add', tx }).usage.scan).toBe(s0.usage.scan);
  });

  it('ubah dan hapus transaksi memulihkan saldo', () => {
    const s1 = reducer(initialState(), { type: 'tx/add', tx });
    const s2 = reducer(s1, { type: 'tx/update', tx: { ...tx, amount: 50_000 } });
    expect(gopay(s2)).toBe(gopay(initialState()) - 50_000);
    expect(gopay(reducer(s2, { type: 'tx/delete', id: 'new1' }))).toBe(gopay(initialState()));
  });

  it('simpan banyak (voice/import) menambah kuota sekali', () => {
    const s = reducer(initialState(), { type: 'tx/addMany', txs: [tx, { ...tx, id: 'new2' }], consumes: 'automation' });
    expect(s.usage.automation).toBe(initialState().usage.automation + 1);
    expect(s.transactions.length).toBe(initialState().transactions.length + 2);
  });

  it('persentase tidak valid ditolak', () => {
    const s = initialState();
    expect(reducer(s, { type: 'budget/split', split: { needs: 60, wants: 30, savings: 20 } }).split).toEqual(s.split);
    expect(reducer(s, { type: 'budget/split', split: { needs: 60, wants: 20, savings: 20 } }).split.needs).toBe(60);
  });

  it('notifikasi dan preferensi', () => {
    let s = reducer(initialState(), { type: 'notif/read', id: 'n1' });
    expect(s.notifications.find((n) => n.id === 'n1')?.read).toBe(true);
    s = reducer(s, { type: 'notif/readAll' });
    expect(s.notifications.every((n) => n.read)).toBe(true);
    expect(reducer(s, { type: 'prefs/hideBalance', value: true }).hideBalance).toBe(true);
    expect(reducer(s, { type: 'prefs/notif', key: 'bill_due', value: false }).notifPrefs.bill_due).toBe(false);
    expect(reducer(s, { type: 'prefs/mainCurrency', code: 'MYR' }).mainCurrency).toBe('MYR');
  });
});

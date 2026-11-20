import { PlacesRequest } from '../../supabase/functions/_shared/contracts.ts';
import { normalizeVoice } from '../../supabase/functions/_shared/normalize.ts';
import { fromTransaction, toTransaction, type TransactionRow } from '@/data/remote/mappers';
import type { Transaction } from '@/data/types';

const ACC = '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c9d';
const base: Transaction = {
  id: '11111111-1111-4111-8111-111111111111', type: 'expense', merchant: 'Kopi', categoryKey: 'hangout', accountId: ACC,
  date: '2026-11-20', time: '09:30', amount: 28000, currency: 'IDR', source: 'manual',
};

describe('lokasi transaksi', () => {
  it('pulang-pergi mapper: lokasi tersimpan dan terbaca utuh', () => {
    const place = { name: 'Kopi Kenangan Kemang', address: 'Jl. Kemang Raya 8', lat: -6.26, lng: 106.81, placeId: 'ChIJabc' };
    const cols = fromTransaction({ ...base, place });
    expect(cols).toMatchObject({ place_name: place.name, place_lat: place.lat, place_lng: place.lng, place_id: 'ChIJabc' });
    expect(toTransaction({ ...cols, receipt_path: null } as unknown as TransactionRow).place).toEqual(place);
  });

  it('tanpa lokasi: kolom dikirim null (ubah transaksi menghapus lokasi lama)', () => {
    const cols = fromTransaction(base);
    expect([cols.place_name, cols.place_address, cols.place_lat, cols.place_lng, cols.place_id]).toEqual([null, null, null, null, null]);
    expect(toTransaction({ ...cols, receipt_path: null } as unknown as TransactionRow).place).toBeUndefined();
  });

  it('voice: nama tempat yang diucapkan dibawa sebagai placeHint, kosong = null', () => {
    const v = normalizeVoice(
      {
        transcript: 'kopi 28 ribu di Kopi Kenangan Kemang, bensin 150 ribu',
        items: [
          { type: 'expense', merchant: 'Kopi', amount: '28000', currency: 'IDR', categoryKey: 'hangout', date: '2026-11-20', placeHint: '  Kopi Kenangan Kemang ' },
          { type: 'expense', merchant: 'Bensin', amount: '150000', currency: 'IDR', categoryKey: 'fuel', date: '2026-11-20' },
        ],
      },
      { accountIds: [ACC], defaultCurrency: 'IDR', today: '2026-11-20' },
    );
    expect(v.items.map((i) => i.placeHint)).toEqual(['Kopi Kenangan Kemang', null]);
  });

  it('kontrak places menolak koordinat di luar batas dan kueri terlalu pendek', () => {
    expect(PlacesRequest.safeParse({ action: 'nearby', lang: 'id', at: { lat: 91, lng: 0 } }).success).toBe(false);
    expect(PlacesRequest.safeParse({ action: 'search', lang: 'id', query: 'a' }).success).toBe(false);
    expect(PlacesRequest.safeParse({ action: 'search', lang: 'id', query: 'Indomaret Kemang' }).success).toBe(true);
  });
});

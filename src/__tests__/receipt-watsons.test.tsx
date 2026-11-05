import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import { toTransaction, fromTransaction, type TransactionRow } from '@/data/remote/mappers';
import type { Transaction } from '@/data/types';
import { receiptFromScan } from '@/features/capture/ScanReview';
import { ReceiptCard, ReceiptDetailsCard } from '@/features/transactions/ReceiptSections';
import { itemPaid, totalCheck } from '@/lib/receipt';
import { ThemeProvider } from '@/theme/ThemeProvider';

import { ScanResult } from '../../supabase/functions/_shared/contracts';
import { normalizeScan } from '../../supabase/functions/_shared/normalize';
import { SCAN_SCHEMA, scanPrompt } from '../../supabase/functions/_shared/prompts';

/**
 * Struk Watsons Carousel 06/08/2025, FİŞ NO 0039. Keluaran mentah dalam bentuk SCAN_SCHEMA, disalin dari foto:
 * diskon tercetak negatif, tarif KDV per item, tabel KDV per tarif.
 */
const WATSONS_RAW = {
  merchant: 'WATSONS - CAROUSEL',
  storeAddress: 'H.Z. Uşakligil Cad. Carousel AVM No:21, Bakırköy / İstanbul',
  storeTaxId: 'Anadolu KR. VD. 2120370364',
  receiptNo: '0039',
  paymentMethod: 'FinansBank',
  date: '2025-08-06',
  time: '12:44',
  currency: 'TRY',
  subtotal: '954.55',
  discountTotal: '318.35',
  taxTotal: '71.84',
  taxIncluded: true,
  service: null,
  total: '636.20',
  items: [
    { name: 'HEAD&SHOULDERS ŞAMPU', qty: '1', unitPrice: '259.90', total: '259.90', taxRate: '20' },
    { name: 'MARVİS YASEMİNLİ DİŞ', qty: '1', unitPrice: '358.90', total: '358.90', taxRate: '10' },
    { name: 'WATSONS KREMSİ DUŞ J', qty: '1', unitPrice: '159.90', total: '159.90', taxRate: '20' },
    { name: 'WATSONS TEKRAR KULLA', qty: '1', unitPrice: '15.95', total: '15.95', taxRate: '10' },
    { name: 'COLGATE BRILLIANT BL', qty: '1', unitPrice: '159.90', total: '159.90', taxRate: '10' },
  ],
  discounts: [
    { label: 'KAZANC', itemName: 'WATSONS TEKRAR KULLA', taxRate: '%10', amount: '-3.45' },
    { label: 'AGUSTOS INSERT', itemName: 'WATSONS KREMSİ DUŞ J', taxRate: '%20', amount: '-104.95' },
    { label: '8.8 KAZANCI', itemName: 'HEAD&SHOULDERS ŞAMPU', taxRate: '%20', amount: '-130.00' },
    { label: '209.90 TL harcayana', itemName: 'COLGATE BRILLIANT BL', taxRate: '%10', amount: '-79.95' },
  ],
  taxLines: [
    { rate: '10', tax: '41.03', gross: '451.35' },
    { rate: '20', tax: '30.81', gross: '184.85' },
  ],
  categoryKey: 'shopping',
  confidence: { merchant: 0.95, date: 0.95, total: 0.95, items: 0.9 },
};

const wrap = (ui: ReactElement) => render(<ThemeProvider initialMode="dark">{ui}</ThemeProvider>);

describe('prompt OCR tidak membuang diskon dan pajak', () => {
  it('skema meminta diskon, rincian pajak, lokasi, nomor struk, metode bayar', () => {
    const props = Object.keys((SCAN_SCHEMA as { properties: object }).properties);
    for (const k of ['discounts', 'taxLines', 'taxTotal', 'discountTotal', 'subtotal', 'storeAddress', 'storeTaxId', 'receiptNo', 'paymentMethod']) expect(props).toContain(k);
    expect((SCAN_SCHEMA as { required: string[] }).required).toEqual(expect.arrayContaining(['discounts', 'taxLines']));
    const p = scanPrompt();
    for (const word of ['Promosyonlar', 'KAZANÇ', 'TOPKDV', "KDV'Lİ TOPLAM", 'FİŞ NO', 'NEVER skip']) expect(p).toContain(word);
  });
});

describe('struk Watsons: semua angka terbaca dan cocok', () => {
  const s = normalizeScan(WATSONS_RAW, 'IDR')!;

  it('lolos kontrak dan header lengkap', () => {
    expect(ScanResult.safeParse(s).success).toBe(true);
    expect(s).toMatchObject({
      merchant: 'WATSONS - CAROUSEL',
      currency: 'TRY',
      date: '2025-08-06',
      time: '12:44',
      receiptNo: '0039',
      paymentMethod: 'FinansBank',
      storeTaxId: 'Anadolu KR. VD. 2120370364',
      subtotal: 95455,
      discount: 31835,
      tax: 7184,
      taxIncluded: true,
      total: 63620,
    });
    expect(s.storeAddress).toContain('Carousel AVM No:21');
  });

  it('4 diskon per item, besaran positif, total hemat 318,35', () => {
    expect(s.discounts.map((d) => [d.itemName, d.taxRate, d.amount, d.label])).toEqual([
      ['WATSONS TEKRAR KULLA', 10, 345, 'KAZANC'],
      ['WATSONS KREMSİ DUŞ J', 20, 10495, 'AGUSTOS INSERT'],
      ['HEAD&SHOULDERS ŞAMPU', 20, 13000, '8.8 KAZANCI'],
      ['COLGATE BRILLIANT BL', 10, 7995, '209.90 TL harcayana'],
    ]);
    expect(s.discounts.reduce((a, d) => a + d.amount, 0)).toBe(31835);
  });

  it('diskon menempel ke item; harga bayar per item benar', () => {
    const paid = Object.fromEntries(s.items.map((i) => [i.name, [i.total, i.discount, i.total - i.discount, i.taxRate]]));
    expect(paid).toEqual({
      'HEAD&SHOULDERS ŞAMPU': [25990, 13000, 12990, 20],
      'MARVİS YASEMİNLİ DİŞ': [35890, 0, 35890, 10],
      'WATSONS KREMSİ DUŞ J': [15990, 10495, 5495, 20],
      'WATSONS TEKRAR KULLA': [1595, 345, 1250, 10],
      'COLGATE BRILLIANT BL': [15990, 7995, 7995, 10],
    });
  });

  it('rumus subtotal - diskon = total dan rincian KDV per tarif cocok', () => {
    expect(s.items.reduce((a, i) => a + i.total, 0)).toBe(s.subtotal);
    expect(totalCheck({ subtotal: s.subtotal!, discount: s.discount!, tax: s.tax!, taxIncluded: s.taxIncluded, total: s.total })).toEqual({ expected: 63620, diff: 0, ok: true });
    expect(s.taxLines).toEqual([
      { rate: 10, tax: 4103, gross: 45135 },
      { rate: 20, tax: 3081, gross: 18485 },
    ]);
    expect(s.taxLines.reduce((a, l) => a + l.tax, 0)).toBe(s.tax);
    expect(s.taxLines.reduce((a, l) => a + (l.gross ?? 0), 0)).toBe(s.total);
    // Bruto per tarif = jumlah harga bayar item dengan tarif itu.
    for (const l of s.taxLines) expect(s.items.filter((i) => i.taxRate === l.rate).reduce((a, i) => a + i.total - i.discount, 0)).toBe(l.gross);
  });

  it('total tidak cocok ditandai (kuning di layar)', () => {
    expect(totalCheck({ subtotal: 95455, discount: 0, taxIncluded: true, total: 63620 }).ok).toBe(false);
    expect(totalCheck({ subtotal: 100000, discount: 0, tax: 11000, taxIncluded: false, total: 111000 }).ok).toBe(true);
  });
});

describe('keluaran AI yang berantakan tetap aman', () => {
  it('baris promosi yang masuk ke items (negatif) dipindah ke diskon; nama tanpa diakritik tetap cocok', () => {
    const s = normalizeScan(
      {
        ...WATSONS_RAW,
        discountTotal: null,
        items: [...WATSONS_RAW.items, { name: 'WATSONS TEKRAR KULLA', qty: '1', total: '-3.45', taxRate: '10' }],
        discounts: [{ label: null, itemName: 'HEAD&SHOULDERS SAMPU', taxRate: '20', amount: '130,00' }],
      },
      'IDR',
    )!;
    expect(s.items).toHaveLength(5);
    expect(s.items.find((i) => i.name.startsWith('WATSONS TEKRAR'))!.discount).toBe(345);
    expect(s.items.find((i) => i.name.startsWith('HEAD'))!.discount).toBe(0); // "130,00" ditolak: format bukan titik desimal
    expect(s.discount).toBe(345);
  });

  it('respons lama tanpa field baru tetap lolos kontrak (default)', () => {
    const old = { merchant: 'X', date: null, time: null, currency: 'IDR', subtotal: null, tax: null, service: null, discount: null, total: 1000, items: [{ name: 'a', qty: 1, unitPrice: 1000, total: 1000 }], categoryKey: 'other', confidence: { merchant: 1, date: 1, total: 1, items: 1 } };
    const p = ScanResult.parse(old);
    expect(p.discounts).toEqual([]);
    expect(p.items[0]).toMatchObject({ discount: 0, taxRate: null });
  });
});

describe('disimpan di transaksi dan dibaca kembali', () => {
  const s = normalizeScan(WATSONS_RAW, 'IDR')!;
  const tx: Transaction = {
    id: '00000000-0000-4000-8000-000000000001',
    type: 'expense',
    merchant: s.merchant,
    categoryKey: s.categoryKey,
    accountId: '00000000-0000-4000-8000-000000000002',
    date: s.date!,
    time: s.time!,
    amount: s.total,
    currency: s.currency,
    source: 'scan',
    items: s.items.map((i) => ({ name: i.name, qty: i.qty, unitPrice: i.unitPrice, total: i.total, discount: i.discount || undefined, taxRate: i.taxRate ?? undefined })),
    receipt: receiptFromScan(s),
  };

  it('kolom rincian struk ikut ditulis dan terbaca utuh', () => {
    const cols = fromTransaction(tx);
    expect(cols).toMatchObject({ subtotal: 95455, discount_total: 31835, tax_total: 7184, tax_included: true, receipt_no: '0039', payment_method: 'FinansBank', store_tax_id: 'Anadolu KR. VD. 2120370364' });
    const row = {
      ...cols,
      time: '12:44:00',
      receipt_path: null,
      // PostgREST: bigint datang sebagai number, numeric sebagai string.
      transaction_items: tx.items!.map((i, position) => ({ name: i.name, qty: i.qty, unit_price: i.unitPrice, total: i.total, position, discount: i.discount ?? 0, tax_rate: i.taxRate === undefined ? null : `${i.taxRate}.00` })),
    } as unknown as TransactionRow;
    const back = toTransaction(row);
    expect(back.receipt).toEqual(tx.receipt);
    expect(back.items).toEqual(tx.items);
    expect(back.items!.reduce((a, i) => a + itemPaid(i), 0)).toBe(63620);
  });

  it('transaksi manual tidak mengirim kolom struk', () => {
    const { receipt: _r, items: _i, ...manual } = tx;
    expect(Object.keys(fromTransaction({ ...manual, source: 'manual' }))).not.toContain('discounts');
  });

  const card = (receipt = tx.receipt!) => (
    <>
      <ReceiptCard title="Item belanja" items={tx.items!} currency="TRY" receipt={receipt} total={tx.amount} />
      <ReceiptDetailsCard receipt={receipt} />
    </>
  );
  const count = (s: string | RegExp) => screen.queryAllByText(s).length;

  it('tiap angka tampil sekali: harga bayar, harga awal dicoret, badge diskon, promo', async () => {
    await wrap(card());
    // Harga bayar per item.
    for (const v of ['₺129,90', '₺358,90', '₺54,95', '₺12,50', '₺79,95']) expect(count(v)).toBe(1);
    // Harga awal dicoret (Marvis tanpa diskon: harga awal tidak diulang).
    for (const v of ['₺259,90', '₺159,90', '₺15,95']) expect(count(v)).toBe(v === '₺159,90' ? 2 : 1);
    for (const v of ['−₺3,45', '−₺104,95', '−₺130,00', '−₺79,95']) expect(count(v)).toBe(1);
    for (const v of ['8.8 KAZANCI', 'AGUSTOS INSERT', 'KAZANC', '209.90 TL harcayana']) expect(count(v)).toBe(1);
    expect(count('20%')).toBe(2);
    expect(count('10%')).toBe(3);
    expect(count('₺954,55')).toBe(1);
    expect(count('−₺318,35')).toBe(1);
    expect(count('₺71,84')).toBe(1);
    expect(count('Pajak (termasuk)')).toBe(1);
    expect(count(/Cocok: subtotal dikurangi diskon/)).toBe(1);
    // Total tidak diulang di kartu (sudah di field Total / nominal detail); nama toko tidak diulang.
    expect(count('₺636,20')).toBe(0);
    expect(count(/WATSONS - CAROUSEL/)).toBe(0);
  });

  it('rincian pajak per tarif dan detail struk tertutup sampai diketuk', async () => {
    await wrap(card());
    expect(count('₺41,03')).toBe(0);
    expect(count('FinansBank')).toBe(0);
    await fireEvent.press(screen.getByRole('button', { name: 'Pajak (termasuk)' }));
    expect(count('₺41,03')).toBe(1);
    expect(count('₺30,81')).toBe(1);
    expect(count('10% dari ₺451,35')).toBe(1);
    expect(count('20% dari ₺184,85')).toBe(1);
    await fireEvent.press(screen.getByRole('button', { name: 'Detail struk' }));
    expect(count(/Carousel AVM No:21/)).toBe(1);
    expect(count('Anadolu KR. VD. 2120370364')).toBe(1);
    expect(count('0039')).toBe(1);
    expect(count('FinansBank')).toBe(1);
  });

  it('ketuk harga untuk ubah harga awal item', async () => {
    const onChange = jest.fn();
    await wrap(<ReceiptCard title="Item belanja" items={tx.items!} currency="TRY" receipt={tx.receipt} total={tx.amount} onChangeItemTotal={onChange} />);
    await fireEvent.press(screen.getByRole('button', { name: /Ubah harga HEAD&SHOULDERS/ }));
    await fireEvent.changeText(screen.getByDisplayValue('259,90'), '260,00');
    expect(onChange).toHaveBeenLastCalledWith(0, 26000);
  });

  it('total tidak cocok: status kuning dengan selisih', async () => {
    await wrap(card({ ...tx.receipt!, discountTotal: 0 }));
    expect(screen.getByText(/Selisih ₺318,35 dengan total belanja/)).toBeTruthy();
    expect(count(/Cocok:/)).toBe(0);
  });
});

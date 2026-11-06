import { PRICE_KEY_RE, runPriceSync, type PriceProvider } from '../../supabase/functions/_shared/asset-sync';
import { quoteMatches, tvCandidates } from '../../supabase/functions/_shared/tradingview-symbols';

import type { Asset, AssetPrice } from '@/data/assets';
import type { Debt } from '@/data/planning';
import { seedAccounts, seedTransactions } from '@/data/seed';
import type { Account } from '@/data/types';
import {
  changeSince, computeNetWorth, formatQuantity, gainOf, livePricesDown, parseQuantity, priceKeyOf, STALE_MS, TROY_OUNCE_GRAMS, valueAsset,
} from '@/lib/assets';
import { linePoints } from '@/lib/chart';
import { setUsdRates } from '@/lib/fx';
import { accountBalance, netWorth } from '@/lib/transactions';

const NOW = Date.parse('2026-11-14T10:00:00Z');
const fresh = new Date(NOW - 60_000).toISOString();
const old = new Date(NOW - STALE_MS - 60_000).toISOString();

const asset = (a: Partial<Asset> & Pick<Asset, 'type'>): Asset => ({ id: 'a', name: 'x', currency: 'IDR', createdAt: fresh, ...a, priceKey: a.priceKey ?? priceKeyOf(a.type, a.symbol) });
const price = (symbol: string, p: number, currency: string, fetchedAt = fresh): Record<string, AssetPrice> => ({ [symbol]: { symbol, price: p, currency, fetchedAt } });

beforeAll(() => setUsdRates({ USD: '1', IDR: '16000' }, '2026-11-14'));

describe('valueAsset: urutan sumber nilai', () => {
  const bbca = asset({ type: 'stock_id', symbol: 'BBCA', quantity: 100, buyPrice: 4800 });

  it('harga live: jumlah × harga terakhir, dengan waktu', () => {
    expect(valueAsset(bbca, price('IDX:BBCA', 5200, 'IDR'), NOW)).toMatchObject({ value: 520_000, currency: 'IDR', source: 'live', stale: false, fetchedAt: fresh });
  });
  it('harga lama ditandai basi tapi tetap dipakai', () => {
    expect(valueAsset(bbca, price('IDX:BBCA', 5200, 'IDR', old), NOW)).toMatchObject({ value: 520_000, source: 'live', stale: true });
  });
  it('nilai manual mengalahkan harga live', () => {
    expect(valueAsset({ ...bbca, valueOverride: 600_000 }, price('IDX:BBCA', 5200, 'IDR'), NOW)).toEqual({ value: 600_000, currency: 'IDR', source: 'manual' });
  });
  it('live belum pernah berhasil: jumlah × harga beli, diberi label', () => {
    expect(valueAsset(bbca, {}, NOW)).toEqual({ value: 480_000, currency: 'IDR', source: 'buy' });
  });
  it('tanpa harga live dan harga beli: belum ada nilai, bukan Rp 0', () => {
    expect(valueAsset({ ...bbca, buyPrice: undefined }, {}, NOW)).toEqual({ value: null, currency: 'IDR', source: 'none' });
  });
  it('emas: harga per troy ounce dikonversi ke gram', () => {
    const v = valueAsset(asset({ type: 'gold', symbol: 'XAU', quantity: 10 }), price('GOLD:XAU', 3110.34768, 'USD'), NOW);
    expect(v.unitPrice).toBeCloseTo(3110.34768 / TROY_OUNCE_GRAMS, 8);
    expect(v).toMatchObject({ value: 100_000, currency: 'USD' });
  });
  it('kripto dikutip USDT dihitung sebagai USD', () => {
    expect(valueAsset(asset({ type: 'crypto', symbol: 'BTC', quantity: 0.5 }), price('CRYPTO:BTC', 76039.51, 'USDT'), NOW)).toMatchObject({ value: 3_801_976, currency: 'USD' });
  });
});

describe('gainOf', () => {
  it('untung dalam mata uang aset, dari harga live yang dikonversi', () => {
    const a = asset({ type: 'stock_us', symbol: 'AAPL', quantity: 2, buyPrice: 30_000_00, currency: 'IDR' });
    const v = valueAsset(a, price('US:AAPL', 200, 'USD'), NOW);
    // 2 × $200 = $400 = Rp 6.400.000; modal 2 × Rp 3.000.000.
    expect(gainOf(a, v)).toEqual({ amount: 400_000, pct: 400_000 / 6_000_000 });
  });
  it('tidak ada untung/rugi bila nilai memakai harga beli itu sendiri', () => {
    const a = asset({ type: 'stock_id', symbol: 'BBCA', quantity: 1, buyPrice: 5000 });
    expect(gainOf(a, valueAsset(a, {}, NOW))).toBeNull();
  });
});

describe('computeNetWorth', () => {
  const withBalance = (list: Account[]) => list.map((a) => ({ ...a, balance: accountBalance(a, seedTransactions) }));

  it('tanpa aset dan utang sama persis dengan rumus Home lama (hanya akun)', () => {
    const nw = computeNetWorth({ accounts: withBalance(seedAccounts), assets: [], prices: {}, debts: [], main: 'IDR', now: NOW });
    expect(nw.total).toBe(netWorth(seedAccounts, seedTransactions, 'IDR'));
  });

  it('(rekening + aset + piutang) − (kartu kredit + utang aktif)', () => {
    const accounts = [
      { id: 'b', bank: 'bca', name: 'BCA', type: 'tabungan' as const, currency: 'IDR', openingBalance: 10_000_000, balance: 10_000_000 },
      { id: 'c', bank: 'bca', name: 'Visa', type: 'kartu_kredit' as const, currency: 'IDR', openingBalance: -2_000_000, balance: -2_000_000 },
    ];
    const debts: Debt[] = [
      { id: 'd1', kind: 'debt', counterparty: 'Budi', principal: 3_000_000, balance: 1_500_000, aprBp: 0, minPayment: 0, currency: 'IDR', status: 'active' },
      { id: 'd2', kind: 'debt', counterparty: 'Lunas', principal: 1_000_000, balance: 0, aprBp: 0, minPayment: 0, currency: 'IDR', status: 'paid' },
      { id: 'r1', kind: 'receivable', counterparty: 'Sari', principal: 500_000, balance: 500_000, aprBp: 0, minPayment: 0, currency: 'IDR', status: 'active' },
    ];
    const assets = [
      asset({ id: 'h', type: 'property', valueOverride: 900_000_000 }),
      asset({ id: 'g', type: 'gold', symbol: 'XAU', quantity: 10 }),
    ];
    const nw = computeNetWorth({ accounts, assets, prices: {}, debts, main: 'IDR', now: NOW });
    expect(nw).toMatchObject({ cash: 10_000_000, assets: 900_000_000, receivables: 500_000, credit: 2_000_000, debts: 1_500_000, unvalued: 1, unconverted: 0 });
    expect(nw.total).toBe(10_000_000 + 900_000_000 + 500_000 - 2_000_000 - 1_500_000);
    expect(nw.total).toBe(nw.assetsTotal - nw.liabilitiesTotal);
  });

  it('mata uang tanpa kurs dilewati dan dihitung', () => {
    const nw = computeNetWorth({ accounts: [], assets: [asset({ type: 'other', currency: 'XYZ', valueOverride: 1 })], prices: {}, debts: [], main: 'IDR', now: NOW });
    expect([nw.total, nw.unconverted]).toEqual([0, 1]);
  });
});

describe('riwayat dan banner', () => {
  it('changeSince memakai snapshot tertua dalam 30 hari, bukan hari ini', () => {
    const snaps = [
      { date: '2026-10-01', total: 1, assetsTotal: 1, liabilitiesTotal: 0, currency: 'IDR' },
      { date: '2026-10-20', total: 100, assetsTotal: 100, liabilitiesTotal: 0, currency: 'IDR' },
      { date: '2026-11-14', total: 999, assetsTotal: 999, liabilitiesTotal: 0, currency: 'IDR' },
    ];
    expect(changeSince(snaps, 250, '2026-11-14', 'IDR')).toEqual({ amount: 150, since: '2026-10-20' });
    expect(changeSince(snaps, 250, '2026-11-14', 'USD')).toBeNull();
  });
  it('banner muncul hanya bila semua aset live tanpa harga segar', () => {
    const live = [asset({ id: '1', type: 'stock_id', symbol: 'BBCA', quantity: 1 }), asset({ id: '2', type: 'crypto', symbol: 'BTC', quantity: 1 })];
    expect(livePricesDown(live, {}, NOW)).toBe(true);
    expect(livePricesDown(live, price('IDX:BBCA', 1, 'IDR', old), NOW)).toBe(true);
    expect(livePricesDown(live, price('IDX:BBCA', 1, 'IDR'), NOW)).toBe(false);
    expect(livePricesDown([asset({ type: 'property', valueOverride: 1 })], {}, NOW)).toBe(false);
  });
});

describe('input dan tampilan jumlah', () => {
  it('parseQuantity menerima koma atau titik desimal, menolak sisanya', () => {
    expect(['0,5', '0.5', '100', '0.0000001', '1 000'].map(parseQuantity)).toEqual([0.5, 0.5, 100, 0.0000001, 1000]);
    expect(['', '0', '-1', '1,2,3', 'abc', '1.12345678901'].map(parseQuantity)).toEqual([null, null, null, null, null, null]);
  });
  it('formatQuantity: pemisah per bahasa, tanpa notasi ilmiah', () => {
    expect(formatQuantity(1250.5, 'id')).toBe('1.250,5');
    expect(formatQuantity(1250.5, 'en')).toBe('1,250.5');
    expect(formatQuantity(0.0000001, 'en')).toBe('0.0000001');
    expect(formatQuantity(100, 'id')).toBe('100');
  });
  it('kunci harga cermin kolom price_key dan pola server', () => {
    expect(['stock_id', 'stock_us', 'crypto', 'gold'].map((t) => priceKeyOf(t as Asset['type'], 'X1'))).toEqual(['IDX:X1', 'US:X1', 'CRYPTO:X1', 'GOLD:X1']);
    expect(priceKeyOf('property', 'X')).toBeUndefined();
    expect(PRICE_KEY_RE.test('IDX:BBCA') && !PRICE_KEY_RE.test('NASDAQ:AAPL')).toBe(true);
  });
  it('linePoints: kiri ke kanan, nilai terbesar di atas, garis datar di tengah', () => {
    expect(linePoints([0, 10], 100, 50, 5)).toEqual([{ x: 0, y: 45 }, { x: 100, y: 5 }]);
    expect(linePoints([3, 3, 3], 100, 50).map((p) => p.y)).toEqual([25, 25, 25]);
  });
});

describe('runPriceSync', () => {
  const at = new Date('2026-11-14T10:00:00Z');
  const provider = (quotes: Record<string, { price: number; currency: string }>): PriceProvider => ({ name: 'uji', fetch: async () => ({ quotes }) });

  it('satu kode gagal tidak menggagalkan yang lain', async () => {
    const r = await runPriceSync(['IDX:BBCA', 'US:AAPL', 'IDX:BBCA', 'NASDAQ:BAD'], provider({ 'IDX:BBCA': { price: 5200, currency: 'IDR' } }), at);
    expect(r.rows).toEqual([{ symbol: 'IDX:BBCA', price: 5200, currency: 'IDR', source: 'uji', fetched_at: at.toISOString() }]);
    expect(r.failed).toEqual(['US:AAPL']);
  });
  it('USDT disimpan sebagai USD; harga tidak valid ditolak', async () => {
    const r = await runPriceSync(['CRYPTO:BTC', 'GOLD:XAU'], provider({ 'CRYPTO:BTC': { price: 76000, currency: 'USDT' }, 'GOLD:XAU': { price: 0, currency: 'USD' } }), at);
    expect(r.rows.map((x) => [x.symbol, x.currency])).toEqual([['CRYPTO:BTC', 'USD']]);
    expect(r.failed).toEqual(['GOLD:XAU']);
  });
  it('penyedia mati total: semua gagal, tidak ada baris yang ditimpa', async () => {
    const dead: PriceProvider = { name: 'uji', fetch: async () => { throw new Error('protocol_changed'); } };
    expect(await runPriceSync(['IDX:BBCA'], dead, at)).toEqual({ rows: [], failed: ['IDX:BBCA'], error: 'protocol_changed' });
  });
});

describe('simbol TradingView', () => {
  it('kunci netral -> simbol yang diverifikasi', () => {
    expect(['IDX:BBCA', 'US:AAPL', 'CRYPTO:BTC', 'GOLD:XAU', 'GOLD:XAG', 'FOO:X'].map(tvCandidates)).toEqual([
      ['IDX:BBCA'], ['AAPL'], ['BINANCE:BTCUSDT'], ['OANDA:XAUUSD', 'TVC:GOLD'], [], [],
    ]);
  });
  it('hasil dari pasar atau mata uang lain ditolak', () => {
    expect(quoteMatches('US:AAPL', 'NASDAQ:AAPL', 'USD')).toBe(true);
    expect(quoteMatches('US:BBCA', 'CBOE:BBCA', 'USD')).toBe(true);
    expect(quoteMatches('US:XYZ', 'LSE:XYZ', 'GBP')).toBe(false);
    expect(quoteMatches('IDX:BBCA', 'IDX:BBCA', 'IDR')).toBe(true);
    expect(quoteMatches('CRYPTO:BTC', 'BINANCE:BTCUSDT', 'USDT')).toBe(true);
    expect(quoteMatches('GOLD:XAU', 'OANDA:XAUUSD', 'EUR')).toBe(false);
  });
});

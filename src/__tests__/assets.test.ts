import { chainProvider, fromUnix, PRICE_KEY_RE, quoteTime, runPriceSync, syncInBatches, type PriceProvider, type ProviderRun, type SourcedProvider } from '../../supabase/functions/_shared/asset-sync';
import { coinGeckoProvider } from '../../supabase/functions/_shared/price-coingecko';
import { goldProvider } from '../../supabase/functions/_shared/price-gold';
import { yahooIdxProvider, yahooMatches, yahooSymbol, yahooUsProvider } from '../../supabase/functions/_shared/price-yahoo';
import { quoteMatches, tvCandidates } from '../../supabase/functions/_shared/tradingview-symbols';

import type { Asset, AssetPrice } from '@/data/assets';
import type { Debt } from '@/data/planning';
import { seedAccounts, seedTransactions } from '@/data/seed';
import type { Account } from '@/data/types';
import {
  changeSince, chartSymbol, computeNetWorth, convertSnapshot, portfolioGain, portfolioMovers, snapshotTrend, formatQuantity, gainOf, livePricesDown, parseQuantity, priceKeyOf, STALE_MS, SYMBOL_RE, TROY_OUNCE_GRAMS, valuationIn, valueAsset,
} from '@/lib/assets';
import { CHART_RANGES, chartHtml, chartWidgetUrl, DATE_RANGES } from '@/features/assets/chartHtml';
import { datedLinePoints, linePoints } from '@/lib/chart';
import { setUsdRates, tryConvert, tryConvertMajor } from '@/lib/fx';
import { formatUnitPrice } from '@/lib/money';
import { accountBalance } from '@/lib/transactions';

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

  it('tanpa aset dan utang = jumlah saldo rekening yang dikonversi (tanpa kurs = tidak dihitung)', () => {
    const nw = computeNetWorth({ accounts: withBalance(seedAccounts), assets: [], prices: {}, debts: [], main: 'IDR', now: NOW });
    expect(nw.total).toBe(seedAccounts.reduce((s, a) => s + (tryConvert(accountBalance(a, seedTransactions), a.currency, 'IDR') ?? 0), 0));
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
  it('changeSince memakai snapshot tertua dalam 30 hari, bukan hari ini, dan mengonversi lintas mata uang', () => {
    const snaps = [
      { date: '2026-10-01', total: 1, assetsTotal: 1, liabilitiesTotal: 0, currency: 'IDR' },
      { date: '2026-10-20', total: 1_600_000, assetsTotal: 1_600_000, liabilitiesTotal: 0, currency: 'IDR' },
      { date: '2026-11-14', total: 999, assetsTotal: 999, liabilitiesTotal: 0, currency: 'IDR' },
    ];
    expect(changeSince(snaps, 2_500_000, '2026-11-14', 'IDR')).toEqual({ amount: 900_000, since: '2026-10-20' });
    // IDR 1.600.000 -> $100.00 (10_000 sen) saat queried di USD memakai kurs aktif (FR-FX-4).
    expect(changeSince(snaps, 12_500, '2026-11-14', 'USD')).toEqual({ amount: 2_500, since: '2026-10-20' });
    // Mata uang tanpa kurs -> null.
    expect(changeSince(snaps, 250, '2026-11-14', 'XYZ')).toBeNull();
  });
  it('snapshotTrend: deret 30 hari + nilai hari ini, delta vs titik tertua, konversi lintas mata uang', () => {
    const snaps = [
      { date: '2026-10-01', total: 0, assetsTotal: 1, liabilitiesTotal: 0, currency: 'IDR' },
      { date: '2026-10-20', total: 1_600_000, assetsTotal: 1_600_000, liabilitiesTotal: 0, currency: 'IDR' },
      { date: '2026-11-01', total: 1_920_000, assetsTotal: 1_920_000, liabilitiesTotal: 800_000, currency: 'IDR' },
      { date: '2026-11-14', total: 0, assetsTotal: 999, liabilitiesTotal: 999, currency: 'IDR' },
    ];
    expect(snapshotTrend(snaps, 'assetsTotal', 2_400_000, '2026-11-14', 'IDR')).toEqual({ series: [1_600_000, 1_920_000, 2_400_000], change: 0.5 });
    // Pembanding 0 → tanpa delta, bukan +∞%.
    expect(snapshotTrend(snaps, 'liabilitiesTotal', 640_000, '2026-11-14', 'IDR').change).toBeNull();
    // Konversi IDR -> USD ($100.00, $120.00, $150.00 -> +50%).
    expect(snapshotTrend(snaps, 'assetsTotal', 15_000, '2026-11-14', 'USD')).toEqual({ series: [10_000, 12_000, 15_000], change: 0.5 });
    // Tanpa kurs -> hanya titik hari ini, tanpa delta.
    expect(snapshotTrend(snaps, 'assetsTotal', 150, '2026-11-14', 'XYZ')).toEqual({ series: [150], change: null });
    expect(convertSnapshot(snaps[1]!, 'USD')).toEqual({ date: '2026-10-20', total: 10_000, assetsTotal: 10_000, liabilitiesTotal: 0, currency: 'USD' });
    expect(convertSnapshot(snaps[1]!, 'XYZ')).toBeNull();
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
    expect(['0,5', '0.5', '100', '0.0000001', '1 000'].map((s) => parseQuantity(s))).toEqual([0.5, 0.5, 100, 0.0000001, 1000]);
    expect(['', '0', '-1', '1,2,3', 'abc', '1.12345678901'].map((s) => parseQuantity(s))).toEqual([null, null, null, null, null, null]);
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
  it('linePoints: kiri ke kanan, nilai terbesar di atas, garis datar di tengah, minSpan cegah jurang palsu', () => {
    expect(linePoints([0, 10], 100, 50, 5)).toEqual([{ x: 0, y: 45 }, { x: 100, y: 5 }]);
    expect(linePoints([3, 3, 3], 100, 50).map((p) => p.y)).toEqual([25, 25, 25]);
    // Perubahan +Rp 500 pada Rp 50 jt dengan minSpan 2% (1 jt): selisih vertikal sangat kecil, bukan penuh tinggi grafik.
    const subtle = linePoints([50_000_000, 50_000_500], 200, 120, 8, 1_000_000);
    expect(Math.abs(subtle[0]!.y - subtle[1]!.y)).toBeLessThan(1);
    expect(subtle[0]!.y).toBeGreaterThan(59);
    expect(subtle[1]!.y).toBeLessThan(61);
  });
  it('datedLinePoints: posisi X proporsional terhadap jarak tanggal', () => {
    const d1 = Date.parse('2026-11-01T00:00:00Z');
    const d2 = Date.parse('2026-11-02T00:00:00Z');
    const d11 = Date.parse('2026-11-11T00:00:00Z');
    const pts = datedLinePoints(
      [
        { dayMs: d1, value: 100 },
        { dayMs: d2, value: 150 },
        { dayMs: d11, value: 200 },
      ],
      108,
      100,
      4,
      10,
    );
    expect(pts[0]).toEqual({ x: 4, y: 90 });
    expect(pts[1]!.x).toBeCloseTo(14, 5);
    expect(pts[1]!.y).toBeCloseTo(50, 5);
    expect(pts[2]).toEqual({ x: 104, y: 10 });
    expect(datedLinePoints([{ dayMs: d1, value: 100 }], 100, 50)).toEqual([{ x: 50, y: 25 }]);
  });
});

describe('runPriceSync', () => {
  const at = new Date('2026-11-14T10:00:00Z');
  const provider = (quotes: Record<string, { price: number; currency: string }>): PriceProvider => ({ name: 'uji', fetch: async () => ({ quotes }) });

  it('satu kode gagal tidak menggagalkan yang lain', async () => {
    const r = await runPriceSync(['IDX:BBCA', 'US:AAPL', 'IDX:BBCA', 'NASDAQ:BAD'], provider({ 'IDX:BBCA': { price: 5200, currency: 'IDR' } }), at);
    expect(r.rows).toEqual([{ symbol: 'IDX:BBCA', price: 5200, currency: 'IDR', source: 'uji', fetched_at: at.toISOString(), quoted_at: null }]);
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

describe('syncInBatches (audit 7)', () => {
  const at = new Date('2026-11-14T10:00:00Z');
  // 1.250 kunci: lebih dari batas 1000 baris PostgREST yang dulu memotong daftar.
  const keys = Array.from({ length: 1250 }, (_, i) => `IDX:S${i}`);
  const all: PriceProvider = { name: 'uji', fetch: async (ks) => ({ quotes: Object.fromEntries(ks.map((k) => [k, { price: 100, currency: 'IDR' }])) }) };

  it('semua kunci diproses, disimpan per potongan 200 (bukan sekali di akhir)', async () => {
    const saved: number[] = [];
    const r = await syncInBatches(keys, all, at, async (rows) => void saved.push(rows.length));
    expect(r).toEqual({ updated: 1250, failed: [] });
    expect(saved).toEqual([200, 200, 200, 200, 200, 200, 50]);
  });

  it('satu potongan gagal di penyedia: potongan lain tetap tersimpan, error dicatat', async () => {
    let call = 0;
    const flaky: PriceProvider = { name: 'uji', fetch: async (ks) => (++call === 2 ? Promise.reject(new Error('timeout')) : all.fetch(ks)) };
    const saved: number[] = [];
    const r = await syncInBatches(keys.slice(0, 450), flaky, at, async (rows) => void saved.push(rows.length));
    expect(saved).toEqual([200, 50]);
    expect(r.updated).toBe(250);
    expect(r.failed).toHaveLength(200);
    expect(r.error).toBe('timeout');
  });

  it('penyimpanan gagal: berhenti dengan error; potongan sebelumnya sudah tersimpan', async () => {
    const saved: number[] = [];
    const save = async (rows: unknown[]) => {
      if (saved.length === 1) throw new Error('asset_prices_500');
      saved.push(rows.length);
    };
    await expect(syncInBatches(keys, all, at, save)).rejects.toThrow('asset_prices_500');
    expect(saved).toEqual([200]);
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

describe('rantai penyedia harga (Live Market v2 Fase 1)', () => {
  const at = new Date('2026-11-14T10:00:00Z');
  const fixed = (name: string, prefix: string, quotes: Record<string, { price: number; currency: string }>): SourcedProvider => ({
    name, handles: (k) => k.startsWith(prefix), fetch: async () => ({ quotes }),
  });

  it('satu sumber mati tidak mematikan yang lain; cadangan hanya untuk kunci yang tersisa', async () => {
    const runs: ProviderRun[] = [];
    const seen: string[][] = [];
    const dead: SourcedProvider = { name: 'yahoo-us', handles: (k) => k.startsWith('US:'), fetch: async () => { throw new Error('http_429'); } };
    const tv: PriceProvider = { name: 'tradingview', fetch: async (ks) => { seen.push(ks); return { quotes: { 'US:AAPL': { price: 342, currency: 'USD' } } }; } };
    let t = 0;
    const chain = chainProvider([fixed('yahoo-idx', 'IDX:', { 'IDX:BBCA': { price: 5200, currency: 'IDR' } }), dead], tv, runs, () => (t += 5));
    const r = await runPriceSync(['IDX:BBCA', 'US:AAPL', 'CRYPTO:ZZZ'], chain, at);
    expect(r.rows.map((x) => [x.symbol, x.source])).toEqual([['IDX:BBCA', 'yahoo-idx'], ['US:AAPL', 'tradingview']]);
    expect(r.failed).toEqual(['CRYPTO:ZZZ']);
    expect(seen).toEqual([['CRYPTO:ZZZ', 'US:AAPL']]);
    expect(runs.map((x) => [x.source, x.symbols, x.updated, x.failed, x.error ?? null])).toEqual([
      ['yahoo-idx', 1, 1, [], null],
      ['yahoo-us', 1, 0, ['US:AAPL'], 'http_429'],
      ['tradingview', 2, 1, ['CRYPTO:ZZZ'], null],
    ]);
    expect(runs.every((x) => x.durationMs > 0)).toBe(true);
  });

  it('harga tidak valid dari sumber utama diteruskan ke cadangan; run dijumlahkan lintas potongan', async () => {
    const runs: ProviderRun[] = [];
    const bad = fixed('gold-api', 'GOLD:', { 'GOLD:XAU': { price: 0, currency: 'USD' } });
    const tv: PriceProvider = { name: 'tradingview', fetch: async () => ({ quotes: { 'GOLD:XAU': { price: 4070, currency: 'USD' } } }) };
    const r = await syncInBatches(['GOLD:XAU', 'GOLD:XAU'], chainProvider([bad], tv, runs), at, async () => undefined, 1);
    expect(r).toEqual({ updated: 2, failed: [] });
    expect(runs.map((x) => [x.source, x.symbols, x.updated])).toEqual([['gold-api', 2, 0], ['tradingview', 2, 2]]);
  });
});

describe('penyedia harga per sumber (fetch dipalsukan)', () => {
  const realFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = realFetch; });
  const respond = (handler: (url: string) => { status?: number; body?: unknown }) => {
    const urls: string[] = [];
    globalThis.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      urls.push(url);
      const { status = 200, body } = handler(url);
      return { ok: status < 300, status, json: async () => body } as Response;
    });
    return urls;
  };

  it('CoinGecko: satu permintaan untuk semua id, kode tak dikenal tidak ditangani', async () => {
    const urls = respond(() => ({ body: { bitcoin: { usd: 76000, last_updated_at: 1794045189 }, ethereum: { usd: 2244.5 } } }));
    expect(coinGeckoProvider.handles('CRYPTO:BTC')).toBe(true);
    expect(coinGeckoProvider.handles('CRYPTO:ZZZ')).toBe(false);
    const { quotes } = await coinGeckoProvider.fetch(['CRYPTO:BTC', 'CRYPTO:ETH']);
    expect(quotes).toEqual({
      'CRYPTO:BTC': { price: 76000, currency: 'USD', quotedAt: new Date(1794045189 * 1000).toISOString() },
      'CRYPTO:ETH': { price: 2244.5, currency: 'USD', quotedAt: undefined },
    });
    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain('ids=bitcoin,ethereum');
  });

  it('Yahoo: simbol .JK / tanda hubung, bursa lain ditolak, host kedua dicoba saat host pertama error', async () => {
    expect(['US:AAPL', 'US:BRK.B', 'IDX:BBCA', 'CRYPTO:BTC'].map(yahooSymbol)).toEqual(['AAPL', 'BRK-B', 'BBCA.JK', null]);
    const urls = respond((url) => {
      if (url.includes('query1') && url.includes('AAPL')) return { status: 503 };
      if (url.includes('AAPL')) return { body: { chart: { result: [{ meta: { regularMarketPrice: 342.37, currency: 'USD', exchangeName: 'NMS', instrumentType: 'EQUITY', regularMarketTime: 1793998801 } }] } } };
      return { body: { chart: { result: [{ meta: { regularMarketPrice: 9, currency: 'GBP', instrumentType: 'EQUITY' } }] } } };
    });
    const { quotes } = await yahooUsProvider.fetch(['US:AAPL', 'US:XYZ']);
    expect(quotes).toEqual({ 'US:AAPL': { price: 342.37, currency: 'USD', quotedAt: new Date(1793998801 * 1000).toISOString() } });
    // XYZ tidak cocok: tidak diulang ke host kedua.
    expect(urls.filter((u) => u.includes('XYZ'))).toHaveLength(1);
    expect(yahooMatches('IDX', { regularMarketPrice: 5200, currency: 'IDR', exchangeName: 'JKT' })).toBe(true);
    expect(yahooMatches('IDX', { regularMarketPrice: 5200, currency: 'IDR', exchangeName: 'XXX' })).toBe(false);
    expect(yahooMatches('US', { regularMarketPrice: 1.2, currency: 'USD', exchangeName: 'PNK', instrumentType: 'EQUITY' })).toBe(false);
  });

  it('Yahoo diblokir untuk semua simbol: error run (bukan diam)', async () => {
    respond(() => ({ status: 429 }));
    await expect(yahooIdxProvider.fetch(['IDX:BBCA'])).rejects.toThrow('IDX:BBCA: http_429');
  });

  it('emas: USD per troy ounce; payload aneh ditolak', async () => {
    respond(() => ({ body: { price: 4072.1, currency: 'USD', updatedAt: '2026-11-07T09:53:06Z' } }));
    expect(await goldProvider.fetch(['GOLD:XAU'])).toEqual({ quotes: { 'GOLD:XAU': { price: 4072.1, currency: 'USD', quotedAt: '2026-11-07T09:53:06Z' } } });
    respond(() => ({ body: { price: '4072', currency: 'USD' } }));
    await expect(goldProvider.fetch(['GOLD:XAU'])).rejects.toThrow('bad_payload');
  });
});

describe('waktu quote jujur (Live Market v2 Fase 2)', () => {
  const at = new Date('2026-11-07T10:08:32Z');

  it('quoted_at = waktu penyedia, terpisah dari fetched_at; masa depan dipotong, sampah = null', async () => {
    const idx = '2026-11-06T09:14:59.000Z';
    const r = await runPriceSync(['IDX:BBCA', 'US:AAPL', 'CRYPTO:BTC'], {
      name: 'uji',
      fetch: async () => ({ quotes: {
        'IDX:BBCA': { price: 5200, currency: 'IDR', quotedAt: idx },
        'US:AAPL': { price: 342, currency: 'USD', quotedAt: '2026-11-07T11:00:00Z' },
        'CRYPTO:BTC': { price: 76000, currency: 'USD', quotedAt: 'bukan tanggal' },
      } }),
    }, at);
    expect(r.rows.map((x) => [x.symbol, x.fetched_at, x.quoted_at])).toEqual([
      ['CRYPTO:BTC', at.toISOString(), null],
      ['IDX:BBCA', at.toISOString(), idx],
      ['US:AAPL', at.toISOString(), at.toISOString()],
    ]);
    expect(quoteTime(undefined, at)).toBeNull();
    expect(fromUnix(1793956499)).toBe('2026-11-06T09:14:59.000Z');
    expect(fromUnix(null)).toBeUndefined();
  });

  it('rantai meneruskan waktu quote dari penyedia yang menang', async () => {
    const runs: ProviderRun[] = [];
    const yahoo: SourcedProvider = { name: 'yahoo-idx', handles: () => true, fetch: async () => ({ quotes: { 'IDX:BBCA': { price: 5200, currency: 'IDR', quotedAt: '2026-11-06T09:14:59Z' } } }) };
    const r = await runPriceSync(['IDX:BBCA'], chainProvider([yahoo], null, runs), at);
    expect(r.rows[0]).toMatchObject({ source: 'yahoo-idx', quoted_at: '2026-11-06T09:14:59.000Z' });
  });

  it('portofolio: hanya aset harga live yang punya harga beli, dikonversi ke mata uang utama', () => {
    const fresh = new Date(NOW).toISOString();
    const bbca: Asset = { id: 'b', type: 'stock_id', symbol: 'BBCA', name: 'BBCA', quantity: 100, buyPrice: 4800, currency: 'IDR', priceKey: 'IDX:BBCA', createdAt: fresh };
    const aapl: Asset = { id: 'a', type: 'stock_us', symbol: 'AAPL', name: 'Apple', quantity: 23, currency: 'USD', priceKey: 'US:AAPL', createdAt: fresh };
    const prices: Record<string, AssetPrice> = {
      'IDX:BBCA': { symbol: 'IDX:BBCA', price: 5200, currency: 'IDR', fetchedAt: fresh },
      'US:AAPL': { symbol: 'US:AAPL', price: 342.37, currency: 'USD', fetchedAt: fresh },
    };
    // AAPL tanpa harga beli tidak ikut; BBCA 100 × 5.200 vs 100 × 4.800.
    expect(portfolioGain([bbca, aapl], prices, NOW, 'IDR')).toEqual({ value: 520_000, pct: 400 / 4800 });
    // Tanpa harga live: harga beli tidak dihitung sebagai untung/rugi.
    expect(portfolioGain([bbca], {}, NOW, 'IDR')).toBeNull();
  });
});

describe('grafik TradingView (Live Market v2 Fase 3)', () => {
  it('simbol mengikuti tabel §4', () => {
    const at = (type: Asset['type'], symbol?: string) => chartSymbol({ type, symbol });
    expect([at('stock_id', 'BBCA'), at('stock_us', 'AAPL'), at('stock_us', 'BRK.B'), at('crypto', 'BTC'), at('crypto', 'USDT'), at('gold', 'XAU'), at('property')]).toEqual([
      'IDX:BBCA', 'AAPL', 'BRK.B', 'BINANCE:BTCUSDT', null, 'OANDA:XAUUSD', null,
    ]);
  });

  it('HTML widget resmi: tema dan warna dari token, kontrol dimatikan, JSON tidak bisa menutup <script>', () => {
    const html = chartHtml('IDX:BBCA', { scheme: 'dark', background: '#121214', grid: 'rgba(255, 255, 255, 0.06)', line: '#A3A3A3', fill: 'rgba(255, 255, 255, 0.14)', text: '#8F8F8F' }, 'ms');
    expect(html).toContain('https://s3.tradingview.com/external-embedding/embed-widget-symbol-overview.js');
    const json = JSON.parse(html.slice(html.indexOf('async onerror="tvFail()">') + 25, html.lastIndexOf('</script>')));
    expect(json).toMatchObject({
      symbols: [['IDX:BBCA', 'IDX:BBCA|3M']],
      dateRanges: ['1m|1D', '3m|1D', '12m|1D', '60m|1W', 'all|1M'],
      fontFamily: 'Plus Jakarta Sans, -apple-system, sans-serif',
      chartOnly: true, colorTheme: 'dark', locale: 'ms_MY',
      backgroundColor: '#121214', gridLineColor: 'rgba(255, 255, 255, 0.06)', lineColor: '#A3A3A3', topColor: 'rgba(255, 255, 255, 0.14)', fontColor: '#8F8F8F',
    });
    const evil = chartHtml('</script><script>alert(1)</script>', { scheme: 'light', background: '#FFFFFF', grid: '#000', line: '#000', fill: '#000', text: '#000' }, 'id');
    expect(evil.match(/<\/script>/g)).toHaveLength(2);
  });

  it('chartWidgetUrl: cross-origin langsung, ?locale=id vs #hash id_ID, dateRanges huruf kecil, semua rentang', () => {
    const theme = { scheme: 'dark' as const, background: '#121214', grid: 'rgba(255, 255, 255, 0.06)', line: '#A3A3A3', fill: 'rgba(255, 255, 255, 0.14)', text: '#8F8F8F' };
    expect(DATE_RANGES).toEqual(['1m|1D', '3m|1D', '12m|1D', '60m|1W', 'all|1M']);
    for (const range of CHART_RANGES) {
      const url = chartWidgetUrl('IDX:BBCA', theme, 'id', range);
      expect(url.startsWith('https://www.tradingview-widget.com/embed-widget/symbol-overview/?locale=id#')).toBe(true);
      const parsed = JSON.parse(decodeURIComponent(url.split('#')[1]!));
      expect(parsed).toMatchObject({
        symbols: [['IDX:BBCA', `IDX:BBCA|${range}`]],
        dateRanges: ['1m|1D', '3m|1D', '12m|1D', '60m|1W', 'all|1M'],
        locale: 'id_ID',
        fontFamily: 'Plus Jakarta Sans, -apple-system, sans-serif',
        colorTheme: 'dark',
      });
    }
    expect(chartWidgetUrl('AAPL', { ...theme, scheme: 'light' }, 'en', '1M')).toContain('?locale=en#');
    expect(chartWidgetUrl('AAPL', theme, 'ms', '12M')).toContain('?locale=ms_MY#');
    expect(chartWidgetUrl('AAPL', theme, 'tr', 'ALL')).toContain('?locale=tr#');
  });
});

describe('akurasi harga sub-sen, konversi pra-FX, parseQuantity lokal, dan SYMBOL_RE (Paket 1 P0)', () => {
  it('formatUnitPrice menjaga presisi kripto sub-sen tanpa membulatkan ke $0.00', () => {
    expect(formatUnitPrice(0.00000363, 'USD')).toBe('$0.00000363');
    expect(formatUnitPrice(0.056385, 'USD')).toBe('$0.05639');
    expect(formatUnitPrice(0.5, 'USD')).toBe('$0.50');
    expect(formatUnitPrice(342.37, 'USD')).toBe('$342.37');
    expect(formatUnitPrice(5200, 'IDR')).toBe('Rp 5.200');
    expect(formatUnitPrice(12.5, 'IDR')).toBe('Rp 12,5');
    expect(formatUnitPrice(0, 'USD')).toBe('$0.00');
    expect(formatUnitPrice(Number.NaN, 'USD')).toBe('$0.00');
  });

  it('valuationIn, tryConvertMajor, computeNetWorth, dan portfolioMovers tidak kehilangan nilai kripto kecil pra-FX', () => {
    const shib = asset({ id: 'shib', type: 'crypto', symbol: 'SHIB', name: 'Shiba Inu', quantity: 1000, currency: 'USD' });
    const shibPrice = price('CRYPTO:SHIB', 0.00000363, 'USD');
    const v = valueAsset(shib, shibPrice, NOW);
    // 1.000 × $0,00000363 = $0,00363 -> dalam sen USD = 0, tapi pra-FX × Rp 16.000 = Rp 58 (bukan Rp 0).
    expect(v.value).toBe(0);
    expect(v.majorValue).toBeCloseTo(0.00363, 10);
    expect(valuationIn(v, 'IDR')).toBe(58);
    expect(tryConvertMajor(0.00363, 'USD', 'IDR')).toBe(58);
    const nw = computeNetWorth({ accounts: [], assets: [shib], prices: shibPrice, debts: [], main: 'IDR', now: NOW });
    expect(nw.assets).toBe(58);
    expect(nw.total).toBe(58);
    const movers = portfolioMovers([shib], shibPrice, { 'CRYPTO:SHIB': [{ day: '2026-11-01', price: 0.00000263, currency: 'USD' }] }, NOW, 'IDR');
    expect(movers?.total).toBe(16);
  });

  it('buyPrice === 0 tidak menghasilkan Rp 0 palsu atau untung/rugi palsu', () => {
    const zeroBuy = asset({ type: 'stock_id', symbol: 'BBCA', quantity: 100, buyPrice: 0 });
    expect(valueAsset(zeroBuy, {}, NOW)).toEqual({ value: null, currency: 'IDR', source: 'none' });
    const liveVal = valueAsset(zeroBuy, price('IDX:BBCA', 5200, 'IDR'), NOW);
    expect(gainOf(zeroBuy, liveVal)).toBeNull();
    expect(portfolioGain([zeroBuy], price('IDX:BBCA', 5200, 'IDR'), NOW, 'IDR')).toBeNull();
  });

  it('parseQuantity sadar bahasa untuk ribuan vs desimal, dan membatasi nilai terlalu besar', () => {
    expect(parseQuantity('10.000', 'id')).toBe(10_000);
    expect(parseQuantity('10.000', 'tr')).toBe(10_000);
    expect(parseQuantity('1.250', 'id')).toBe(1250);
    expect(parseQuantity('1.250', 'en')).toBe(1.25);
    expect(parseQuantity('10,000', 'en')).toBe(10_000);
    expect(parseQuantity('10,000', 'ms')).toBe(10_000);
    expect(parseQuantity('0.125', 'id')).toBe(0.125);
    expect(parseQuantity('0.125', 'en')).toBe(0.125);
    expect(parseQuantity('1.000.000')).toBe(1_000_000);
    expect(parseQuantity('1.250,5')).toBe(1250.5);
    expect(parseQuantity('1,250.5')).toBe(1250.5);
    expect(parseQuantity('1e20')).toBeNull();
    expect(parseQuantity('999999999999999999')).toBeNull();
  });

  it('SYMBOL_RE dan PRICE_KEY_RE menolak titik di pinggir/ganda, menerima kode valid', () => {
    for (const ok of ['BBCA', 'BRK.B', 'BTC', 'A1.B2']) {
      expect(SYMBOL_RE.test(ok)).toBe(true);
      expect(PRICE_KEY_RE.test(`US:${ok}`)).toBe(true);
    }
    for (const bad of ['.AAPL', 'AAPL.', 'BRK..B', '.', '..', 'ABCDEFGHIJKLMNOP']) {
      expect(SYMBOL_RE.test(bad)).toBe(false);
      expect(PRICE_KEY_RE.test(`US:${bad}`)).toBe(false);
    }
  });
});

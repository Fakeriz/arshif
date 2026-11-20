import { PriceAskRequest } from '../../supabase/functions/_shared/contracts';
import { historyRows } from '../../supabase/functions/_shared/asset-sync';
import { normalizePrice } from '../../supabase/functions/_shared/normalize';
import { pricePrompt } from '../../supabase/functions/_shared/prompts';
import type { Asset, AssetPrice, PricePoint } from '@/data/assets';
import { parsePct } from '@/features/assets/PriceAlertCard';
import { setUsdRates } from '@/lib/fx';
import { portfolioMovers, priceAskInput } from '@/lib/assets';

const NOW = Date.parse('2026-11-14T10:00:00Z');
beforeAll(() => setUsdRates({ USD: '1', IDR: '16000' }, '2026-11-14'));
const at = new Date(NOW).toISOString();
const bbca: Asset = { id: 'b', type: 'stock_id', symbol: 'BBCA', name: 'Bank Central Asia', quantity: 100, buyPrice: 4800, currency: 'IDR', priceKey: 'IDX:BBCA', createdAt: at, notes: 'rahasia' };
const aapl: Asset = { id: 'a', type: 'stock_us', symbol: 'AAPL', name: 'Apple', quantity: 2, buyPrice: 30000, currency: 'USD', priceKey: 'US:AAPL', createdAt: at };
const gold: Asset = { id: 'g', type: 'gold', symbol: 'XAU', name: 'Emas', quantity: 10, buyPrice: 1_500_000, currency: 'IDR', priceKey: 'GOLD:XAU', createdAt: at };
const prices: Record<string, AssetPrice> = {
  'IDX:BBCA': { symbol: 'IDX:BBCA', price: 5200, currency: 'IDR', fetchedAt: at },
  'US:AAPL': { symbol: 'US:AAPL', price: 342.37, currency: 'USD', fetchedAt: at },
  'GOLD:XAU': { symbol: 'GOLD:XAU', price: 4072.1, currency: 'USD', fetchedAt: at },
};

describe('Tanya harga wajar: hanya angka ringkasan (FR-COACH-4)', () => {
  it('BBCA: kode, pasar, harga live, harga beli, perubahan %; tanpa nama, jumlah, catatan', () => {
    const input = priceAskInput(bbca, prices, NOW)!;
    expect(input).toEqual({ market: 'IDX', symbol: 'BBCA', currency: 'IDR', livePrice: 5200, buyPrice: 4800, changePct: 8.3 });
    expect(PriceAskRequest.safeParse({ lang: 'id', asset: input }).success).toBe(true);
  });
  it('harga beli USD dari unit minor ke unit besar; emas (per gram vs per ons) tanpa harga beli', () => {
    expect(priceAskInput(aapl, prices, NOW)).toMatchObject({ currency: 'USD', livePrice: 342.37, buyPrice: 300, changePct: 14.1 });
    expect(priceAskInput(gold, prices, NOW)).toMatchObject({ market: 'GOLD', symbol: 'XAU', currency: 'USD', buyPrice: null });
    expect(priceAskInput(bbca, {}, NOW)).toBeNull();
  });
  it('server menolak field tambahan (nama, jumlah), bukan diam-diam membuangnya', () => {
    const input = priceAskInput(bbca, prices, NOW)!;
    expect(PriceAskRequest.safeParse({ lang: 'id', asset: { ...input, name: 'Bank Central Asia' } }).success).toBe(false);
    expect(PriceAskRequest.safeParse({ lang: 'id', asset: input, quantity: 100 }).success).toBe(false);
  });
  it('prompt hanya memuat angka ringkasan dan harga live yang diberikan', () => {
    const prompt = pricePrompt('id', priceAskInput(bbca, prices, NOW)!);
    expect(prompt).toContain('"currentPricePerUnit":5200');
    expect(prompt).toContain('5200 IDR');
    expect(prompt).not.toContain('Bank Central Asia');
    expect(prompt).not.toContain('rahasia');
  });
});

describe('Tanya harga wajar: angka konsisten dengan harga live', () => {
  const reasons = ['Harga sekarang 5200 IDR.', 'Ini perkiraan, bukan rekomendasi.'];
  it('vonis dihitung dari kisaran vs harga live, bukan dari teks AI', () => {
    expect(normalizePrice({ targetLow: 4900, targetHigh: 5600, reasons, verdict: 'mahal' }, 5200, 'IDR')).toEqual({
      verdict: 'fair', targetLow: 4900, targetHigh: 5600, livePrice: 5200, currency: 'IDR', reasons,
    });
    expect(normalizePrice({ targetLow: 5400, targetHigh: 6100, reasons }, 5200, 'IDR')?.verdict).toBe('cheap');
    expect(normalizePrice({ targetLow: 4200, targetHigh: 5000, reasons }, 5200, 'IDR')?.verdict).toBe('expensive');
  });
  it('kisaran terbalik ditukar; desimal mengikuti besaran harga', () => {
    expect(normalizePrice({ targetLow: 5600.4, targetHigh: 4899.6, reasons }, 5200, 'IDR')).toMatchObject({ targetLow: 4900, targetHigh: 5600 });
    expect(normalizePrice({ targetLow: 300.456, targetHigh: 380.111, reasons }, 342.37, 'USD')).toMatchObject({ targetLow: 300.46, targetHigh: 380.11 });
  });
  it('angka yang tidak masuk akal terhadap harga live ditolak (AI salah baca), begitu juga tanpa alasan', () => {
    expect(normalizePrice({ targetLow: 15000, targetHigh: 20000, reasons }, 5200, 'IDR')).toBeNull();
    expect(normalizePrice({ targetLow: 1000, targetHigh: 5200, reasons }, 5200, 'IDR')).toBeNull();
    expect(normalizePrice({ targetLow: 'x', targetHigh: 5600, reasons }, 5200, 'IDR')).toBeNull();
    expect(normalizePrice({ targetLow: 4900, targetHigh: 5600, reasons: [] }, 5200, 'IDR')).toBeNull();
  });
});

describe('penggerak portofolio 7 hari (Weekly Replay)', () => {
  const hist = (rows: [string, number][], currency = 'IDR'): PricePoint[] => rows.map(([day, price]) => ({ day, price, currency }));
  it('BBCA 5.000 -> 5.200 seminggu: +Rp 20.000, +4%', () => {
    const r = portfolioMovers([bbca], prices, { 'IDX:BBCA': hist([['2026-11-06', 4900], ['2026-11-07', 5000], ['2026-11-10', 5100]]) }, NOW, 'IDR');
    expect(r).toEqual({ total: 20_000, movers: [{ assetId: 'b', label: 'BBCA', pct: 0.04, delta: 20_000 }] });
  });
  it('urut dari dampak terbesar; dikonversi ke mata uang utama; emas memakai nama', () => {
    const r = portfolioMovers([bbca, aapl, gold], prices, {
      'IDX:BBCA': hist([['2026-11-07', 5100]]),
      'US:AAPL': hist([['2026-11-07', 332.37]], 'USD'),
      'GOLD:XAU': hist([['2026-11-07', 4072.1]], 'USD'),
    }, NOW, 'IDR')!;
    // AAPL 2 × $10 = $20 = Rp 320.000; BBCA 100 × 100 = Rp 10.000; emas tidak bergerak.
    expect(r.movers.map((m) => [m.label, m.delta])).toEqual([['AAPL', 320_000], ['BBCA', 10_000], ['Emas', 0]]);
    expect(r.total).toBe(330_000);
  });
  it('riwayat kurang dari seminggu atau nilai manual: tidak ada penggerak (tidak mengarang)', () => {
    expect(portfolioMovers([bbca], prices, { 'IDX:BBCA': hist([['2026-11-10', 5000]]) }, NOW, 'IDR')).toBeNull();
    expect(portfolioMovers([{ ...bbca, valueOverride: 1 }], prices, { 'IDX:BBCA': hist([['2026-11-01', 5000]]) }, NOW, 'IDR')).toBeNull();
  });
  it('sync menulis satu baris riwayat per kode per hari UTC', () => {
    expect(historyRows([{ symbol: 'IDX:BBCA', price: 5200, currency: 'IDR', source: 'yahoo-idx', fetched_at: '2026-11-07T10:08:32.889Z', quoted_at: null }])).toEqual([
      { symbol: 'IDX:BBCA', day: '2026-11-07', price: 5200, currency: 'IDR' },
    ]);
  });
});

it('ambang alert: 0,1 sampai 50, koma atau titik', () => {
  expect(['0,1', '5', '2.5', '50', '0', '0,05', '51', 'abc', ''].map(parsePct)).toEqual([0.1, 5, 2.5, 50, null, null, null, null, null]);
});

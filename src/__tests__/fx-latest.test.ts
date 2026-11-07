import AsyncStorage from '@react-native-async-storage/async-storage';

import { CACHE_KEY, CACHE_MAX_MS, FRESH_MS, loadLatestRates, SOURCE_TIMEOUT_MS } from '@/data/fxLatest';

const NOW = Date.parse('2026-11-07T10:00:00Z');
const now = () => NOW;

// Payload nyata yang dipangkas (2026-11-07): er-api huruf besar, fawazahmed0 huruf kecil + kripto.
const codes = ['AUD', 'BRL', 'CAD', 'CHF', 'CNY', 'CZK', 'DKK', 'EUR', 'GBP', 'HKD', 'HUF', 'IDR', 'ILS', 'INR', 'ISK', 'JPY', 'KRW', 'MXN', 'MYR', 'NOK', 'NZD', 'PHP', 'PLN', 'RON', 'SEK', 'SGD', 'THB', 'TRY', 'ZAR'];
const rates = (idr: number) => Object.fromEntries(codes.map((c) => [c, c === 'IDR' ? idr : 2]));
const erApi = { result: 'success', time_last_update_unix: 1794009751, rates: { ...rates(18098.980679), USD: 1, KWD: 0.3 } };
const fawaz = (idr: number, date: string) => ({ date, usd: { ...Object.fromEntries(Object.entries(rates(idr)).map(([k, v]) => [k.toLowerCase(), v])), btc: 0.00001323427, usd: 1 } });

type Route = 'ok' | 'down' | 'hang' | 'junk';
function fakeFetch(routes: { er?: Route; js?: Route; pages?: Route }) {
  const calls: string[] = [];
  const fn = jest.fn((url: string, init?: { signal?: AbortSignal }) => {
    const key = url.includes('er-api') ? 'er' : url.includes('jsdelivr') ? 'js' : 'pages';
    calls.push(key);
    const route = routes[key] ?? 'ok';
    if (route === 'down') return Promise.reject(new TypeError('Network request failed'));
    if (route === 'hang') return new Promise((_, reject) => init?.signal?.addEventListener('abort', () => reject(new Error('aborted'))));
    const body = route === 'junk' ? { usd: { idr: 1 } } : key === 'er' ? erApi : key === 'js' ? fawaz(18132.38548247, '2026-11-06') : fawaz(18105.08910286, '2026-11-07');
    return Promise.resolve({ ok: true, status: 200, json: async () => body } as Response);
  });
  return { fn: fn as unknown as typeof fetch, calls };
}
const server = jest.fn(async () => ({ table: { IDR: '18100', MYR: '4.059' }, date: '2026-11-06' }));
const deadServer = jest.fn(async () => { throw new Error('offline'); });
const putCache = (ageMs: number) =>
  AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ table: { USD: '1', IDR: '18000' }, date: '2026-11-03', source: 'er-api', savedAt: NOW - ageMs }));

beforeEach(async () => {
  await AsyncStorage.clear();
  server.mockClear();
});

describe('kurs klien: rantai sumber (Live Market v2 Fase 4)', () => {
  it('sumber 1 hidup: er-api dipakai, hanya kode yang diizinkan, disimpan ke cache', async () => {
    const f = fakeFetch({});
    const r = await loadLatestRates({ server, fetchFn: f.fn, now });
    // time_last_update_unix 1794009751 = 2026-11-07T00:02:31Z.
    expect(r).toMatchObject({ source: 'er-api', stale: false, date: '2026-11-07' });
    expect(r.table.IDR).toBe('18098.980679');
    expect(r.table.USD).toBe('1');
    expect(r.table.KWD).toBeUndefined();
    expect(Object.keys(r.table)).toHaveLength(30);
    expect(f.calls).toEqual(['er']);
    expect(server).not.toHaveBeenCalled();
    expect(JSON.parse((await AsyncStorage.getItem(CACHE_KEY))!)).toMatchObject({ source: 'er-api', savedAt: NOW });
  });

  it('sumber 1 mati: sumber 2 (jsDelivr); kripto 3 huruf seperti btc tidak ikut', async () => {
    const f = fakeFetch({ er: 'down' });
    const r = await loadLatestRates({ server, fetchFn: f.fn, now });
    expect(r).toMatchObject({ source: 'jsdelivr', stale: false, date: '2026-11-06' });
    expect(r.table.IDR).toBe('18132.38548247');
    expect(r.table.BTC).toBeUndefined();
    expect(f.calls).toEqual(['er', 'js']);
  });

  it('sumber 1 menggantung: dibatalkan setelah 8 detik, lanjut ke sumber berikutnya', async () => {
    jest.useFakeTimers();
    try {
      const f = fakeFetch({ er: 'hang' });
      const pending = loadLatestRates({ server, fetchFn: f.fn, now });
      await jest.advanceTimersByTimeAsync(SOURCE_TIMEOUT_MS - 1);
      expect(f.calls).toEqual(['er']);
      await jest.advanceTimersByTimeAsync(1);
      expect((await pending).source).toBe('jsdelivr');
    } finally {
      jest.useRealTimers();
    }
  });

  it('sumber 1 dan 2 mati, atau datanya rusak: sumber 3 (pages.dev)', async () => {
    const f = fakeFetch({ er: 'down', js: 'junk' });
    const r = await loadLatestRates({ server, fetchFn: f.fn, now });
    expect(r).toMatchObject({ source: 'pages-dev', date: '2026-11-07', stale: false });
    expect(f.calls).toEqual(['er', 'js', 'pages']);
  });

  it('ketiga sumber klien mati: Frankfurter di server jadi fallback terakhir, bukan label basi', async () => {
    const f = fakeFetch({ er: 'down', js: 'down', pages: 'down' });
    const r = await loadLatestRates({ server, fetchFn: f.fn, now });
    expect(r).toEqual({ table: { IDR: '18100', MYR: '4.059', USD: '1' }, date: '2026-11-06', source: 'frankfurter', stale: false });
  });

  it('semua sumber mati: cache lama (2 hari) dipakai dengan tanda "kurs terakhir"', async () => {
    await putCache(2 * 24 * 60 * 60_000);
    const f = fakeFetch({ er: 'down', js: 'down', pages: 'down' });
    const r = await loadLatestRates({ server: deadServer, fetchFn: f.fn, now });
    expect(r).toEqual({ table: { USD: '1', IDR: '18000' }, date: '2026-11-03', source: 'er-api', stale: true });
  });

  it('semua mati dan cache lebih dari 7 hari: tidak dipakai (kurs hilang, bukan angka basi diam-diam)', async () => {
    await putCache(CACHE_MAX_MS + 1);
    const f = fakeFetch({ er: 'down', js: 'down', pages: 'down' });
    expect(await loadLatestRates({ server: deadServer, fetchFn: f.fn, now })).toEqual({ table: { USD: '1' }, date: null, source: 'none', stale: false });
  });

  it('cache kurang dari 1 jam: dipakai langsung tanpa jaringan', async () => {
    await putCache(FRESH_MS - 1);
    const f = fakeFetch({});
    expect(await loadLatestRates({ server, fetchFn: f.fn, now })).toMatchObject({ source: 'er-api', stale: false, date: '2026-11-03' });
    expect(f.calls).toEqual([]);
  });
});

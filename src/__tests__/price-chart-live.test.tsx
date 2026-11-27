import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Linking, Platform, StyleSheet, TurboModuleRegistry } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ToastProvider } from '@/components/ui';
import type { AssetsData } from '@/data/remote/assets';
import * as remoteAssets from '@/data/remote/assets';
import * as remoteFunctions from '@/data/remote/functions';
import { sampleState } from '@/data/sample-state';
import { chartHtml, chartPreflightUrl } from '@/features/assets/chartHtml';
import { fetchChartSeries, parseChartSymbol, resetChartSeriesEndpointState } from '@/features/assets/chartSeries';
import { FallbackPriceChart } from '@/features/assets/FallbackPriceChart';
import { PriceChart as NativePriceChart } from '@/features/assets/PriceChart';
import { PriceChart as WebPriceChart } from '@/features/assets/PriceChart.web';
import { I18nProvider } from '@/i18n';
import { chartSymbol } from '@/lib/assets';
import { AppStoreProvider } from '@/state/AppStore';
import * as assetsState from '@/state/assets';
import { AssetsProvider } from '@/state/assets';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { fetchServerChartSeries, normalizeSeriesPoints } from '../../supabase/functions/_shared/asset-chart';
import { AssetChartRequest, AssetChartResponse } from '../../supabase/functions/_shared/contracts';
import { tvCandidates } from '../../supabase/functions/_shared/tradingview-symbols';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const assetChartApiHandler = require('../../api/asset-chart') as ((
  req: {
    method?: string;
    url?: string;
    headers?: Record<string, string>;
    body?: unknown;
    socket?: { remoteAddress?: string };
  },
  res: {
    statusCode: number;
    setHeader: (k: string, v: string) => void;
    end: (b: string) => void;
  },
) => Promise<void>) & { resetForTests: () => void };

let hasWebViewModule = true;
const realGet = TurboModuleRegistry.get.bind(TurboModuleRegistry);
jest.spyOn(TurboModuleRegistry, 'get').mockImplementation((name: string) => {
  if (name === 'RNCWebViewModule') return hasWebViewModule ? ({} as never) : null;
  return realGet(name);
});

async function wrap(ui: ReactNode, assets?: AssetsData) {
  let out!: ReturnType<typeof render>;
  await act(async () => {
    out = render(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
        <I18nProvider initialLang="id">
          <ThemeProvider initialMode="dark">
            <ToastProvider>
              <AppStoreProvider preset={sampleState()}>
                <AssetsProvider preset={assets ?? { assets: [], prices: {}, snapshots: [] }}>
                  {ui}
                </AssetsProvider>
              </AppStoreProvider>
            </ToastProvider>
          </ThemeProvider>
        </I18nProvider>
      </SafeAreaProvider>,
    );
  });
  return out;
}

describe('simbol & konfigurasi grafik TradingView live', () => {
  it('TON memakai KRAKEN:TONUSDT (BINANCE:TONUSDT tidak ada di TradingView), koin lain tetap BINANCE:<KODE>USDT', () => {
    expect(chartSymbol({ type: 'crypto', symbol: 'TON' })).toBe('KRAKEN:TONUSDT');
    expect(chartSymbol({ type: 'crypto', symbol: 'BTC' })).toBe('BINANCE:BTCUSDT');
    expect(chartSymbol({ type: 'crypto', symbol: 'POL' })).toBe('BINANCE:POLUSDT');
    expect(tvCandidates('CRYPTO:TON')).toEqual(['KRAKEN:TONUSDT', 'BINANCE:TONUSDT']);
    expect(tvCandidates('CRYPTO:BTC')).toEqual(['BINANCE:BTCUSDT']);
  });

  it('chartPreflightUrl mengecek origin iframe www.tradingview-widget.com sesuai bahasa, bukan s3.tradingview.com', () => {
    expect(chartPreflightUrl('id')).toBe('https://www.tradingview-widget.com/embed-widget/symbol-overview/?locale=id');
    expect(chartPreflightUrl('en')).toBe('https://www.tradingview-widget.com/embed-widget/symbol-overview/?locale=en');
    expect(chartPreflightUrl('ms')).toBe('https://www.tradingview-widget.com/embed-widget/symbol-overview/?locale=ms_MY');
    expect(chartPreflightUrl('tr')).toBe('https://www.tradingview-widget.com/embed-widget/symbol-overview/?locale=tr');
  });

  it('chartHtml menempatkan helper script di dalam <head> (bukan di dalam .tradingview-widget-container) dan memverifikasi iframe', () => {
    const html = chartHtml('IDX:BBCA', { scheme: 'dark', background: '#161616', grid: '#222', line: '#A3A3A3', fill: '#333', text: '#888' }, 'id');
    expect(html).toContain("fetch('https://www.tradingview-widget.com/embed-widget/symbol-overview/?locale=id',{mode:'no-cors',cache:'no-store'}).catch(tvFail)");
    expect(html).toContain('MutationObserver');
    expect(html).toContain('if(!tvLoaded)tvFail()');

    const headPart = html.split('</head>')[0] ?? '';
    const containerPart = html.split('<div class="tradingview-widget-container">')[1]?.split('</div></body>')[0] ?? '';
    expect(headPart).toContain('function tvFail()');
    expect(containerPart).not.toContain('function tvFail()');
    expect(containerPart).toContain('embed-widget-symbol-overview.js');
  });
});

describe('parseChartSymbol, fetchChartSeries & kontrak asset-chart', () => {
  const realFetch = globalThis.fetch;
  const realOS = Platform.OS;
  const realWindow = (globalThis as { window?: unknown }).window;

  beforeEach(() => {
    resetChartSeriesEndpointState();
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
    Object.defineProperty(Platform, 'OS', { value: realOS, configurable: true });
    if (realWindow === undefined) {
      delete (globalThis as { window?: unknown }).window;
    } else {
      Object.defineProperty(globalThis, 'window', { value: realWindow, configurable: true, writable: true });
    }
    resetChartSeriesEndpointState();
    jest.restoreAllMocks();
    jest.spyOn(TurboModuleRegistry, 'get').mockImplementation((name: string) => {
      if (name === 'RNCWebViewModule') return hasWebViewModule ? ({} as never) : null;
      return realGet(name);
    });
  });

  it('memetakan simbol grafik TradingView ke pasar, kode, priceKey, dan mata uang kutipan', () => {
    expect(parseChartSymbol('IDX:BBCA')).toEqual({ market: 'IDX', code: 'BBCA', priceKey: 'IDX:BBCA', currency: 'IDR' });
    expect(parseChartSymbol('AAPL')).toEqual({ market: 'US', code: 'AAPL', priceKey: 'US:AAPL', currency: 'USD' });
    expect(parseChartSymbol('BRK.B')).toEqual({ market: 'US', code: 'BRK.B', priceKey: 'US:BRK.B', currency: 'USD' });
    expect(parseChartSymbol('BINANCE:BTCUSDT')).toEqual({ market: 'CRYPTO', code: 'BTC', priceKey: 'CRYPTO:BTC', currency: 'USD' });
    expect(parseChartSymbol('KRAKEN:TONUSDT')).toEqual({ market: 'CRYPTO', code: 'TON', priceKey: 'CRYPTO:TON', currency: 'USD' });
    expect(parseChartSymbol('OANDA:XAUUSD')).toEqual({ market: 'GOLD', code: 'XAU', priceKey: 'GOLD:XAU', currency: 'USD' });
    expect(parseChartSymbol('')).toBeNull();
  });

  it('validasi kontrak Zod AssetChartRequest & normalizeSeriesPoints', () => {
    expect(AssetChartRequest.safeParse({ market: 'IDX', code: 'BBCA', range: '3M' }).success).toBe(true);
    expect(AssetChartRequest.safeParse({ market: 'US', code: 'BRK.B', range: '12M' }).success).toBe(true);
    expect(AssetChartRequest.safeParse({ market: 'IDX', code: '../evil', range: '3M' }).success).toBe(false);
    const big = Array.from({ length: 800 }, (_, i) => ({ dayMs: 1700000000000 + i * 86400000, value: 100 + i }));
    const downsampled = normalizeSeriesPoints(big)!;
    expect(downsampled).toHaveLength(400);
    expect(downsampled[0]).toEqual(big[0]);
    expect(downsampled[399]).toEqual(big[799]);
    expect(AssetChartResponse.safeParse({ currency: 'USD', points: downsampled }).success).toBe(true);
  });

  it('fetchServerChartSeries mengambil deret Yahoo di server dengan validasi bursa JKT / US_EXCHANGES', async () => {
    globalThis.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('BBCA.JK')) {
        return {
          ok: true,
          json: async () => ({
            chart: {
              result: [
                {
                  meta: { currency: 'IDR', exchangeName: 'JKT', instrumentType: 'EQUITY' },
                  timestamp: [1760000000, 1761000000],
                  indicators: { quote: [{ close: [5000, 5250] }] },
                },
              ],
            },
          }),
        } as Response;
      }
      if (url.includes('FAKE')) {
        return {
          ok: true,
          json: async () => ({
            chart: {
              result: [
                {
                  meta: { currency: 'USD', exchangeName: 'PNK', instrumentType: 'EQUITY' },
                  timestamp: [1760000000, 1761000000],
                  indicators: { quote: [{ close: [1, 2] }] },
                },
              ],
            },
          }),
        } as Response;
      }
      throw new Error('unexpected:' + url);
    }) as unknown as typeof fetch;

    expect(await fetchServerChartSeries('IDX', 'BBCA', '3M')).toEqual({
      currency: 'IDR',
      points: [
        { dayMs: 1760000000000, value: 5000 },
        { dayMs: 1761000000000, value: 5250 },
      ],
    });
    // OTC (PNK) ditolak agar konsisten dengan penyedia harga.
    expect(await fetchServerChartSeries('US', 'FAKE', '3M')).toBeNull();
  });

  it('di Web (Platform.OS === "web"), tidak memanggil Yahoo langsung (bebas error CORS) dan memakai Edge Function asset-chart', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
    const seenFetch: string[] = [];
    globalThis.fetch = jest.fn(async (input: RequestInfo | URL) => {
      seenFetch.push(String(input));
      throw new Error('unexpected_direct_fetch');
    }) as unknown as typeof fetch;
    const invokeSpy = jest.spyOn(remoteFunctions, 'invokeFn').mockResolvedValue({
      currency: 'USD',
      points: [
        { dayMs: 1760000000000, value: 225.4 },
        { dayMs: 1761000000000, value: 234.8 },
      ],
    });

    const aapl = await fetchChartSeries('AAPL', '3M');
    expect(seenFetch.some((u) => u.includes('yahoo.com'))).toBe(false);
    expect(invokeSpy).toHaveBeenCalledWith('asset-chart', { market: 'US', code: 'AAPL', range: '3M' }, AssetChartResponse);
    expect(aapl).toEqual({
      currency: 'USD',
      points: [
        { dayMs: 1760000000000, value: 225.4 },
        { dayMs: 1761000000000, value: 234.8 },
      ],
    });
  });

  it('di Web (Vercel / Expo Metro), memakai endpoint same-origin /api/asset-chart tanpa menyentuh Edge Function yang belum ter-deploy', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
    Object.defineProperty(globalThis, 'window', {
      value: { location: { protocol: 'https:', origin: 'https://arshif.app' } },
      configurable: true,
      writable: true,
    });
    const seenUrls: string[] = [];
    globalThis.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      seenUrls.push(url);
      if (url.startsWith('/api/asset-chart?')) {
        return {
          ok: true,
          headers: { get: (h: string) => (h.toLowerCase() === 'content-type' ? 'application/json; charset=utf-8' : null) },
          json: async () => ({
            ok: true,
            currency: 'IDR',
            points: [
              { dayMs: 1760000000000, value: 5800 },
              { dayMs: 1761000000000, value: 6000 },
            ],
          }),
        } as unknown as Response;
      }
      throw new Error('unexpected:' + url);
    }) as unknown as typeof fetch;
    const invokeSpy = jest.spyOn(remoteFunctions, 'invokeFn').mockRejectedValue(new remoteFunctions.FnError('server'));

    const bbca = await fetchChartSeries('IDX:BBCA', '3M');
    expect(seenUrls).toEqual(['/api/asset-chart?market=IDX&code=BBCA&range=3M']);
    expect(invokeSpy).not.toHaveBeenCalled();
    expect(bbca).toEqual({
      currency: 'IDR',
      points: [
        { dayMs: 1760000000000, value: 5800 },
        { dayMs: 1761000000000, value: 6000 },
      ],
    });
  });

  it('di Web statis saat Edge Function asset-chart 404 & asset_price_history < 2 hari: IDX & US jatuh ke sumber CORS publik (ts-api.cnbc.com)', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
    Object.defineProperty(globalThis, 'window', {
      value: { location: { protocol: 'http:', origin: 'http://localhost:8095' } },
      configurable: true,
      writable: true,
    });

    const seenUrls: string[] = [];
    globalThis.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      seenUrls.push(url);
      if (url.startsWith('/api/asset-chart?')) {
        // Server statis SPA mengembalikan index.html 200 text/html.
        return {
          ok: true,
          headers: { get: (h: string) => (h.toLowerCase() === 'content-type' ? 'text/html' : null) },
          text: async () => '<!doctype html>',
        } as unknown as Response;
      }
      if (url.includes('ts-api.cnbc.com/harmony/app/bars/BBCA-ID/1D/')) {
        return {
          ok: true,
          json: async () => ({
            barData: {
              priceBars: [
                { tradeTime: '20261120000000', tradeTimeinMills: 1795132800000, close: '5850.0000' },
                { tradeTime: '20261127000000', tradeTimeinMills: 1795737600000, close: '6000.0000' },
              ],
            },
          }),
        } as Response;
      }
      if (url.includes('ts-api.cnbc.com/harmony/app/bars/AAPL/1W/')) {
        return {
          ok: true,
          json: async () => ({
            barData: {
              priceBars: [
                { tradeTime: '20261113000000', tradeTimeinMills: 1794528000000, close: '340.5000' },
                { tradeTime: '20261125000000', tradeTimeinMills: 1795564800000, close: '355.5800' },
              ],
            },
          }),
        } as Response;
      }
      throw new Error('unexpected:' + url);
    }) as unknown as typeof fetch;

    // Edge Function belum ter-deploy -> mengembalikan HTTP 404 yang dipetakan ke FnError('network' / 'server').
    jest.spyOn(remoteFunctions, 'invokeFn').mockRejectedValue(new remoteFunctions.FnError('network'));
    jest.spyOn(remoteAssets, 'loadPriceHistory').mockResolvedValue({});

    const bbca = await fetchChartSeries('IDX:BBCA', '3M');
    expect(bbca).toEqual({
      currency: 'IDR',
      points: [
        { dayMs: Date.UTC(2026, 10, 20), value: 5850 },
        { dayMs: Date.UTC(2026, 10, 27), value: 6000 },
      ],
    });

    // Rentang 60M (5 tahun) memakai interval 1W di CNBC (bukan 1M yang berarti 1 menit).
    const aapl5y = await fetchChartSeries('AAPL', '60M');
    expect(aapl5y).toEqual({
      currency: 'USD',
      points: [
        { dayMs: Date.UTC(2026, 10, 13), value: 340.5 },
        { dayMs: Date.UTC(2026, 10, 25), value: 355.58 },
      ],
    });
    expect(seenUrls.some((u) => u.includes('yahoo.com'))).toBe(false);

    // Jika Edge Function SUDAH ter-deploy dan secara otoritatif menolak simbol (FnError('not_found')), jangan lanjut ke CNBC.
    jest.spyOn(remoteFunctions, 'invokeFn').mockRejectedValueOnce(new remoteFunctions.FnError('not_found'));
    resetChartSeriesEndpointState();
    const rejected = await fetchChartSeries('AAPL', '3M');
    expect(rejected).toBeNull();
  });

  it('handler /api/asset-chart memvalidasi input, menolak cross-site & OTC, dan mewajibkan Bearer token di Vercel', async () => {
    const prevVercel = process.env.VERCEL;
    const invokeApi = async (req: Parameters<typeof assetChartApiHandler>[0]) => {
      let status = 200;
      const headers: Record<string, string> = {};
      let rawBody = '';
      await assetChartApiHandler(req, {
        get statusCode() {
          return status;
        },
        set statusCode(v: number) {
          status = v;
        },
        setHeader(k: string, v: string) {
          headers[k.toLowerCase()] = v;
        },
        end(b: string) {
          rawBody = b;
        },
      });
      return { status, headers, body: JSON.parse(rawBody) as Record<string, unknown> };
    };

    try {
      delete process.env.VERCEL;
      globalThis.fetch = jest.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('BBCA.JK')) {
          return {
            ok: true,
            json: async () => ({
              chart: {
                result: [
                  {
                    meta: { currency: 'IDR', exchangeName: 'JKT', instrumentType: 'EQUITY' },
                    timestamp: [1760000000, 1761000000],
                    indicators: { quote: [{ close: [5900, 6000] }] },
                  },
                ],
              },
            }),
          } as Response;
        }
        if (url.includes('OTCX')) {
          return {
            ok: true,
            json: async () => ({
              chart: {
                result: [
                  {
                    meta: { currency: 'USD', exchangeName: 'PNK', instrumentType: 'EQUITY' },
                    timestamp: [1760000000, 1761000000],
                    indicators: { quote: [{ close: [1, 2] }] },
                  },
                ],
              },
            }),
          } as Response;
        }
        if (url.endsWith('/auth/v1/user')) {
          return { ok: true, json: async () => ({ id: 'user-verified-1' }) } as Response;
        }
        return { ok: false, status: 404, json: async () => ({}) } as Response;
      }) as unknown as typeof fetch;

      expect((await invokeApi({ method: 'DELETE', url: '/api/asset-chart' })).status).toBe(405);
      expect((await invokeApi({ method: 'GET', url: '/api/asset-chart', headers: { 'sec-fetch-site': 'cross-site' } })).status).toBe(403);
      expect((await invokeApi({ method: 'GET', url: '/api/asset-chart?market=IDX&code=../evil&range=3M' })).status).toBe(400);

      const okIdx = await invokeApi({ method: 'GET', url: '/api/asset-chart?market=IDX&code=BBCA&range=3M' });
      expect(okIdx.status).toBe(200);
      expect(okIdx.body).toEqual({
        ok: true,
        currency: 'IDR',
        points: [
          { dayMs: 1760000000000, value: 5900 },
          { dayMs: 1761000000000, value: 6000 },
        ],
      });

      const otcRes = await invokeApi({ method: 'GET', url: '/api/asset-chart?market=US&code=OTCX&range=3M' });
      expect(otcRes.status).toBe(200);
      expect(otcRes.body).toEqual({ ok: false, error: 'not_found' });

      // Di Vercel produksi: wajib Bearer token Supabase yang valid.
      process.env.VERCEL = '1';
      const unauth = await invokeApi({ method: 'GET', url: '/api/asset-chart?market=IDX&code=BBCA&range=1M' });
      expect(unauth.status).toBe(401);

      const authed = await invokeApi({
        method: 'GET',
        url: '/api/asset-chart?market=IDX&code=BBCA&range=1M',
        headers: { authorization: 'Bearer valid-jwt-token' },
      });
      expect(authed.status).toBe(200);
      expect(authed.body.ok).toBe(true);
    } finally {
      assetChartApiHandler.resetForTests();
      if (prevVercel === undefined) delete process.env.VERCEL;
      else process.env.VERCEL = prevVercel;
    }
  });

  it('saat Yahoo terkena rate-limit HTTP 429, server TIDAK salah mengembalikan not_found: IDX jatuh ke CNBC di server & US mengembalikan 502 provider_error sehingga klien lanjut ke cadangan', async () => {
    assetChartApiHandler.resetForTests();
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
    Object.defineProperty(globalThis, 'window', {
      value: { location: { protocol: 'https:', origin: 'https://arshif.app' } },
      configurable: true,
      writable: true,
    });

    globalThis.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith('/api/asset-chart?')) {
        let status = 200;
        const headers: Record<string, string> = {};
        let rawBody = '';
        await assetChartApiHandler(
          { method: 'GET', url },
          {
            get statusCode() {
              return status;
            },
            set statusCode(v: number) {
              status = v;
            },
            setHeader(k: string, v: string) {
              headers[k.toLowerCase()] = v;
            },
            end(b: string) {
              rawBody = b;
            },
          },
        );
        return {
          ok: status >= 200 && status < 300,
          status,
          headers: { get: (h: string) => headers[h.toLowerCase()] ?? null },
          json: async () => JSON.parse(rawBody),
        } as unknown as Response;
      }
      if (url.includes('yahoo.com')) {
        return { ok: false, status: 429, json: async () => ({}) } as Response;
      }
      if (url.includes('ts-api.cnbc.com/harmony/app/bars/BBCA-ID/')) {
        return {
          ok: true,
          json: async () => ({
            barData: {
              priceBars: [
                { tradeTime: '20261120000000', tradeTimeinMills: 1795132800000, close: '5900.0000' },
                { tradeTime: '20261127000000', tradeTimeinMills: 1795737600000, close: '6000.0000' },
              ],
            },
          }),
        } as Response;
      }
      if (url.includes('ts-api.cnbc.com/harmony/app/bars/AAPL/')) {
        return {
          ok: true,
          json: async () => ({
            barData: {
              priceBars: [
                { tradeTime: '20261120000000', tradeTimeinMills: 1795132800000, close: '230.0000' },
                { tradeTime: '20261127000000', tradeTimeinMills: 1795737600000, close: '238.5000' },
              ],
            },
          }),
        } as Response;
      }
      throw new Error('unexpected:' + url);
    }) as unknown as typeof fetch;

    jest.spyOn(remoteFunctions, 'invokeFn').mockRejectedValue(new remoteFunctions.FnError('server'));

    // 1. Server shared helper: IDX jatuh ke CNBC di server, US melempar error provider (bukan null / not_found).
    const serverIdx = await fetchServerChartSeries('IDX', 'BBCA', '3M');
    expect(serverIdx?.currency).toBe('IDR');
    expect(serverIdx?.points.map((p) => p.value)).toEqual([5900, 6000]);
    await expect(fetchServerChartSeries('US', 'AAPL', '3M')).rejects.toThrow('http_429');

    // 2. End-to-end klien Web -> /api/asset-chart (502 untuk US saat Yahoo 429) -> tidak berhenti di not_found palsu, melainkan lanjut ke CNBC.
    const webIdx = await fetchChartSeries('IDX:BBCA', '3M');
    expect(webIdx?.points.map((p) => p.value)).toEqual([5900, 6000]);

    const webUs = await fetchChartSeries('AAPL', '3M');
    expect(webUs?.currency).toBe('USD');
    expect(webUs?.points.map((p) => p.value)).toEqual([230, 238.5]);
    assetChartApiHandler.resetForTests();
  });

  it('mengambil deret klines Binance untuk kripto dan menyaring nilai tidak valid (NaN, <= 0)', async () => {
    globalThis.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => [
        [1700000000000, '0', '0', '0', '35000.5'],
        [1700086400000, '0', '0', '0', 'NaN'],
        [1700172800000, '0', '0', '0', '-10'],
        [1700259200000, '0', '0', '0', '36200.25'],
      ],
    })) as unknown as typeof fetch;

    const res = await fetchChartSeries('BINANCE:BTCUSDT', '3M');
    expect(res).toEqual({
      currency: 'USD',
      points: [
        { dayMs: 1700000000000, value: 35000.5 },
        { dayMs: 1700259200000, value: 36200.25 },
      ],
    });
  });

  it('jatuh ke riwayat asset_price_history Supabase bila endpoint pasar gagal, dan mendeduplikasi hari yang sama', async () => {
    globalThis.fetch = jest.fn(async () => {
      throw new Error('blocked');
    }) as unknown as typeof fetch;
    jest.spyOn(remoteFunctions, 'invokeFn').mockRejectedValue(new Error('offline'));

    // Satu baris riwayat di hari yang sama dengan livePrice TIDAK boleh membentuk 2 titik palsu ("27 Nov - 27 Nov").
    jest.spyOn(remoteAssets, 'loadPriceHistory').mockResolvedValueOnce({
      'IDX:BBCA': [{ day: '2026-11-27', price: 5200, currency: 'IDR' }],
    });
    const singleDay = await fetchChartSeries('IDX:BBCA', '1M', {
      livePrice: { symbol: 'IDX:BBCA', price: 5250, currency: 'IDR', fetchedAt: '2026-11-27T14:00:00Z' },
    });
    expect(singleDay).toBeNull();

    // Dua hari kalender berbeda -> valid.
    jest.spyOn(remoteAssets, 'loadPriceHistory').mockResolvedValueOnce({
      'IDX:BBCA': [
        { day: '2026-11-20', price: 5050, currency: 'IDR' },
        { day: '2026-11-25', price: 5200, currency: 'IDR' },
      ],
    });
    const twoDays = await fetchChartSeries('IDX:BBCA', '1M');
    expect(twoDays?.currency).toBe('IDR');
    expect(twoDays?.points.map((p) => p.value)).toEqual([5050, 5200]);
  });

  it('mengembalikan null bila titik valid kurang dari 2 (tidak pernah mengarang data)', async () => {
    globalThis.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => [[1700000000000, '0', '0', '0', '35000']],
    })) as unknown as typeof fetch;
    jest.spyOn(remoteFunctions, 'invokeFn').mockRejectedValue(new Error('offline'));
    jest.spyOn(remoteAssets, 'loadPriceHistory').mockResolvedValue({});

    expect(await fetchChartSeries('BINANCE:BTCUSDT', '1M')).toBeNull();
  });
});

describe('PriceChart native & web: perbaikan WebView + grafik SVG cadangan & pengalih manual', () => {
  const realFetch = globalThis.fetch;
  const realOS = Platform.OS;
  beforeEach(() => {
    hasWebViewModule = true;
    resetChartSeriesEndpointState();
    jest.useRealTimers();
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
    Object.defineProperty(Platform, 'OS', { value: realOS, configurable: true });
    resetChartSeriesEndpointState();
    jest.useRealTimers();
    jest.restoreAllMocks();
    jest.spyOn(TurboModuleRegistry, 'get').mockImplementation((name: string) => {
      if (name === 'RNCWebViewModule') return hasWebViewModule ? ({} as never) : null;
      return realGet(name);
    });
  });

  it('WebView native memasang flex: 1, proteksi render Android di dalam ScrollView, recovery proses mati, dan timeout bila macet', async () => {
    jest.useFakeTimers();
    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
    globalThis.fetch = jest.fn(async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;
    jest.spyOn(remoteFunctions, 'invokeFn').mockRejectedValue(new Error('offline'));
    jest.spyOn(remoteAssets, 'loadPriceHistory').mockResolvedValue({});
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);

    await wrap(<NativePriceChart symbol="IDX:BBCA" label="Grafik harga IDX:BBCA dari TradingView" />);
    const web = screen.getByTestId('webview');
    expect(web.props.domStorageEnabled).toBe(true);
    expect(web.props.javaScriptEnabled).toBe(true);
    expect(web.props.thirdPartyCookiesEnabled).toBe(true);
    expect(web.props.androidLayerType).toBe('hardware');
    expect(web.props.overScrollMode).toBe('never');
    expect(StyleSheet.flatten(web.props.style)).toMatchObject({ flex: 1, opacity: 0.99 });
    expect(StyleSheet.flatten(web.props.containerStyle)).toMatchObject({ flex: 1 });
    expect(web.props.onShouldStartLoadWithRequest({ url: 'https://widgets.tradingview-widget.com/embed/', isTopFrame: true })).toBe(true);
    expect(web.props.onShouldStartLoadWithRequest({ url: 'https://static.tradingview.com/static/bundle.js', isTopFrame: true })).toBe(true);

    // Redirect otomatis non-click ke domain luar diblokir tanpa membajak peramban eksternal.
    expect(web.props.onShouldStartLoadWithRequest({ url: 'https://www.tradingview.com/', isTopFrame: true, navigationType: 'other' })).toBe(false);
    expect(openURL).not.toHaveBeenCalled();

    const box = screen.getByLabelText('Grafik harga IDX:BBCA dari TradingView');
    expect(box.props.accessible).not.toBe(true);

    // Bila skrip eksternal macet melewati batas waktu, beralih dari skeleton ke state pemulihan.
    await act(async () => {
      jest.advanceTimersByTime(13_000);
    });
    expect(screen.getByText('Grafik tidak bisa dimuat. Periksa koneksimu.')).toBeTruthy();

    // Coba lagi lalu proses render WebView dihentikan OS (onRenderProcessGone) -> kembali pulih ke state fallback.
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Coba lagi'));
    });
    await act(async () => {
      screen.getByTestId('webview').props.onRenderProcessGone();
    });
    expect(screen.getByText('Grafik tidak bisa dimuat. Periksa koneksimu.')).toBeTruthy();
  });

  it('PriceChart.web melakukan preflight ke www.tradingview-widget.com dan menampilkan grafik SVG cadangan bila TradingView diblokir', async () => {
    const seenUrls: string[] = [];
    globalThis.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      seenUrls.push(url);
      if (url.includes('tradingview-widget.com')) throw new Error('ERR_BLOCKED_BY_CLIENT');
      return {
        ok: true,
        json: async () => [
          [1760000000000, '0', '0', '0', '60000'],
          [1761000000000, '0', '0', '0', '64500'],
        ],
      } as Response;
    }) as unknown as typeof fetch;

    await wrap(<WebPriceChart symbol="BINANCE:BTCUSDT" label="Grafik BTC" />);
    expect(seenUrls[0]).toBe('https://www.tradingview-widget.com/embed-widget/symbol-overview/?locale=id');

    const fallback = screen.getByTestId('fallback-price-chart');
    await act(async () => {
      fireEvent(fallback, 'layout', { nativeEvent: { layout: { width: 320, height: 180 } } });
    });
    expect(screen.getByText('$60,000.00 - $64,500.00')).toBeTruthy();
    expect(screen.getByLabelText('Coba lagi')).toBeTruthy();
    expect(screen.getByLabelText('Lihat chart di browser')).toBeTruthy();
  });

  it('saat captive portal HTTP 200 / WebSocket terblokir / "Simbol tidak valid" (onLoad sukses), pengguna tetap bisa beralih ke grafik bawaan dan kembali ke interaktif', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
    globalThis.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      // Preflight no-cors ke www.tradingview-widget.com "berhasil" (opaque HTTP 200 captive block page).
      if (url.includes('tradingview-widget.com')) return {} as Response;
      if (url.includes('ts-api.cnbc.com/harmony/app/bars/BBCA-ID/')) {
        return {
          ok: true,
          json: async () => ({
            barData: {
              priceBars: [
                { tradeTime: '20261120000000', tradeTimeinMills: 1795132800000, close: '5800.0000' },
                { tradeTime: '20261127000000', tradeTimeinMills: 1795737600000, close: '6000.0000' },
              ],
            },
          }),
        } as Response;
      }
      throw new Error('unexpected:' + url);
    }) as unknown as typeof fetch;
    jest.spyOn(remoteFunctions, 'invokeFn').mockRejectedValue(new remoteFunctions.FnError('network'));

    const view = await wrap(<WebPriceChart symbol="IDX:BBCA" label="Grafik IDX:BBCA" />);
    expect(screen.getByText('Grafik kosong atau terblokir?')).toBeTruthy();

    // Pengguna mengetuk "Pakai grafik bawaan" meski state bukan 'error'.
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Pakai grafik bawaan'));
    });
    const fallback = screen.getByTestId('fallback-price-chart');
    await act(async () => {
      fireEvent(fallback, 'layout', { nativeEvent: { layout: { width: 320, height: 180 } } });
    });
    expect(screen.getByText('Rp 5.800 - Rp 6.000')).toBeTruthy();
    expect(fallback.props.accessibilityLabel).toContain('Grafik harga IDX:BBCA');
    expect(fallback.props.accessibilityLabel).not.toContain('kekayaan bersih');
    expect(screen.queryByText('Grafik tidak bisa dimuat. Periksa koneksimu.')).toBeNull();
    expect(screen.getByLabelText('Lihat chart di browser')).toBeTruthy();
    await view.unmount();

    // Pilihan mode 'builtin' bertahan selama sesi aktif saat berpindah ke aset berikutnya.
    const viewNext = await wrap(<WebPriceChart symbol="IDX:BBCA" label="Grafik IDX:BBCA" />);
    expect(screen.getByLabelText('Pakai grafik interaktif')).toBeTruthy();

    // Kembali ke grafik interaktif TradingView.
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Pakai grafik interaktif'));
    });
    expect(screen.getByLabelText('Pakai grafik bawaan')).toBeTruthy();
    await viewNext.unmount();

    // Di Native juga menyediakan pengalih yang sama dan menampilkan pesan jujur bila data < 2 titik.
    Object.defineProperty(Platform, 'OS', { value: realOS, configurable: true });
    globalThis.fetch = jest.fn(async () => {
      throw new Error('no_series');
    }) as unknown as typeof fetch;
    jest.spyOn(remoteAssets, 'loadPriceHistory').mockResolvedValue({});

    await wrap(<NativePriceChart symbol="IDX:BBCA" label="Grafik harga IDX:BBCA dari TradingView" />);
    await act(async () => {
      screen.getByTestId('webview').props.onLoadEnd();
    });
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Pakai grafik bawaan'));
    });
    expect(screen.queryByTestId('webview')).toBeNull();
    expect(screen.getByText('Riwayat harga untuk kode ini belum cukup untuk ditampilkan.')).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Pakai grafik interaktif'));
    });
    expect(screen.getByTestId('webview')).toBeTruthy();
  });

  it('saat dalam state error, ketukan chip rentang langsung memperbarui grafik SVG cadangan tanpa kembali menggantung di WebView; Coba lagi mencoba ulang WebView', async () => {
    const requestedUrls: string[] = [];
    globalThis.fetch = jest.fn(async (input: RequestInfo | URL) => {
      requestedUrls.push(String(input));
      return {
        ok: true,
        json: async () => ({
          chart: {
            result: [
              {
                meta: { currency: 'IDR', exchangeName: 'JKT', instrumentType: 'EQUITY' },
                timestamp: [1760000000, 1761000000, 1762000000],
                indicators: { quote: [{ close: [4900, 5050, 5200] }] },
              },
            ],
          },
        }),
      } as Response;
    }) as unknown as typeof fetch;

    await wrap(<NativePriceChart symbol="IDX:BBCA" label="Grafik harga IDX:BBCA dari TradingView" />);
    await act(async () => {
      screen.getByTestId('webview').props.onError();
    });

    const fallback = screen.getByTestId('fallback-price-chart');
    await act(async () => {
      fireEvent(fallback, 'layout', { nativeEvent: { layout: { width: 320, height: 180 } } });
    });
    expect(screen.getByText('Rp 4.900 - Rp 5.200')).toBeTruthy();
    expect(requestedUrls.some((u) => u.includes('BBCA.JK') && u.includes('range=3mo'))).toBeTruthy();

    // Ketuk 1T saat error: langsung memuat rentang 1y di FallbackPriceChart tanpa merender ulang WebView yang terblokir.
    await act(async () => {
      fireEvent.press(screen.getByLabelText('1T'));
    });
    expect(screen.queryByTestId('webview')).toBeNull();
    expect(requestedUrls.some((u) => u.includes('BBCA.JK') && u.includes('range=1y'))).toBeTruthy();

    // Ketuk Coba lagi: baru mencoba memuat ulang WebView TradingView.
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Coba lagi'));
    });
    expect(screen.getByTestId('webview')).toBeTruthy();
  });

  it('kripto jatuh ke CoinGecko bila Binance gagal, dan emas jatuh ke PAXGUSDT bila Yahoo gagal', async () => {
    globalThis.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('binance.vision') && url.includes('TONUSDT')) throw new Error('binance_down');
      if (url.includes('coingecko.com/api/v3/coins/the-open-network')) {
        return { ok: true, json: async () => ({ prices: [[1760000000000, 1.4], [1761000000000, 1.6]] }) } as Response;
      }
      if (url.includes('yahoo.com')) throw new Error('cors_blocked');
      if (url.includes('PAXGUSDT')) {
        return { ok: true, json: async () => [[1760000000000, '0', '0', '0', '3550'], [1761000000000, '0', '0', '0', '3610']] } as Response;
      }
      throw new Error('unexpected_url:' + url);
    }) as unknown as typeof fetch;

    const ton = await fetchChartSeries('KRAKEN:TONUSDT', '1M');
    expect(ton?.points.map((p) => p.value)).toEqual([1.4, 1.6]);

    const gold = await fetchChartSeries('OANDA:XAUUSD', '3M');
    expect(gold?.points.map((p) => p.value)).toEqual([3550, 3610]);
  });

  it('FallbackPriceChart otomatis pulih saat AssetsProvider baru selesai memuat riwayat setelah mount awal offline', async () => {
    globalThis.fetch = jest.fn(async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;
    jest.spyOn(remoteFunctions, 'invokeFn').mockRejectedValue(new Error('offline'));
    jest.spyOn(remoteAssets, 'loadPriceHistory').mockResolvedValue({});

    let ctxData: Partial<AssetsData> = { history: {}, prices: {} };
    const ctxSpy = jest.spyOn(assetsState, 'useAssetsOptional').mockImplementation(() => ctxData as ReturnType<typeof assetsState.useAssetsOptional>);

    const view = await wrap(<FallbackPriceChart symbol="IDX:BBCA" range="3M" showStatus />);
    // Saat AssetsProvider belum selesai memuat riwayat -> builtinEmpty muncul.
    expect(screen.getByText('Riwayat harga untuk kode ini belum cukup untuk ditampilkan.')).toBeTruthy();

    // Komponen FallbackPriceChart yang sama tetap ter-mount, lalu konteks AssetsProvider selesai memuat riwayat 2 hari.
    ctxData = {
      history: {
        'IDX:BBCA': [
          { day: '2026-11-20', price: 5850, currency: 'IDR' },
          { day: '2026-11-26', price: 6000, currency: 'IDR' },
        ],
      },
      prices: {},
    };
    await act(async () => {
      view.rerender(
        <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
          <I18nProvider initialLang="id">
            <ThemeProvider initialMode="dark">
              <ToastProvider>
                <AppStoreProvider preset={sampleState()}>
                  <AssetsProvider preset={{ assets: [], prices: {}, snapshots: [] }}>
                    <FallbackPriceChart symbol="IDX:BBCA" range="3M" showStatus />
                  </AssetsProvider>
                </AppStoreProvider>
              </ToastProvider>
            </ThemeProvider>
          </I18nProvider>
        </SafeAreaProvider>,
      );
    });
    const fallback = screen.getByTestId('fallback-price-chart');
    await act(async () => {
      fireEvent(fallback, 'layout', { nativeEvent: { layout: { width: 300, height: 180 } } });
    });
    expect(screen.getByText('Rp 5.850 - Rp 6.000')).toBeTruthy();
    ctxSpy.mockRestore();
  });
});

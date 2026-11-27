import type { Lang } from '@/i18n/types';

/** Halaman chart TradingView untuk dibuka di browser (cadangan bila WebView tidak tersedia). */
export const chartPageUrl = (symbol: string) => `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(symbol)}`;

/** Pesan yang dikirim halaman grafik saat skrip widget TradingView gagal dimuat (offline, diblokir). */
export const CHART_ERROR_MESSAGE = 'tv-chart-error';

/**
 * Widget resmi "Symbol Overview" dari TradingView (embed gratis, bukan API harga). Dipilih di atas Advanced Chart karena
 * warna garis/isian/teks bisa diatur (Monokrom: abu, bukan biru TradingView) dan `chartOnly` menyembunyikan header harga.
 */
export const WIDGET_PREFLIGHT_URL = 'https://s3.tradingview.com/external-embedding/embed-widget-symbol-overview.js';

export type ChartRange = '1M' | '3M' | '12M' | '60M' | 'ALL';
export const CHART_RANGES: readonly ChartRange[] = ['1M', '3M', '12M', '60M', 'ALL'];

// Rentang sisi kiri WAJIB huruf kecil ("1m", "3m", "12m", "60m", "all"), jika tidak TradingView mengosongkan `btns = []`.
// Resolusi harian/mingguan/bulanan dipilih agar kompatibel dengan IDX (tidak mendukung intraday gratis).
export const DATE_RANGES = ['1m|1D', '3m|1D', '12m|1D', '60m|1W', 'all|1M'] as const;

// "id" di konfigurasi widget menulis titik untuk ribuan DAN desimal ("86.000.00"); "id_ID" tetap memberi bulan Indonesia
// dengan angka konsisten ("86,000.00"). Diperiksa di Chromium 2026-11-07.
const LOCALES: Record<Lang, string> = { id: 'id_ID', en: 'en', ms: 'ms_MY', tr: 'tr' };
// Query param `?locale=` pada endpoint `/embed-widget/symbol-overview/` menerima `id` dan menolak `id_ID`.
const QUERY_LOCALES: Record<Lang, string> = { id: 'id', en: 'en', ms: 'ms_MY', tr: 'tr' };

/** Semua warna dari token (palet + chartArea), tidak ada warna tertulis langsung. */
export type ChartTheme = { scheme: 'light' | 'dark'; background: string; grid: string; line: string; fill: string; text: string };

/** Konfigurasi widget TradingView Symbol Overview, dipakai bersama oleh HTML WebView native dan URL iframe web. */
export function chartConfig(symbol: string, theme: ChartTheme, lang: Lang, range: ChartRange = '3M') {
  return {
    symbols: [[symbol, `${symbol}|${range}`]],
    dateRanges: [...DATE_RANGES],
    chartOnly: true,
    width: '100%',
    height: '100%',
    autosize: true,
    locale: LOCALES[lang],
    colorTheme: theme.scheme,
    chartType: 'area',
    lineWidth: 2,
    showVolume: false,
    showMA: false,
    hideDateRanges: true,
    hideMarketStatus: true,
    hideSymbolLogo: true,
    scalePosition: 'right',
    scaleMode: 'Normal',
    fontFamily: 'Plus Jakarta Sans, -apple-system, sans-serif',
    fontSize: '10',
    valuesTracking: '1',
    isTransparent: false,
    backgroundColor: theme.background,
    gridLineColor: theme.grid,
    lineColor: theme.line,
    topColor: theme.fill,
    bottomColor: theme.background,
    fontColor: theme.text,
    widgetFontColor: theme.text,
  };
}

/**
 * URL iframe langsung untuk web (`www.tradingview-widget.com`). Menghindari `srcDoc` + sandbox tanpa `allow-same-origin`
 * yang memicu SecurityError saat widget membaca `document.cookie`, sekaligus tetap terisolasi cross-origin dari sesi Arshif.
 */
export function chartWidgetUrl(symbol: string, theme: ChartTheme, lang: Lang, range: ChartRange = '3M'): string {
  const queryLocale = QUERY_LOCALES[lang];
  const hash = encodeURIComponent(JSON.stringify(chartConfig(symbol, theme, lang, range)));
  return `https://www.tradingview-widget.com/embed-widget/symbol-overview/?locale=${queryLocale}#${hash}`;
}

/**
 * Halaman HTML berisi widget embed resmi untuk WebView native. Warna dari token tema; tema widget mengikuti tema aplikasi.
 * Header harga, rentang tanggal, dan logo dimatikan: grafik hanya tampilan, angka harga tetap dari sumber Arshif.
 */
export function chartHtml(symbol: string, theme: ChartTheme, lang: Lang, range: ChartRange = '3M'): string {
  const config = chartConfig(symbol, theme, lang, range);
  // "<" di-escape supaya isi JSON tidak bisa menutup tag <script> (simbol sudah dibatasi SYMBOL_RE, ini lapisan kedua).
  const json = JSON.stringify(config).replace(/</g, '\\u003c');
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;height:100%;background:${theme.background}}.tradingview-widget-container,.tradingview-widget-container__widget{height:100%;width:100%}</style>
</head><body><div class="tradingview-widget-container"><div class="tradingview-widget-container__widget"></div>
<script>function tvFail(){var m='${CHART_ERROR_MESSAGE}';if(window.ReactNativeWebView){window.ReactNativeWebView.postMessage(m)}else{parent.postMessage(m,'*')}}</script>
<script type="text/javascript" src="${WIDGET_PREFLIGHT_URL}" async onerror="tvFail()">${json}</script>
</div></body></html>`;
}

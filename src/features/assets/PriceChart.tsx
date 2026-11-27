import * as WebBrowser from 'expo-web-browser';
import { ExternalLink } from 'lucide-react-native';
import { createElement, useEffect, useState } from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';
import type { WebViewNavigation } from 'react-native-webview';

import { AppText, Button, Chip, Skeleton } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useTheme } from '@/theme/ThemeProvider';
import { chartArea, radius, space } from '@/theme/tokens';

import {
  CHART_ERROR_MESSAGE,
  CHART_RANGES,
  chartHtml,
  chartPageUrl,
  getPreferredChartMode,
  setPreferredChartMode,
  type ChartDisplayMode,
  type ChartRange,
} from './chartHtml';
import { FallbackPriceChart } from './FallbackPriceChart';
import { loadWebView } from './nativeWebView';

export const CHART_HEIGHT = 280;
const LOAD_TIMEOUT_MS = 12_000;

const BASE_URL = 'https://arshif.app';
const HTTPS_RE = /^https:\/\//i;

function isAllowedChartUrl(url: string): boolean {
  return (
    url === 'about:blank' ||
    url.startsWith('data:') ||
    url === BASE_URL ||
    url.startsWith(`${BASE_URL}/`) ||
    url.startsWith('https://www.tradingview-widget.com/embed-widget/') ||
    url.startsWith('https://widgets.tradingview-widget.com/') ||
    url.startsWith('https://s.tradingview.com/embed-widget/') ||
    url.startsWith('https://s3.tradingview.com/') ||
    url.startsWith('https://static.tradingview.com/')
  );
}

/**
 * Grafik TradingView di native (WebView). Versi web: PriceChart.web.tsx (iframe).
 * Binary tanpa modul WebView (Expo Go), kegagalan pemuatan, atau saat halaman blokir ISP / WebSocket terblokir:
 * pengguna juga bisa beralih langsung ke grafik area SVG bawaan kapan saja.
 */
export function PriceChart({ symbol, label }: { symbol: string; label: string }) {
  const [mode, setModeState] = useState<ChartDisplayMode>(() => getPreferredChartMode());
  const changeMode = (next: ChartDisplayMode) => {
    setPreferredChartMode(next);
    setModeState(next);
  };
  return <PriceChartBody key={symbol} symbol={symbol} label={label} mode={mode} onChangeMode={changeMode} />;
}

function PriceChartBody({
  symbol,
  label,
  mode,
  onChangeMode,
}: {
  symbol: string;
  label: string;
  mode: ChartDisplayMode;
  onChangeMode: (next: ChartDisplayMode) => void;
}) {
  const { colors, scheme } = useTheme();
  const { t, lang } = useI18n();
  const [range, setRange] = useState<ChartRange>('3M');
  const [retry, setRetry] = useState(0);
  const [hasError, setHasError] = useState(false);
  const [readyKey, setReadyKey] = useState<string | null>(null);

  const webViewComp = loadWebView();
  const chartKey = `${symbol}:${scheme}:${lang}:${range}:${retry}`;
  const state: 'loading' | 'ready' | 'error' = hasError ? 'error' : readyKey === chartKey ? 'ready' : 'loading';

  useEffect(() => {
    if (!webViewComp || mode !== 'tv' || state !== 'loading') return;
    const timer = setTimeout(() => {
      setHasError(true);
    }, LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [webViewComp, mode, state, chartKey]);

  const openExternalChart = () => {
    const url = chartPageUrl(symbol);
    void WebBrowser.openBrowserAsync(url).catch(() => Linking.openURL(url).catch(() => undefined));
  };

  const rangeRow = (
    <View style={styles.ranges}>
      {CHART_RANGES.map((r) => (
        <Chip key={r} label={t(`assets.chart.ranges.${r}`)} selected={range === r} onPress={() => setRange(r)} />
      ))}
    </View>
  );

  if (!webViewComp) {
    return (
      <View style={styles.root}>
        {rangeRow}
        <View style={[styles.fallbackBox, styles.center, styles.fallback, { backgroundColor: colors.surfaceSunken }]}>
          <FallbackPriceChart symbol={symbol} range={range} retryKey={retry} />
          <AppText variant="caption" tone="secondary" align="center">
            {t('assets.chart.unavailable')}
          </AppText>
          <Button
            label={t('assets.chart.openBrowser')}
            icon={ExternalLink}
            variant="secondary"
            size="md"
            onPress={openExternalChart}
          />
        </View>
      </View>
    );
  }

  if (mode === 'builtin') {
    return (
      <View style={styles.root}>
        {rangeRow}
        <View style={[styles.fallbackBox, styles.center, styles.fallback, { backgroundColor: colors.surfaceSunken }]}>
          <FallbackPriceChart symbol={symbol} range={range} retryKey={retry} showStatus />
          <View style={styles.actions}>
            <Button
              variant="secondary"
              size="md"
              label={t('assets.chart.useInteractive')}
              onPress={() => {
                onChangeMode('tv');
                setHasError(false);
                setRetry((r) => r + 1);
              }}
            />
            <Button
              variant="ghost"
              size="md"
              icon={ExternalLink}
              label={t('assets.chart.openBrowser')}
              onPress={openExternalChart}
            />
          </View>
        </View>
      </View>
    );
  }

  // Halaman utama dan iframe embed widget tetap di dalam WebView; tautan klik keluar HTTPS dibuka di browser.
  const guard = (req: WebViewNavigation & { isTopFrame?: boolean }) => {
    if (req.isTopFrame === false || isAllowedChartUrl(req.url)) return true;
    if (HTTPS_RE.test(req.url) && (!req.navigationType || req.navigationType === 'click')) {
      void Linking.openURL(req.url).catch(() => undefined);
    }
    return false;
  };

  if (state === 'error') {
    return (
      <View style={styles.root}>
        {rangeRow}
        <View style={[styles.fallbackBox, styles.center, styles.fallback, { backgroundColor: colors.surfaceSunken }]}>
          <FallbackPriceChart symbol={symbol} range={range} retryKey={retry} />
          <AppText variant="caption" tone="secondary" align="center">
            {t('assets.chart.error')}
          </AppText>
          <View style={styles.actions}>
            <Button
              variant="secondary"
              size="md"
              label={t('common.retry')}
              onPress={() => {
                setHasError(false);
                setRetry((r) => r + 1);
              }}
            />
            <Button
              variant="ghost"
              size="md"
              icon={ExternalLink}
              label={t('assets.chart.openBrowser')}
              onPress={openExternalChart}
            />
          </View>
        </View>
      </View>
    );
  }

  const webViewStyle = [
    styles.webview,
    Platform.OS === 'android' ? styles.webviewAndroid : null,
    { backgroundColor: colors.surface },
  ];

  return (
    <View style={styles.root}>
      {rangeRow}
      <View style={styles.box} accessibilityLabel={label}>
        {createElement(webViewComp, {
          key: chartKey,
          source: {
            html: chartHtml(
              symbol,
              {
                scheme,
                background: colors.surface,
                grid: colors.border,
                line: chartArea[scheme].line,
                fill: chartArea[scheme].fill,
                text: colors.textMuted,
              },
              lang,
              range,
            ),
            baseUrl: BASE_URL,
          },
          javaScriptEnabled: true,
          domStorageEnabled: true,
          thirdPartyCookiesEnabled: true,
          originWhitelist: ['*'],
          androidLayerType: 'hardware',
          overScrollMode: 'never',
          bounces: false,
          showsHorizontalScrollIndicator: false,
          showsVerticalScrollIndicator: false,
          onShouldStartLoadWithRequest: guard,
          onOpenWindow: (e) => {
            const url = e.nativeEvent.targetUrl;
            if (HTTPS_RE.test(url)) void Linking.openURL(url).catch(() => undefined);
          },
          onLoadEnd: () => setReadyKey(chartKey),
          onError: () => setHasError(true),
          onHttpError: (e) => {
            if (!e?.nativeEvent?.statusCode || e.nativeEvent.statusCode >= 400) setHasError(true);
          },
          onRenderProcessGone: () => setHasError(true),
          onContentProcessDidTerminate: () => setHasError(true),
          onMessage: (e) => e.nativeEvent.data === CHART_ERROR_MESSAGE && setHasError(true),
          scrollEnabled: false,
          containerStyle: [styles.webviewContainer, { backgroundColor: colors.surface }],
          style: webViewStyle,
        })}
        {state === 'loading' && (
          <View style={StyleSheet.absoluteFill}>
            <Skeleton height={CHART_HEIGHT} radius={radius.inset} />
          </View>
        )}
      </View>
      <View style={styles.footer}>
        <AppText variant="caption" tone="muted" style={styles.footerHint}>
          {t('assets.chart.troubleHint')}
        </AppText>
        <Button variant="ghost" size="sm" label={t('assets.chart.useBuiltin')} onPress={() => onChangeMode('builtin')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.sm },
  ranges: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  box: { height: CHART_HEIGHT, borderRadius: radius.inset, overflow: 'hidden' },
  webviewContainer: { flex: 1 },
  webview: { flex: 1 },
  // Di Android, WebView di dalam container ber-borderRadius + overflow: 'hidden' di dalam ScrollView membutuhkan opacity < 1 agar tidak kosong/flicker.
  webviewAndroid: { opacity: 0.99 },
  fallbackBox: { minHeight: CHART_HEIGHT, borderRadius: radius.inset },
  center: { alignItems: 'center', justifyContent: 'center', padding: space.lg },
  fallback: { gap: space.md },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.sm },
  footer: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: space.xs },
  footerHint: { flexShrink: 1 },
});

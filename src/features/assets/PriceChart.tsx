import * as WebBrowser from 'expo-web-browser';
import { ExternalLink } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import type { WebViewNavigation } from 'react-native-webview';

import { AppText, Button, Chip, Skeleton } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useTheme } from '@/theme/ThemeProvider';
import { chartArea, radius, space } from '@/theme/tokens';

import { CHART_ERROR_MESSAGE, CHART_RANGES, chartHtml, chartPageUrl, type ChartRange } from './chartHtml';
import { loadWebView } from './nativeWebView';

export const CHART_HEIGHT = 280;

const BASE_URL = 'https://arshif.app';
const HTTPS_RE = /^https:\/\//i;

function isAllowedChartUrl(url: string): boolean {
  return (
    url === 'about:blank' ||
    url.startsWith('data:') ||
    url === BASE_URL ||
    url.startsWith(`${BASE_URL}/`) ||
    url.startsWith('https://www.tradingview-widget.com/embed-widget/') ||
    url.startsWith('https://s.tradingview.com/embed-widget/') ||
    url.startsWith('https://s3.tradingview.com/')
  );
}

/**
 * Grafik TradingView di native (WebView). Versi web: PriceChart.web.tsx (iframe).
 * Binary tanpa modul WebView (Expo Go): kartu cadangan yang membuka chart di browser, bukan crash.
 */
export function PriceChart({ symbol, label }: { symbol: string; label: string }) {
  const { colors, scheme } = useTheme();
  const { t, lang } = useI18n();
  const [range, setRange] = useState<ChartRange>('3M');
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    setRange('3M');
  }, [symbol]);

  const chartKey = `${symbol}:${scheme}:${lang}:${range}:${retry}`;
  useEffect(() => {
    setState('loading');
  }, [chartKey]);

  const WebView = loadWebView();
  const openExternalChart = () => {
    const url = chartPageUrl(symbol);
    void WebBrowser.openBrowserAsync(url).catch(() => Linking.openURL(url).catch(() => undefined));
  };

  if (!WebView) {
    return (
      <View style={[styles.box, styles.center, styles.fallback, { backgroundColor: colors.surfaceSunken }]}>
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
    );
  }

  // Halaman utama dan iframe embed widget tetap di dalam WebView; tautan keluar HTTPS dibuka di browser.
  const guard = (req: WebViewNavigation & { isTopFrame?: boolean }) => {
    if (req.isTopFrame === false || isAllowedChartUrl(req.url)) return true;
    if (HTTPS_RE.test(req.url)) void Linking.openURL(req.url).catch(() => undefined);
    return false;
  };

  const rangeRow = (
    <View style={styles.ranges}>
      {CHART_RANGES.map((r) => (
        <Chip key={r} label={t(`assets.chart.ranges.${r}`)} selected={range === r} onPress={() => setRange(r)} />
      ))}
    </View>
  );

  if (state === 'error') {
    return (
      <View style={styles.root}>
        {rangeRow}
        <View style={[styles.box, styles.center, styles.fallback, { backgroundColor: colors.surfaceSunken }]}>
          <AppText variant="caption" tone="secondary" align="center">
            {t('assets.chart.error')}
          </AppText>
          <View style={styles.actions}>
            <Button
              variant="secondary"
              size="md"
              label={t('common.retry')}
              onPress={() => {
                setState('loading');
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

  return (
    <View style={styles.root}>
      {rangeRow}
      <View style={styles.box} accessible accessibilityRole="image" accessibilityLabel={label}>
        <WebView
          key={chartKey}
          source={{
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
          }}
          originWhitelist={['*']}
          onShouldStartLoadWithRequest={guard}
          onOpenWindow={(e) => {
            const url = e.nativeEvent.targetUrl;
            if (HTTPS_RE.test(url)) void Linking.openURL(url).catch(() => undefined);
          }}
          onLoadEnd={() => setState((s) => (s === 'loading' ? 'ready' : s))}
          onError={() => setState('error')}
          onHttpError={() => setState('error')}
          onMessage={(e) => e.nativeEvent.data === CHART_ERROR_MESSAGE && setState('error')}
          scrollEnabled={false}
          style={{ backgroundColor: colors.surface }}
        />
        {state === 'loading' && (
          <View style={StyleSheet.absoluteFill}>
            <Skeleton height={CHART_HEIGHT} radius={radius.inset} />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.sm },
  ranges: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  box: { height: CHART_HEIGHT, borderRadius: radius.inset, overflow: 'hidden' },
  center: { alignItems: 'center', justifyContent: 'center', padding: space.lg },
  fallback: { gap: space.md },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.sm },
});

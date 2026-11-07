import * as WebBrowser from 'expo-web-browser';
import { ExternalLink } from 'lucide-react-native';
import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import type { WebViewNavigation } from 'react-native-webview';

import { AppText, Button, Skeleton } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useTheme } from '@/theme/ThemeProvider';
import { chartArea, radius, space } from '@/theme/tokens';

import { CHART_ERROR_MESSAGE, chartHtml, chartPageUrl } from './chartHtml';
import { loadWebView } from './nativeWebView';

export const CHART_HEIGHT = 280;

/**
 * Grafik TradingView di native (WebView). Versi web: PriceChart.web.tsx (iframe).
 * Binary tanpa modul WebView (Expo Go): kartu cadangan yang membuka chart di browser, bukan crash.
 */
export function PriceChart({ symbol, label }: { symbol: string; label: string }) {
  const { colors, scheme } = useTheme();
  const { t, lang } = useI18n();
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const WebView = loadWebView();

  if (!WebView) {
    const url = chartPageUrl(symbol);
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
          onPress={() => void WebBrowser.openBrowserAsync(url).catch(() => Linking.openURL(url).catch(() => undefined))}
        />
      </View>
    );
  }

  // Halaman utama tetap di HTML lokal; tautan atribusi TradingView dibuka di browser, bukan di dalam kartu.
  const guard = (req: WebViewNavigation & { isTopFrame?: boolean }) => {
    if (req.url === 'about:blank' || req.url.startsWith('data:') || req.isTopFrame === false) return true;
    void Linking.openURL(req.url).catch(() => undefined);
    return false;
  };

  if (state === 'error') {
    return (
      <View style={[styles.box, styles.center, { backgroundColor: colors.surfaceSunken }]}>
        <AppText variant="caption" tone="secondary" align="center">
          {t('assets.chart.error')}
        </AppText>
      </View>
    );
  }
  return (
    <View style={styles.box} accessible accessibilityRole="image" accessibilityLabel={label}>
      <WebView
        source={{ html: chartHtml(symbol, { scheme, background: colors.surface, grid: colors.border, line: chartArea[scheme].line, fill: chartArea[scheme].fill, text: colors.textMuted }, lang) }}
        originWhitelist={['*']}
        onShouldStartLoadWithRequest={guard}
        onLoadEnd={() => setState((s) => (s === 'loading' ? 'ready' : s))}
        onError={() => setState('error')}
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
  );
}

const styles = StyleSheet.create({
  box: { height: CHART_HEIGHT, borderRadius: radius.inset, overflow: 'hidden' },
  center: { alignItems: 'center', justifyContent: 'center', padding: space.lg },
  fallback: { gap: space.md },
});

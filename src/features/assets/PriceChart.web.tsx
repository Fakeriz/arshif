import { ExternalLink } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Chip, Skeleton } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useTheme } from '@/theme/ThemeProvider';
import { chartArea, radius, space } from '@/theme/tokens';

import { CHART_RANGES, chartPageUrl, chartWidgetUrl, WIDGET_PREFLIGHT_URL, type ChartRange } from './chartHtml';

export const CHART_HEIGHT = 280;
const LOAD_TIMEOUT_MS = 12_000;

/** Grafik TradingView di web: iframe cross-origin langsung ke widget embed resmi. Versi native: PriceChart.tsx (WebView). */
export function PriceChart({ symbol, label }: { symbol: string; label: string }) {
  const { colors, scheme } = useTheme();
  const { t, lang } = useI18n();
  const [range, setRange] = useState<ChartRange>('3M');
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>(() =>
    typeof navigator !== 'undefined' && navigator.onLine === false ? 'error' : 'loading',
  );

  useEffect(() => {
    setRange('3M');
  }, [symbol]);

  const widgetUrl = chartWidgetUrl(
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
  );
  const iframeKey = `${widgetUrl}#r=${retry}`;

  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setState('error');
      return;
    }
    setState('loading');

    const onOffline = () => setState('error');
    const canListen = typeof window !== 'undefined' && typeof window.addEventListener === 'function';
    if (canListen) window.addEventListener('offline', onOffline);

    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    if (typeof fetch === 'function') {
      fetch(WIDGET_PREFLIGHT_URL, {
        mode: 'no-cors',
        cache: 'no-store',
        signal: controller?.signal,
      }).catch(() => {
        if (!controller?.signal.aborted) setState('error');
      });
    }

    const timer = setTimeout(() => {
      setState((s) => (s === 'loading' ? 'error' : s));
    }, LOAD_TIMEOUT_MS);

    return () => {
      controller?.abort();
      clearTimeout(timer);
      if (canListen && typeof window.removeEventListener === 'function') window.removeEventListener('offline', onOffline);
    };
  }, [iframeKey]);

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
              onPress={() => {
                if (typeof window !== 'undefined' && typeof window.open === 'function') {
                  window.open(chartPageUrl(symbol), '_blank', 'noopener,noreferrer');
                }
              }}
            />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {rangeRow}
      <View style={styles.box}>
        <iframe
          key={iframeKey}
          title={label}
          src={widgetUrl}
          // Iframe cross-origin (www.tradingview-widget.com): allow-same-origin memberi akses cookie origin widget sendiri
          // tanpa pernah bisa menyentuh origin/storage Arshif.
          sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
          referrerPolicy="no-referrer"
          onLoad={() => setState((s) => (s === 'loading' ? 'ready' : s))}
          onError={() => setState('error')}
          style={{ border: 0, width: '100%', height: CHART_HEIGHT, display: 'block', background: colors.surface }}
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

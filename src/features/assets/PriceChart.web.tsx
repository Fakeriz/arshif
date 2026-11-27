import { ExternalLink } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Chip, Skeleton } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useTheme } from '@/theme/ThemeProvider';
import { chartArea, radius, space } from '@/theme/tokens';

import {
  CHART_RANGES,
  chartPageUrl,
  chartPreflightUrl,
  chartWidgetUrl,
  getPreferredChartMode,
  setPreferredChartMode,
  type ChartDisplayMode,
  type ChartRange,
} from './chartHtml';
import { FallbackPriceChart } from './FallbackPriceChart';

export const CHART_HEIGHT = 280;
const LOAD_TIMEOUT_MS = 12_000;

const isBrowserOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false;

/**
 * Grafik TradingView di web: iframe cross-origin langsung ke widget embed resmi. Versi native: PriceChart.tsx (WebView).
 * Menyediakan pengalih langsung ke grafik SVG bawaan bila iframe diintersepsi halaman blokir ISP HTTP 200,
 * WebSocket widgetdata terblokir, atau simbol tidak tersedia di widget TradingView.
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
  const [hasError, setHasError] = useState(() => isBrowserOffline());
  const [readyKey, setReadyKey] = useState<string | null>(null);
  const readyKeyRef = useRef<string | null>(null);

  const preflightUrl = chartPreflightUrl(lang);
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
  const state: 'loading' | 'ready' | 'error' = hasError ? 'error' : readyKey === iframeKey ? 'ready' : 'loading';

  useEffect(() => {
    readyKeyRef.current = readyKey;
  }, [readyKey]);

  useEffect(() => {
    if (mode !== 'tv' || !hasError) return;
    const canListen = typeof window !== 'undefined' && typeof window.addEventListener === 'function';
    if (!canListen) return;
    const onOnline = () => {
      setHasError(false);
      setRetry((r) => r + 1);
    };
    window.addEventListener('online', onOnline);
    return () => {
      if (typeof window.removeEventListener === 'function') window.removeEventListener('online', onOnline);
    };
  }, [mode, hasError]);

  useEffect(() => {
    if (mode !== 'tv' || hasError) return;

    const onOffline = () => setHasError(true);
    const canListen = typeof window !== 'undefined' && typeof window.addEventListener === 'function';
    if (canListen) window.addEventListener('offline', onOffline);

    let preflightDone = false;
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    if (isBrowserOffline()) {
      const offlineTimer = setTimeout(() => setHasError(true), 0);
      return () => {
        clearTimeout(offlineTimer);
        if (canListen && typeof window.removeEventListener === 'function') window.removeEventListener('offline', onOffline);
      };
    }

    if (typeof fetch === 'function') {
      fetch(preflightUrl, {
        mode: 'no-cors',
        cache: 'no-store',
        signal: controller?.signal,
      })
        .then(() => {
          preflightDone = true;
        })
        .catch(() => {
          if (!controller?.signal.aborted) setHasError(true);
        });
    } else {
      preflightDone = true;
    }

    const timer = setTimeout(() => {
      if (!preflightDone || readyKeyRef.current !== iframeKey) {
        setHasError(true);
      }
      if (!preflightDone) controller?.abort();
    }, LOAD_TIMEOUT_MS);

    return () => {
      controller?.abort();
      clearTimeout(timer);
      if (canListen && typeof window.removeEventListener === 'function') window.removeEventListener('offline', onOffline);
    };
  }, [mode, iframeKey, preflightUrl, hasError]);

  const openExternalChart = () => {
    if (typeof window !== 'undefined' && typeof window.open === 'function') {
      window.open(chartPageUrl(symbol), '_blank', 'noopener,noreferrer');
    }
  };

  const rangeRow = (
    <View style={styles.ranges}>
      {CHART_RANGES.map((r) => (
        <Chip
          key={r}
          label={t(`assets.chart.ranges.${r}`)}
          selected={range === r}
          onPress={() => {
            setRange(r);
            if (mode === 'tv' && !hasError && isBrowserOffline()) setHasError(true);
          }}
        />
      ))}
    </View>
  );

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
                setHasError(isBrowserOffline());
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
                setHasError(isBrowserOffline());
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
      <View style={styles.box}>
        <iframe
          key={iframeKey}
          title={label}
          src={widgetUrl}
          // Iframe cross-origin (www.tradingview-widget.com): allow-same-origin memberi akses cookie origin widget sendiri
          // tanpa pernah bisa menyentuh origin/storage Arshif.
          sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
          referrerPolicy="no-referrer"
          onLoad={() => {
            readyKeyRef.current = iframeKey;
            setReadyKey(iframeKey);
          }}
          onError={() => setHasError(true)}
          style={{ border: 0, width: '100%', height: CHART_HEIGHT, display: 'block', background: colors.surface }}
        />
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
  fallbackBox: { minHeight: CHART_HEIGHT, borderRadius: radius.inset },
  center: { alignItems: 'center', justifyContent: 'center', padding: space.lg },
  fallback: { gap: space.md },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.sm },
  footer: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: space.xs },
  footerHint: { flexShrink: 1 },
});

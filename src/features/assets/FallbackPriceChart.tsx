import { useEffect, useId, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { AppText, Skeleton, TrendBadge } from '@/components/ui';
import { useI18n } from '@/i18n';
import { areaUnder, datedLinePoints, pctChange, smoothPath } from '@/lib/chart';
import { shortDate } from '@/lib/dates';
import { formatUnitPrice } from '@/lib/money';
import { useAssetsOptional } from '@/state/assets';
import { useTheme } from '@/theme/ThemeProvider';
import { chartArea, radius, space } from '@/theme/tokens';

import type { ChartRange } from './chartHtml';
import { fetchChartSeries, parseChartSymbol, type ChartSeries } from './chartSeries';

const SVG_HEIGHT = 156;

const ymdOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/**
 * Grafik area SVG Monokrom berbasis data historis nyata saat pengguna memakai grafik bawaan
 * atau saat widget interaktif TradingView tidak tersedia (Expo Go / domain widget terblokir).
 */
export function FallbackPriceChart({
  symbol,
  range,
  retryKey = 0,
  showStatus = false,
}: {
  symbol: string;
  range: ChartRange;
  retryKey?: number;
  /** Tampilkan skeleton saat memuat dan pesan kosong jujur bila data < 2 titik (mode grafik bawaan). */
  showStatus?: boolean;
}) {
  const { t, lang } = useI18n();
  const { colors, scheme } = useTheme();
  const assetsCtx = useAssetsOptional();
  const requestKey = `${symbol}|${range}|${retryKey}`;
  const [resolved, setResolved] = useState<{ symbol: string; key: string; series: ChartSeries | null } | null>(null);
  const [width, setWidth] = useState(0);
  const gradId = `fpc-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;

  const parsed = parseChartSymbol(symbol);
  const cachedHistory = parsed ? assetsCtx?.history?.[parsed.priceKey] : undefined;
  const livePrice = parsed ? assetsCtx?.prices?.[parsed.priceKey] : undefined;
  const historyCount = cachedHistory?.length ?? 0;
  const hasLivePrice = livePrice !== undefined ? 1 : 0;
  const metaRef = useRef({ cachedHistory, livePrice });
  const resolvedRef = useRef(resolved);

  useEffect(() => {
    metaRef.current = { cachedHistory, livePrice };
  }, [cachedHistory, livePrice]);

  useEffect(() => {
    resolvedRef.current = resolved;
  }, [resolved]);

  useEffect(() => {
    if (resolvedRef.current?.key === requestKey && (resolvedRef.current.series?.points.length ?? 0) >= 2) {
      return;
    }
    let active = true;
    const controller = typeof AbortController === 'function' ? new AbortController() : null;

    fetchChartSeries(symbol, range, {
      signal: controller?.signal,
      cachedHistory: metaRef.current.cachedHistory,
      livePrice: metaRef.current.livePrice,
    })
      .then((res) => {
        if (!active) return;
        const next = { symbol, key: requestKey, series: res };
        resolvedRef.current = next;
        setResolved(next);
      })
      .catch(() => {
        if (!active) return;
        const next = { symbol, key: requestKey, series: null };
        resolvedRef.current = next;
        setResolved(next);
      });

    return () => {
      active = false;
      controller?.abort();
    };
  }, [symbol, range, retryKey, requestKey, historyCount, hasLivePrice]);

  const loading = resolved?.key !== requestKey;
  const series = resolved?.symbol === symbol ? resolved.series : null;

  if (!series || series.points.length < 2) {
    if (!showStatus) return null;
    if (loading) {
      return (
        <View key="fallback-loading" testID="fallback-price-chart-loading" style={styles.wrap}>
          <Skeleton height={SVG_HEIGHT} radius={radius.sm} />
        </View>
      );
    }
    return (
      <AppText variant="caption" tone="secondary" align="center">
        {t('assets.chart.builtinEmpty')}
      </AppText>
    );
  }

  const first = series.points[0]!;
  const last = series.points[series.points.length - 1]!;
  const values = series.points.map((p) => p.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const minSpan = Math.max(1e-8, Math.abs((minVal + maxVal) / 2) * 0.02);
  const pts = datedLinePoints(series.points, width, SVG_HEIGHT, 4, 8, minSpan);
  const line = smoothPath(pts);
  const area = areaUnder(line, pts, SVG_HEIGHT);
  const lastPt = pts[pts.length - 1];
  const areaColors = chartArea[scheme];
  const change = pctChange(first.value, last.value);
  const fromLabel = shortDate(ymdOf(first.dayMs), lang);
  const toLabel = shortDate(ymdOf(last.dayMs), lang);
  const rangeSummary =
    minVal === maxVal
      ? formatUnitPrice(maxVal, series.currency)
      : `${formatUnitPrice(minVal, series.currency)} - ${formatUnitPrice(maxVal, series.currency)}`;

  return (
    <View
      key="fallback-chart"
      testID="fallback-price-chart"
      style={[styles.wrap, loading && styles.updating]}
      accessible
      accessibilityLabel={t('assets.chart.builtinA11y', {
        symbol,
        from: fromLabel,
        to: toLabel,
        amount: formatUnitPrice(last.value, series.currency),
      })}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      <View style={styles.header}>
        <AppText variant="caption" tone="muted" numeric>
          {rangeSummary}
        </AppText>
        {change !== null && change !== 0 && <TrendBadge value={change} />}
      </View>
      <View style={{ height: SVG_HEIGHT }}>
        {width > 0 && pts.length > 1 && (
          <Svg width={width} height={SVG_HEIGHT}>
            <Defs>
              <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={areaColors.line} stopOpacity={0.18} />
                <Stop offset="1" stopColor={areaColors.line} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Path d={area} fill={`url(#${gradId})`} />
            <Path d={line} fill="none" stroke={areaColors.line} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            {lastPt && (
              <Circle cx={lastPt.x} cy={lastPt.y} r={3.5} fill={areaColors.line} stroke={colors.surfaceSunken} strokeWidth={1.5} />
            )}
          </Svg>
        )}
      </View>
      <View style={styles.axis}>
        <AppText variant="caption" tone="muted">
          {fromLabel}
        </AppText>
        <AppText variant="caption" tone="muted">
          {toLabel}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', alignSelf: 'stretch', gap: space.xs },
  updating: { opacity: 0.72 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: space.xs },
  axis: { flexDirection: 'row', justifyContent: 'space-between' },
});

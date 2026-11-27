import { useId, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { AppText, Chip } from '@/components/ui';
import type { NetWorthSnapshot } from '@/data/assets';
import { useI18n } from '@/i18n';
import { convertSnapshot } from '@/lib/assets';
import { areaUnder, datedLinePoints, smoothPath } from '@/lib/chart';
import { addDays, shortDate } from '@/lib/dates';
import { formatCompact, formatMoney } from '@/lib/money';
import { useTheme } from '@/theme/ThemeProvider';
import { chartArea, radius, space } from '@/theme/tokens';

const HEIGHT = 120;
const PERIODS = ['1M', '3M', '12M'] as const;
type Period = (typeof PERIODS)[number];
const PERIOD_DAYS: Record<Period, number> = { '1M': 30, '3M': 90, '12M': 365 };

/** Garis kekayaan bersih dari snapshot harian. Statis: angka persisnya ada di judul tab. */
/** `fill` (desktop): grafik setinggi ruang yang tersedia di kartunya, bukan tinggi tetap. */
export function NetWorthChart({
  snapshots,
  currency,
  fill,
  hidden,
}: {
  snapshots: NetWorthSnapshot[];
  currency: string;
  fill?: boolean;
  hidden?: boolean;
}) {
  const { t, lang } = useI18n();
  const { colors: palette, scheme } = useTheme();
  const [size, setSize] = useState({ width: 0, height: HEIGHT });
  const [period, setPeriod] = useState<Period>('12M');
  const gradId = `nw-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const { width } = size;
  const height = fill ? Math.max(HEIGHT, size.height) : HEIGHT;

  const allSeries = snapshots
    .map((s) => convertSnapshot(s, currency))
    .filter((s): s is NetWorthSnapshot => s !== null)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (allSeries.length < 2) {
    return (
      <AppText variant="caption" tone="secondary">
        {t('assets.chartEmpty')}
      </AppText>
    );
  }

  if (hidden) {
    return (
      <View style={[styles.wrap, fill && styles.fill]} accessible accessibilityLabel={t('common.balanceHidden')}>
        <View style={[styles.masked, fill ? styles.fill : { height: HEIGHT }, { backgroundColor: palette.surfaceSunken }]}>
          <AppText variant="bodyStrong" tone="muted">
            ••••
          </AppText>
        </View>
      </View>
    );
  }

  const firstAll = allSeries[0]!;
  const lastAll = allSeries[allSeries.length - 1]!;
  const spanMs = Date.parse(`${lastAll.date}T00:00:00Z`) - Date.parse(`${firstAll.date}T00:00:00Z`);
  const showPeriods = spanMs > 30 * 86_400_000;
  const cutoff = addDays(lastAll.date, -PERIOD_DAYS[period]);
  const filtered = allSeries.filter((s) => s.date >= cutoff);
  const series = filtered.length >= 2 ? filtered : allSeries;

  const first = series[0]!;
  const last = series[series.length - 1]!;
  const values = series.map((s) => s.total);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const minSpan = Math.max(1, Math.abs((minVal + maxVal) / 2) * 0.02);
  const items = series.map((s) => ({ dayMs: Date.parse(`${s.date}T00:00:00Z`), value: s.total }));
  const pts = datedLinePoints(items, width, height, 4, 8, minSpan);
  const line = smoothPath(pts);
  const area = areaUnder(line, pts, height);
  const lastPt = pts[pts.length - 1];
  const areaColors = chartArea[scheme];
  const rangeText =
    minVal === maxVal
      ? formatCompact(maxVal, currency)
      : `${formatCompact(minVal, currency)} – ${formatCompact(maxVal, currency)}`;

  return (
    <View style={[styles.wrap, fill && styles.fill]}>
      <View style={styles.meta}>
        <AppText variant="caption" tone="muted" numeric>
          {rangeText}
        </AppText>
        {showPeriods && (
          <View style={styles.periods}>
            {PERIODS.map((p) => (
              <Chip key={p} label={t(`assets.chart.ranges.${p}`)} selected={period === p} onPress={() => setPeriod(p)} />
            ))}
          </View>
        )}
      </View>
      <View
        style={[styles.wrap, fill && styles.fill]}
        accessible
        accessibilityLabel={t('assets.chartA11y', { from: shortDate(first.date, lang), to: shortDate(last.date, lang), amount: formatMoney(last.total, currency) })}
      >
        <View
          style={fill ? styles.fill : { height: HEIGHT }}
          onLayout={(e) => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
        >
          {width > 0 && pts.length > 1 && (
            <Svg width={width} height={height}>
              <Defs>
                <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={areaColors.line} stopOpacity={0.18} />
                  <Stop offset="1" stopColor={areaColors.line} stopOpacity={0} />
                </LinearGradient>
              </Defs>
              <Path d={area} fill={`url(#${gradId})`} />
              <Path d={line} fill="none" stroke={areaColors.line} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              {lastPt && (
                <Circle cx={lastPt.x} cy={lastPt.y} r={3.5} fill={areaColors.line} stroke={palette.surface} strokeWidth={1.5} />
              )}
            </Svg>
          )}
        </View>
        <View style={styles.axis}>
          <AppText variant="caption" tone="muted">
            {shortDate(first.date, lang)}
          </AppText>
          <AppText variant="caption" tone="muted">
            {shortDate(last.date, lang)}
          </AppText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  fill: { flex: 1, minHeight: HEIGHT },
  meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: space.xs },
  periods: { flexDirection: 'row', gap: space.xs },
  axis: { flexDirection: 'row', justifyContent: 'space-between' },
  masked: { borderRadius: radius.inset, alignItems: 'center', justifyContent: 'center' },
});

import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path, Polyline } from 'react-native-svg';

import { AppText } from '@/components/ui';
import type { NetWorthSnapshot } from '@/data/assets';
import { useI18n } from '@/i18n';
import { linePoints } from '@/lib/chart';
import { shortDate } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { useTheme } from '@/theme/ThemeProvider';
import { chartArea, space } from '@/theme/tokens';

const HEIGHT = 120;

/** Garis kekayaan bersih dari snapshot harian. Statis: angka persisnya ada di judul tab. */
/** `fill` (desktop): grafik setinggi ruang yang tersedia di kartunya, bukan tinggi tetap. */
export function NetWorthChart({ snapshots, currency, fill }: { snapshots: NetWorthSnapshot[]; currency: string; fill?: boolean }) {
  const { t, lang } = useI18n();
  const { scheme } = useTheme();
  const [size, setSize] = useState({ width: 0, height: HEIGHT });
  const { width } = size;
  const height = fill ? Math.max(HEIGHT, size.height) : HEIGHT;
  const series = snapshots.filter((s) => s.currency === currency);

  if (series.length < 2) {
    return (
      <AppText variant="caption" tone="secondary">
        {t('assets.chartEmpty')}
      </AppText>
    );
  }

  const first = series[0];
  const last = series[series.length - 1];
  const values = series.map((s) => s.total);
  const pts = linePoints(values, width, height);
  const line = pts.map((p) => `${p.x},${p.y}`).join(' ');
  const area = pts.length > 1 ? `M${pts[0].x},${height} L${line.replace(/ /g, ' L')} L${pts[pts.length - 1].x},${height} Z` : '';
  const colors = chartArea[scheme];

  return (
    <View
      style={[styles.wrap, fill && styles.fill]}
      accessible
      accessibilityLabel={t('assets.chartA11y', { from: shortDate(first.date, lang), to: shortDate(last.date, lang), amount: formatMoney(last.total, currency) })}
    >
      <View
        style={fill ? styles.fill : { height: HEIGHT }}
        onLayout={(e) => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
      >
        {width > 0 && (
          <Svg width={width} height={height}>
            <Path d={area} fill={colors.fill} />
            <Polyline points={line} fill="none" stroke={colors.line} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
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
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  fill: { flex: 1, minHeight: HEIGHT },
  axis: { flexDirection: 'row', justifyContent: 'space-between' },
});

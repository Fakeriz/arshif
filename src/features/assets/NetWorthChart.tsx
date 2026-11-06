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
export function NetWorthChart({ snapshots, currency }: { snapshots: NetWorthSnapshot[]; currency: string }) {
  const { t, lang } = useI18n();
  const { scheme } = useTheme();
  const [width, setWidth] = useState(0);
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
  const pts = linePoints(values, width, HEIGHT);
  const line = pts.map((p) => `${p.x},${p.y}`).join(' ');
  const area = pts.length > 1 ? `M${pts[0].x},${HEIGHT} L${line.replace(/ /g, ' L')} L${pts[pts.length - 1].x},${HEIGHT} Z` : '';
  const colors = chartArea[scheme];

  return (
    <View
      style={styles.wrap}
      accessible
      accessibilityLabel={t('assets.chartA11y', { from: shortDate(first.date, lang), to: shortDate(last.date, lang), amount: formatMoney(last.total, currency) })}
    >
      <View style={{ height: HEIGHT }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 && (
          <Svg width={width} height={HEIGHT}>
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
  axis: { flexDirection: 'row', justifyContent: 'space-between' },
});

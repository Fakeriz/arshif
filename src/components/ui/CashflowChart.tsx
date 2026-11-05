import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Line, Rect } from 'react-native-svg';

import { niceCeil } from '@/lib/chart';
import { formatCompact } from '@/lib/money';
import { haptic } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

import { AppText } from './AppText';
import { CashflowSummary } from './CashflowSummary';
import { EmptyState } from './EmptyState';
import { Skeleton } from './Skeleton';

export type CashflowPoint = { label: string; income: number; expense: number };

export type CashflowChartProps = {
  data: CashflowPoint[];
  currency: string;
  height?: number;
  loading?: boolean;
};

const AXIS_W = 44;

/** Batang berpasangan pemasukan vs pengeluaran per periode. Ketuk kolom untuk rinciannya. */
export function CashflowChart({ data, currency, height = 180, loading }: CashflowChartProps) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState(Math.max(0, data.length - 1));

  if (loading) {
    return (
      <View style={styles.wrap}>
        <Skeleton height={56} radius={radius.md} />
        <Skeleton height={height} radius={radius.md} />
      </View>
    );
  }
  const hasData = data.some((d) => d.income > 0 || d.expense > 0);
  if (!hasData) {
    return <EmptyState compact title="Belum ada arus kas" message="Catat transaksi pertamamu untuk melihat tren bulanan." />;
  }

  const max = niceCeil(Math.max(...data.flatMap((d) => [d.income, d.expense])));
  const plotW = Math.max(0, width - AXIS_W);
  const col = data.length > 0 ? plotW / data.length : 0;
  const barW = Math.min(14, col * 0.28);
  const y = (v: number) => height - (Math.max(0, v) / max) * height;
  const point = data[Math.min(selected, data.length - 1)];

  return (
    <View style={styles.wrap}>
      <CashflowSummary point={point} currency={currency} />
      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ height: height + 24 }}>
        {width > 0 && (
          <>
            <Svg width={width} height={height}>
              {[0, 0.5, 1].map((t) => (
                <Line key={t} x1={AXIS_W} x2={width} y1={height * t} y2={height * t} stroke={colors.border} strokeWidth={1} />
              ))}
              {data.map((d, i) => {
                const x = AXIS_W + i * col + col / 2;
                const dim = i !== selected ? 0.4 : 1;
                return [
                  <Rect key={`i${i}`} x={x - barW - 2} y={y(d.income)} width={barW} height={height - y(d.income)} rx={barW / 2.5} fill={colors.positive} opacity={dim} />,
                  <Rect key={`e${i}`} x={x + 2} y={y(d.expense)} width={barW} height={height - y(d.expense)} rx={barW / 2.5} fill={colors.textSecondary} opacity={dim} />,
                ];
              })}
            </Svg>
            <View style={[StyleSheet.absoluteFill, styles.yAxis]} pointerEvents="none">
              {[max, max / 2, 0].map((v, i) => (
                <AppText key={i} variant="caption" tone="muted" numeric style={[styles.yLabel, { top: (height * i) / 2 - 9 }]}>
                  {formatCompact(Math.round(v), currency)}
                </AppText>
              ))}
            </View>
            <View style={[styles.columns, { left: AXIS_W, height: height + 24 }]}>
              {data.map((d, i) => (
                <Pressable
                  key={d.label}
                  accessibilityRole="button"
                  accessibilityLabel={`${d.label}: pemasukan ${formatCompact(d.income, currency)}, pengeluaran ${formatCompact(d.expense, currency)}`}
                  accessibilityState={{ selected: i === selected }}
                  onPress={() => {
                    haptic('tap');
                    setSelected(i);
                  }}
                  style={styles.column}
                >
                  <AppText variant="caption" tone={i === selected ? 'primary' : 'muted'} numberOfLines={1}>
                    {d.label}
                  </AppText>
                </Pressable>
              ))}
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.lg, alignSelf: 'stretch' },
  yAxis: { width: AXIS_W },
  yLabel: { position: 'absolute', left: 0, fontSize: 11 },
  columns: { position: 'absolute', top: 0, right: 0, flexDirection: 'row' },
  column: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
});

import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import Svg, { Circle, G, Path } from 'react-native-svg';

import { annularSector, donutSlices } from '@/lib/chart';
import { haptic, useMotion } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';
import { motion, radius, space } from '@/theme/tokens';

import { AppText } from './AppText';
import { CurrencyText } from './CurrencyText';
import { DonutLegend } from './DonutLegend';
import { Skeleton } from './Skeleton';

export type DonutSegment = { key: string; label: string; value: number; color: string; caption?: string };

export type DonutChartProps = {
  segments: DonutSegment[];
  currency: string;
  centerLabel?: string;
  size?: number;
  loading?: boolean;
  emptyLabel?: string;
  showLegend?: boolean;
  onSelect?: (key: string | null) => void;
};

/** Donat interaktif: ketuk segmen atau baris legenda untuk menyorot nilainya di tengah. */
export function DonutChart({
  segments,
  currency,
  centerLabel = 'Total',
  size = 200,
  loading,
  emptyLabel = 'Belum ada data bulan ini',
  showLegend = true,
  onSelect,
}: DonutChartProps) {
  const { colors } = useTheme();
  const { timing } = useMotion();
  const [selected, setSelected] = useState<string | null>(null);
  const appear = useSharedValue(0);

  useEffect(() => {
    appear.value = timing(1, motion.slow);
  }, [appear, timing]);
  const appearStyle = useAnimatedStyle(() => ({
    opacity: appear.value,
    transform: [{ scale: 0.92 + appear.value * 0.08 }, { rotate: `${(1 - appear.value) * -30}deg` }],
  }));

  if (loading) {
    return (
      <View style={styles.wrap}>
        <Skeleton width={size} height={size} radius={radius.full} />
      </View>
    );
  }

  const total = segments.reduce((s, x) => s + Math.max(0, x.value), 0);
  const slices = donutSlices(segments.map((s) => s.value));
  const c = size / 2;
  const rOuter = c - 4;
  const rInner = rOuter * 0.72;
  const active = segments.find((s) => s.key === selected);

  const toggle = (key: string) => {
    const next = selected === key ? null : key;
    haptic('tap');
    setSelected(next);
    onSelect?.(next);
  };

  return (
    <View style={styles.wrap}>
      <View style={{ width: size, height: size }}>
        <Animated.View style={appearStyle}>
          <Svg width={size} height={size}>
            {total <= 0 ? (
              <Circle cx={c} cy={c} r={(rOuter + rInner) / 2} stroke={colors.track} strokeWidth={rOuter - rInner} fill="none" />
            ) : (
              <G>
                {segments.map((seg, i) => {
                  const sl = slices[i];
                  if (sl.share <= 0) return null;
                  const isActive = selected === seg.key;
                  return (
                    <Path
                      key={seg.key}
                      d={annularSector(c, c, isActive ? rOuter + 2 : rOuter - 2, rInner, sl.start, sl.end)}
                      fill={seg.color}
                      opacity={selected && !isActive ? 0.3 : 1}
                      onPress={() => toggle(seg.key)}
                    />
                  );
                })}
              </G>
            )}
          </Svg>
        </Animated.View>
        <View style={styles.center} pointerEvents="none">
          {total <= 0 ? (
            <AppText variant="caption" tone="muted" align="center" style={styles.centerText}>
              {emptyLabel}
            </AppText>
          ) : (
            <>
              <AppText variant="caption" tone="muted" numberOfLines={1}>
                {active ? active.label : centerLabel}
              </AppText>
              <CurrencyText amount={active ? active.value : total} currency={currency} variant="h3" style={styles.centerText} />
              {active && (
                <AppText variant="caption" tone="secondary" numeric>
                  {Math.round((active.value / total) * 100)}%
                </AppText>
              )}
            </>
          )}
        </View>
      </View>
      {showLegend && total > 0 && (
        <DonutLegend segments={segments} total={total} currency={currency} selected={selected} onToggle={toggle} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: space.xl, alignSelf: 'stretch' },
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.x3 },
  centerText: { maxWidth: '100%' },
});

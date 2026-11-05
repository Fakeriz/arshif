import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

import { AppText } from './AppText';
import { CurrencyText } from './CurrencyText';
import type { DonutSegment } from './DonutChart';
import { PressableScale } from './PressableScale';

type DonutLegendProps = {
  segments: DonutSegment[];
  total: number;
  currency: string;
  selected: string | null;
  onToggle: (key: string) => void;
};

/** Legenda yang juga berfungsi sebagai kontrol (aksesibel untuk pembaca layar). */
export function DonutLegend({ segments, total, currency, selected, onToggle }: DonutLegendProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.list}>
      {segments.map((seg) => {
        const active = selected === seg.key;
        const pct = total > 0 ? Math.round((Math.max(0, seg.value) / total) * 100) : 0;
        return (
          <PressableScale
            key={seg.key}
            onPress={() => onToggle(seg.key)}
            accessibilityRole="button"
            aria-selected={active}
            accessibilityLabel={`${seg.label}, ${pct} persen`}
            focusRadius={radius.sm}
            scaleTo={0.985}
            style={[
              styles.row,
              { backgroundColor: active ? colors.track : 'transparent' },
              selected && !active && styles.dim,
            ]}
          >
            <View style={[styles.dot, { backgroundColor: seg.color }]} />
            <View style={styles.label}>
              <AppText variant="bodyStrong" numberOfLines={1}>
                {seg.label}
              </AppText>
              {seg.caption && (
                <AppText variant="caption" tone="muted" numberOfLines={1}>
                  {seg.caption}
                </AppText>
              )}
            </View>
            <View style={styles.values}>
              <CurrencyText amount={seg.value} currency={currency} variant="bodyStrong" />
              <AppText variant="caption" tone="muted" numeric>
                {pct}%
              </AppText>
            </View>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { alignSelf: 'stretch', gap: space.xxs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.sm,
    paddingHorizontal: space.sm,
    borderRadius: radius.sm,
  },
  dim: { opacity: 0.55 },
  dot: { width: 10, height: 10, borderRadius: radius.full },
  label: { flex: 1, minWidth: 0 },
  values: { alignItems: 'flex-end', maxWidth: '50%' },
});

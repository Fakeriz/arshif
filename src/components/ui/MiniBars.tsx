import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay } from 'react-native-reanimated';

import { haptic, useMotion } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';
import { chartRamp, radius, space } from '@/theme/tokens';

import { AppText } from './AppText';

export type MiniBar = { label: string; value: number; /** Nilai terformat untuk pembaca layar, mis. "Rp 1,86 jt". */ valueLabel?: string };
export type MiniBarsProps = { data: MiniBar[]; selected: number; onSelect: (index: number) => void; height?: number; accessibilityLabel: string };

/** Batang ringkas yang bisa dipilih. Batang tumbuh bergiliran; yang terpilih memakai ujung chartRamp (paling kontras). */
export function MiniBars({ data, selected, onSelect, height = 88, accessibilityLabel }: MiniBarsProps) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel} style={styles.row}>
      {data.map((d, i) => (
        <Pressable
          key={d.label}
          accessibilityRole="radio"
          aria-checked={i === selected}
          accessibilityLabel={d.valueLabel ? `${d.label}, ${d.valueLabel}` : d.label}
          onPress={() => {
            if (i === selected) return;
            haptic('selection');
            onSelect(i);
          }}
          style={styles.col}
        >
          <View style={[styles.slot, { height }]}>
            <Bar ratio={d.value / max} index={i} on={i === selected} />
          </View>
          <AppText variant="overline" tone={i === selected ? 'primary' : 'muted'} align="center" numberOfLines={1}>
            {d.label}
          </AppText>
        </Pressable>
      ))}
    </View>
  );
}

function Bar({ ratio, index, on }: { ratio: number; index: number; on: boolean }) {
  const { scheme } = useTheme();
  const { spring, reduced } = useMotion();
  const target = Math.max(0.06, ratio);
  const h = useSharedValue(reduced ? target : 0.06);
  const w = useSharedValue(on ? 1 : 0.8);
  useEffect(() => {
    h.value = withDelay(index * 40, spring(target));
  }, [target, index, h, spring]);
  useEffect(() => {
    w.value = spring(on ? 1 : 0.8);
  }, [on, w, spring]);
  const style = useAnimatedStyle(() => ({ transform: [{ scaleY: h.value }, { scaleX: w.value }] }));
  const ramp = chartRamp[scheme];
  return <Animated.View style={[styles.bar, { backgroundColor: on ? ramp[ramp.length - 1] : ramp[0] }, style]} />;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.xs },
  col: { flex: 1, gap: space.xs },
  slot: { justifyContent: 'flex-end', alignItems: 'center' },
  bar: { width: '70%', maxWidth: 28, height: '100%', borderRadius: radius.bar, transformOrigin: 'bottom' },
});

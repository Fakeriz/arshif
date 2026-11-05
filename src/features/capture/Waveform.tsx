import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withTiming } from 'react-native-reanimated';

import { easeOut } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

const BARS = [0.35, 0.6, 0.85, 1, 0.7, 0.9, 0.55, 0.75, 0.4];

function Bar({ index, active }: { index: number; active: boolean }) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const s = useSharedValue(0.25);

  useEffect(() => {
    if (!active || reduced) {
      cancelAnimation(s);
      s.value = active ? BARS[index] : 0.25;
      return;
    }
    s.value = withDelay(index * 70, withRepeat(withTiming(BARS[index], { duration: 380 + index * 40, easing: easeOut }), -1, true));
    return () => cancelAnimation(s);
  }, [active, reduced, index, s]);

  const style = useAnimatedStyle(() => ({ transform: [{ scaleY: s.value }] }));
  return <Animated.View style={[styles.bar, { backgroundColor: active ? colors.accent : colors.borderStrong }, style]} />;
}

/** Gelombang suara. Bergerak hanya saat merekam; diam saat siaga atau reduced motion. */
export function Waveform({ active }: { active: boolean }) {
  return (
    <View style={styles.row} aria-hidden>
      {BARS.map((_, i) => (
        <Bar key={i} index={i} active={active} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, height: 96 },
  bar: { width: 8, height: 96, borderRadius: radius.full },
});

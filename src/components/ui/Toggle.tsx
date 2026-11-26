import { Pressable, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useEffect } from 'react';

import { haptic, useMotion } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';
import { radius } from '@/theme/tokens';

const W = 42;
const H = 24;
const PAD = 3;
const THUMB = H - PAD * 2;

export type ToggleProps = {
  value: boolean;
  onChange: (value: boolean) => void;
  accessibilityLabel: string;
  disabled?: boolean;
};

export function Toggle({ value, onChange, accessibilityLabel, disabled }: ToggleProps) {
  const { colors, scheme } = useTheme();
  const { spring } = useMotion();
  const x = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    x.value = spring(value ? 1 : 0);
  }, [value, spring, x]);

  const fill = useAnimatedStyle(() => ({ opacity: Math.max(0, Math.min(1, x.value)) }));
  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: x.value * (W - THUMB - PAD * 2) }] }));

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled: !!disabled }}
      aria-checked={value}
      aria-disabled={!!disabled}
      disabled={disabled}
      hitSlop={6}
      onPress={() => {
        haptic('tap');
        onChange(!value);
      }}
      style={[styles.track, { backgroundColor: colors.fill, borderColor: value ? colors.accent : colors.borderStrong }, disabled && styles.off]}
    >
      <Animated.View style={[styles.fill, { backgroundColor: colors.accent }, fill]} />
      <Animated.View style={[styles.thumb, { backgroundColor: value ? colors.onAccent : '#FFFFFF' }, thumb]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: { width: W, height: H, borderRadius: radius.full, borderWidth: 1, padding: PAD - 1, justifyContent: 'center', overflow: 'hidden' },
  fill: { ...StyleSheet.absoluteFill, borderRadius: radius.full },
  thumb: { width: THUMB, height: THUMB, borderRadius: radius.full, shadowColor: '#000000', shadowOpacity: 0.25, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
  off: { opacity: 0.45 },
});

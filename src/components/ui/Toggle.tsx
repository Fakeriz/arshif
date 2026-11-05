import { Pressable, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useEffect } from 'react';

import { haptic, useMotion } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';
import { radius } from '@/theme/tokens';

const W = 52;
const H = 32;
const PAD = 3;
const THUMB = H - PAD * 2;

export type ToggleProps = {
  value: boolean;
  onChange: (value: boolean) => void;
  accessibilityLabel: string;
  disabled?: boolean;
};

export function Toggle({ value, onChange, accessibilityLabel, disabled }: ToggleProps) {
  const { colors } = useTheme();
  const { spring } = useMotion();
  const x = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    x.value = spring(value ? 1 : 0);
  }, [value, spring, x]);

  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: x.value * (W - THUMB - PAD * 2) }] }));

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      aria-checked={value} aria-disabled={!!disabled}
      disabled={disabled}
      hitSlop={6}
      onPress={() => {
        haptic('tap');
        onChange(!value);
      }}
      style={[styles.track, { backgroundColor: value ? colors.accent : colors.track, borderColor: value ? colors.accent : colors.borderStrong }, disabled && styles.off]}
    >
      <Animated.View style={[styles.thumb, { backgroundColor: value ? colors.onAccent : colors.text }, thumb]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: { width: W, height: H, borderRadius: radius.full, borderWidth: 1, padding: PAD - 1, justifyContent: 'center' },
  thumb: { width: THUMB, height: THUMB, borderRadius: radius.full },
  off: { opacity: 0.45 },
});

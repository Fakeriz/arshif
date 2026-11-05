import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { Easing, useReducedMotion, withSpring, withTiming } from 'react-native-reanimated';

import { motion } from './tokens';

export const easeOut = Easing.bezier(0.2, 0, 0, 1);

/** Timing/spring yang otomatis instan saat prefers-reduced-motion aktif. */
export function useMotion() {
  const reduced = useReducedMotion();
  return {
    reduced,
    timing: (to: number, duration: number = motion.base) => {
      'worklet';
      return withTiming(to, { duration: reduced ? 0 : duration, easing: easeOut });
    },
    spring: (to: number) => {
      'worklet';
      return reduced ? withTiming(to, { duration: 0 }) : withSpring(to, motion.spring);
    },
  };
}

type HapticKind = 'tap' | 'success' | 'warning';

/** Haptic ringan; no-op di web. */
export function haptic(kind: HapticKind = 'tap'): void {
  if (Platform.OS === 'web') return;
  const run =
    kind === 'tap'
      ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      : Haptics.notificationAsync(
          kind === 'success'
            ? Haptics.NotificationFeedbackType.Success
            : Haptics.NotificationFeedbackType.Warning,
        );
  run.catch(() => undefined);
}

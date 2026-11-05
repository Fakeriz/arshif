import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { useMotion } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';
import { motion, radius } from '@/theme/tokens';

import { Skeleton } from './Skeleton';

export type ProgressTone = 'auto' | 'accent' | 'positive' | 'warning' | 'negative';

export type ProgressBarProps = {
  /** Rasio terpakai, 0–1 (boleh > 1 untuk overbudget). */
  value: number;
  tone?: ProgressTone;
  height?: number;
  loading?: boolean;
  accessibilityLabel?: string;
};

/**
 * auto: < 80% positive · 80–100% warning · > 100% negative (sesuai alert budget 80%/100%).
 * Aksen sengaja tidak dipakai: aksen Merah akan membuat budget aman terbaca bahaya.
 */
export function progressTone(value: number): Exclude<ProgressTone, 'auto'> {
  if (value > 1) return 'negative';
  if (value >= 0.8) return 'warning';
  return 'positive';
}

export function ProgressBar({
  value,
  tone = 'auto',
  height = 8,
  loading,
  accessibilityLabel,
}: ProgressBarProps) {
  const { colors } = useTheme();
  const { timing } = useMotion();
  const clamped = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = timing(clamped, motion.slow * 2);
  }, [clamped, progress, timing]);

  // scaleX + transformOrigin kiri: mengisi tanpa menganimasikan layout.
  const fill = useAnimatedStyle(() => ({ transform: [{ scaleX: progress.value }] }));

  if (loading) return <Skeleton height={height} radius={radius.full} />;

  const resolved = tone === 'auto' ? progressTone(value) : tone;
  const color = { accent: colors.accent, positive: colors.positive, warning: colors.warning, negative: colors.negative }[resolved];

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(Math.max(0, value) * 100) }}
      style={[styles.track, { height, backgroundColor: colors.track }]}
    >
      <Animated.View style={[styles.fill, { backgroundColor: color }, fill]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { borderRadius: radius.full, overflow: 'hidden', width: '100%' },
  fill: { ...StyleSheet.absoluteFill, borderRadius: radius.full, transformOrigin: 'left' },
});

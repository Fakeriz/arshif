import { useEffect } from 'react';
import { StyleSheet, View, type DimensionValue } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useT } from '@/i18n';
import { easeOut } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';
import { radius as radii, space } from '@/theme/tokens';

export type SkeletonProps = {
  width?: DimensionValue;
  height?: number;
  radius?: number;
};

/** Placeholder gelap berdenyut (opacity saja). Statis saat reduced motion. */
export function Skeleton({ width = '100%', height = 16, radius = radii.sm }: SkeletonProps) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (reduced) return;
    opacity.value = withRepeat(withTiming(0.45, { duration: 900, easing: easeOut }), -1, true);
    return () => cancelAnimation(opacity);
  }, [opacity, reduced]);

  const pulse = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ width, height, borderRadius: radius, backgroundColor: colors.skeleton }, pulse]}
    />
  );
}

/** Beberapa baris teks skeleton; baris terakhir lebih pendek. */
export function SkeletonText({ lines = 3, lineHeight = 12 }: { lines?: number; lineHeight?: number }) {
  const t = useT();
  return (
    <View
      style={styles.lines}
      accessible
      accessibilityLabel={t('common.loading')}
      aria-busy
    >
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} height={lineHeight} width={i === lines - 1 && lines > 1 ? '60%' : '100%'} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  lines: { gap: space.sm },
});

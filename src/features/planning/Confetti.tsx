import { useEffect, useMemo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { useTheme } from '@/theme/ThemeProvider';

const PIECES = 28;
const DURATION = 1800;

/** Konfeti saat goal tercapai. Sekali jalan, tidak menangkap sentuhan, dilewati bila "kurangi gerakan" aktif. */
export function Confetti({ onDone }: { onDone?: () => void }) {
  const reduced = useReducedMotion();
  const { width, height } = useWindowDimensions();
  const { hues, colors } = useTheme();
  const palette = [colors.accent, hues.jade, hues.saffron, hues.sky, hues.coral];
  // Posisi acak ditetapkan sekali per tampilan.
  const pieces = useMemo(
    () =>
      Array.from({ length: PIECES }, (_, i) => ({
        x: Math.random() * width,
        drift: (Math.random() - 0.5) * 120,
        delay: Math.random() * 300,
        spin: (Math.random() > 0.5 ? 1 : -1) * (360 + Math.random() * 360),
        size: 6 + Math.random() * 6,
        color: palette[i % palette.length],
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [width],
  );

  useEffect(() => {
    const timer = setTimeout(() => onDone?.(), reduced ? 0 : DURATION + 400);
    return () => clearTimeout(timer);
  }, [onDone, reduced]);

  if (reduced) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {pieces.map((p, i) => (
        <Piece key={i} {...p} fall={height * 0.75} />
      ))}
    </View>
  );
}

function Piece({ x, drift, delay, spin, size, color, fall }: { x: number; drift: number; delay: number; spin: number; size: number; color: string; fall: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(delay, withTiming(1, { duration: DURATION, easing: Easing.out(Easing.quad) }));
  }, [t, delay]);
  const style = useAnimatedStyle(() => ({
    opacity: 1 - t.value * t.value,
    transform: [{ translateX: x + drift * t.value }, { translateY: -20 + fall * t.value }, { rotate: `${spin * t.value}deg` }],
  }));
  return <Animated.View style={[styles.piece, { width: size, height: size * 0.5, backgroundColor: color }, style]} />;
}

const styles = StyleSheet.create({ piece: { position: 'absolute', top: 0, left: 0, borderRadius: 1 } });

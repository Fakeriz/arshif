import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type GestureResponderEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { haptic, useMotion } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';
import { elevation, radius } from '@/theme/tokens';

const THUMB = 24;
const TRACK = 6;
const HIT = 44;

export type SliderProps = {
  value: number;
  onChange: (next: number) => void;
  accessibilityLabel: string;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
};

/** Slider satu nilai. Ketuk jalur = knop meluncur dengan pegas; seret = knop mengikuti jari dan membesar. */
export function Slider({ value, onChange, accessibilityLabel, min = 0, max = 100, step = 1, disabled }: SliderProps) {
  const { colors, scheme } = useTheme();
  const { spring } = useMotion();
  const [width, setWidth] = useState(0);
  const dragging = useRef(false);
  const ratio = max > min ? (Math.min(max, Math.max(min, value)) - min) / (max - min) : 0;
  const p = useSharedValue(ratio);
  const grip = useSharedValue(1);

  useEffect(() => {
    p.value = dragging.current ? ratio : spring(ratio);
  }, [ratio, p, spring]);

  const span = Math.max(0, width - THUMB);
  const fill = useAnimatedStyle(() => ({ transform: [{ scaleX: Math.max(0.0001, p.value) }] }));
  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: p.value * span }, { scale: grip.value }] }));

  const commit = (next: number) => {
    const snapped = Math.min(max, Math.max(min, Math.round(next / step) * step));
    if (snapped !== value) {
      haptic('selection');
      onChange(snapped);
    }
  };
  const fromTouch = (e: GestureResponderEvent) => {
    if (span <= 0) return;
    commit(min + Math.max(0, Math.min(1, (e.nativeEvent.locationX - THUMB / 2) / span)) * (max - min));
  };
  const onKeyDown = (e: { key: string; preventDefault: () => void }) => {
    const d = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    commit(value + d * step);
  };

  return (
    <View
      accessible
      focusable={!disabled}
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min, max, now: value }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => commit(value + (e.nativeEvent.actionName === 'increment' ? step : -step))}
      aria-disabled={!!disabled}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => !disabled}
      onMoveShouldSetResponder={() => !disabled}
      onResponderGrant={(e) => {
        grip.value = spring(1.2);
        fromTouch(e);
        dragging.current = true;
      }}
      onResponderMove={fromTouch}
      onResponderRelease={() => {
        dragging.current = false;
        grip.value = spring(1);
      }}
      onResponderTerminate={() => {
        dragging.current = false;
        grip.value = spring(1);
      }}
      style={[styles.hit, disabled && styles.off]}
      // Panah keyboard di web; di native diabaikan.
      {...({ onKeyDown } as object)}
    >
      {/* Anak tidak menerima sentuhan supaya locationX selalu relatif ke area ini. */}
      <View pointerEvents="none" style={[styles.track, { backgroundColor: colors.track }]}>
        <Animated.View style={[styles.fill, { backgroundColor: colors.accent }, fill]} />
      </View>
      <Animated.View pointerEvents="none" style={[styles.thumb, { backgroundColor: colors.text, borderColor: colors.surface }, elevation[scheme].floating, thumb]} />
    </View>
  );
}

const styles = StyleSheet.create({
  hit: { height: HIT, justifyContent: 'center', alignSelf: 'stretch' },
  off: { opacity: 0.45 },
  track: { height: TRACK, borderRadius: radius.full, overflow: 'hidden', marginHorizontal: THUMB / 2 - TRACK / 2 },
  fill: { ...StyleSheet.absoluteFill, borderRadius: radius.full, transformOrigin: 'left' },
  thumb: { position: 'absolute', left: 0, top: (HIT - THUMB) / 2, width: THUMB, height: THUMB, borderRadius: radius.full, borderWidth: 2 },
});

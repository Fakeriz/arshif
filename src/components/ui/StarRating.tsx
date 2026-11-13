import { Star } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay } from 'react-native-reanimated';

import { useT } from '@/i18n';
import { haptic, useMotion } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';
import { layout, radius, space } from '@/theme/tokens';

import { PressableScale } from './PressableScale';

export type StarRatingProps = { value: number; onChange: (next: number) => void; accessibilityLabel: string; max?: number; size?: number };

/** Penilaian bintang. Bintang yang baru terisi meletup bergiliran dari kiri. Monokrom: terisi = warna teks. */
export function StarRating({ value, onChange, accessibilityLabel, max = 5, size = 28 }: StarRatingProps) {
  const t = useT();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel} style={styles.row}>
      {Array.from({ length: max }, (_, i) => (
        <StarButton
          key={i}
          index={i}
          filled={i < value}
          size={size}
          label={t('common.ui.stars', { n: i + 1, max })}
          selected={value === i + 1}
          onPress={() => {
            haptic('selection');
            onChange(i + 1);
          }}
        />
      ))}
    </View>
  );
}

function StarButton({ index, filled, size, label, selected, onPress }: { index: number; filled: boolean; size: number; label: string; selected: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const { spring, reduced } = useMotion();
  const s = useSharedValue(1);
  const was = useRef(filled);

  useEffect(() => {
    if (filled && !was.current && !reduced) {
      s.value = 1.35;
      s.value = withDelay(index * 40, spring(1));
    }
    was.current = filled;
  }, [filled, index, reduced, s, spring]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  const color = filled ? colors.text : colors.borderStrong;
  return (
    <PressableScale accessibilityRole="radio" aria-checked={selected} accessibilityLabel={label} onPress={onPress} scaleTo={0.85} focusRadius={radius.sm} hitSlop={4} style={styles.hit}>
      <Animated.View style={style}>
        <Star color={color} fill={filled ? color : 'transparent'} size={size} strokeWidth={layout.iconStroke} />
      </Animated.View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.xs },
  hit: { minWidth: 40, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});

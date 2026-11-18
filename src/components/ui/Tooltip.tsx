import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { useMotion } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';
import { motion, radius, space } from '@/theme/tokens';

import { AppText } from './AppText';

export type TooltipProps = {
  /** Isi keterangan; juga dibacakan sebagai hint elemen pemicu. */
  text: string;
  /** Label elemen pemicu untuk pembaca layar. */
  accessibilityLabel: string;
  children: ReactNode;
  /** Lama tampil setelah diketuk (ms). */
  durationMs?: number;
};

/** Keterangan singkat di atas pemicu. Ketuk untuk menampilkan sebentar; di web juga muncul saat hover/fokus. */
export function Tooltip({ text, accessibilityLabel, children, durationMs = 2600 }: TooltipProps) {
  const { colors } = useTheme();
  const { spring, timing } = useMotion();
  const [open, setOpen] = useState(false);
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = open ? spring(1) : timing(0, motion.fast);
  }, [open, t, spring, timing]);
  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => setOpen(false), durationMs);
    return () => clearTimeout(id);
  }, [open, durationMs]);

  const bubble = useAnimatedStyle(() => ({
    opacity: Math.max(0, Math.min(1, t.value)),
    transform: [{ translateY: (1 - t.value) * 8 }, { scale: 0.8 + t.value * 0.2 }],
  }));

  return (
    <View style={styles.wrap}>
      <Animated.View pointerEvents="none" aria-hidden style={[styles.bubble, { backgroundColor: colors.text }, bubble]}>
        <AppText variant="caption" align="center" style={{ color: colors.bg }}>
          {text}
        </AppText>
        <View style={[styles.arrow, { backgroundColor: colors.text }]} />
      </Animated.View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={text}
        hitSlop={8}
        // Selalu membuka (bukan toggle): di web, hover sudah membukanya sebelum klik.
        onPress={() => setOpen(true)}
        onHoverIn={() => setOpen(true)}
        onHoverOut={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        {children}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  bubble: { position: 'absolute', bottom: '100%', marginBottom: space.sm + 2, width: 168, paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.md, transformOrigin: 'bottom' },
  arrow: { position: 'absolute', bottom: -4, left: '50%', marginLeft: -5, width: 10, height: 10, borderRadius: 2, transform: [{ rotate: '45deg' }] },
});

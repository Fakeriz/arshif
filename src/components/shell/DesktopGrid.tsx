import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';

import { useEnter } from '@/theme/motion';
import { space } from '@/theme/tokens';

/** Lebar kolom halaman desktop yang memakai grid (12 kolom). Sama dengan lebar nav atas. */
export const DESKTOP_WIDE = 1280;

export function GridRow({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.row, style]}>{children}</View>;
}

/**
 * Sel grid (span dari 12 kolom) yang naik 12px + memudar saat halaman dibuka, bergiliran 50ms
 * (DESIGN.md "Masuk layar"): mata mengikuti urutan baca. Reduced motion: langsung tampil.
 */
export function GridCell({ span, order = 0, children, style }: { span: number; order?: number; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const enter = useEnter({ y: 12, delay: Math.min(order, 5) * 50 });
  return <Animated.View style={[styles.cell, { flex: span }, style, enter]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'stretch', gap: space.lg },
  cell: { minWidth: 0, gap: space.lg },
});

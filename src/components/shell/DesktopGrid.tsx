import { Children, isValidElement, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';

import { useDesktop } from '@/hooks/useDesktop';
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

/**
 * Daftar kartu sejenis (goals, utang, invoice, split): tiga kolom di desktop, satu kolom seperti biasa di ponsel.
 * Kartu tetap selebar kolomnya; tinggi baris mengikuti kartu tertinggi.
 */
export function CardGrid({ children }: { children: ReactNode }) {
  const desktop = useDesktop();
  if (!desktop) return <>{children}</>;
  return (
    <View style={styles.cards}>
      {Children.toArray(children).map((child, i) => (
        <View key={isValidElement(child) && child.key != null ? child.key : i} style={styles.card}>
          {child}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  cards: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -space.sm, rowGap: space.lg },
  card: { width: '33.333%', paddingHorizontal: space.sm },
  row: { flexDirection: 'row', alignItems: 'stretch', gap: space.lg },
  cell: { minWidth: 0, gap: space.lg },
});

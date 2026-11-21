import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AppText } from '@/components/ui';
import { useI18n } from '@/i18n';
import { dayLong, todayYmd } from '@/lib/dates';
import { useEnter } from '@/theme/motion';
import { space } from '@/theme/tokens';

/** Lebar kolom Beranda desktop (grid 12 kolom: 5 + 7). */
export const HOME_DESKTOP_WIDTH = 1280;

/** Judul halaman besar rata kiri + tanggal hari ini, pengganti header ponsel (avatar dan lonceng pindah ke nav atas). */
export function HomeDesktopTitle() {
  const { t, lang } = useI18n();
  return (
    <View style={styles.title}>
      <AppText variant="display" accessibilityRole="header">
        {t('shell.tab.home')}
      </AppText>
      <AppText variant="caption" tone="secondary">
        {dayLong(todayYmd(), lang)}
      </AppText>
    </View>
  );
}

export function GridRow({ children }: { children: ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

/**
 * Sel grid yang naik 12px + memudar saat Beranda dibuka, bergiliran 50ms (DESIGN.md "Masuk layar"):
 * mata mengikuti urutan baca, dari kartu tinta ke daftar. Reduced motion: langsung tampil.
 */
export function GridCell({ span, order, children }: { span: 5 | 7; order: number; children: ReactNode }) {
  const enter = useEnter({ y: 12, delay: order * 50 });
  return <Animated.View style={[styles.cell, { flex: span }, enter]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  title: { gap: space.xs, paddingTop: space.sm, paddingBottom: space.xs },
  row: { flexDirection: 'row', alignItems: 'stretch', gap: space.lg },
  cell: { minWidth: 0, gap: space.lg },
});

import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AmbientGlow } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';
import { layout, space } from '@/theme/tokens';

/** Ruang bawah agar konten tidak tertutup pill nav mengambang. */
export const NAV_SPACE = 112;

export type ScreenProps = {
  children: ReactNode;
  /** Layar tab: beri ruang untuk pill nav. */
  tabs?: boolean;
  glow?: boolean;
  /** Tarik untuk muat ulang (state error/loading di Fase 2). */
  onRefresh?: () => void;
  refreshing?: boolean;
};

export function Screen({ children, tabs, glow = true, onRefresh, refreshing }: ScreenProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      {glow && <AmbientGlow />}
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.accentText} /> : undefined}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + space.md, paddingBottom: (tabs ? NAV_SPACE : space.x4) + insets.bottom },
        ]}
      >
        <View style={styles.column}>{children}</View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: space.lg, alignItems: 'center' },
  column: { width: '100%', maxWidth: layout.maxContentWidth, gap: space.lg },
});

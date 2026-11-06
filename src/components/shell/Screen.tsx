import { createContext, useContext, useState, type ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/ThemeProvider';
import { layout, space } from '@/theme/tokens';

/** Ruang bawah minimum agar konten tidak tertutup pill nav mengambang (sebelum pill terukur). */
export const NAV_SPACE = 112;

/**
 * Tinggi pill sebenarnya bisa lebih besar dari perkiraan (mis. ukuran font sistem dibesarkan di MIUI),
 * jadi pill melaporkan ruang yang ia pakai dan layar tab memakai nilai itu sebagai padding bawah.
 */
const NavFootprintContext = createContext<{ footprint: number; setFootprint: (px: number) => void }>({ footprint: 0, setFootprint: () => undefined });

export function NavFootprintProvider({ children }: { children: ReactNode }) {
  const [footprint, setFootprint] = useState(0);
  return <NavFootprintContext.Provider value={{ footprint, setFootprint }}>{children}</NavFootprintContext.Provider>;
}

export function useNavFootprint() {
  return useContext(NavFootprintContext);
}

export type ScreenProps = {
  children: ReactNode;
  /** Layar tab: beri ruang untuk pill nav. */
  tabs?: boolean;
  /** Tarik untuk muat ulang (state error/loading di Fase 2). */
  onRefresh?: () => void;
  refreshing?: boolean;
  /** Dipanggil saat scroll mendekati bawah (render bertahap daftar panjang). */
  onEndReached?: () => void;
  /** Lebar kolom maksimum. Bawaan = kolom aplikasi; panel admin web memakai kolom lebih lebar. */
  maxWidth?: number;
};

/** Jarak dari bawah (px) yang memicu onEndReached. */
const END_THRESHOLD = 600;

export function Screen({ children, tabs, onRefresh, refreshing, onEndReached, maxWidth }: ScreenProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { footprint } = useNavFootprint();
  const tabSpace = Math.max(NAV_SPACE + insets.bottom, footprint + space.xl);
  const scroll = (
    <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={onEndReached ? 250 : undefined}
        onScroll={
          onEndReached
            ? ({ nativeEvent: e }) => {
                if (e.contentOffset.y + e.layoutMeasurement.height >= e.contentSize.height - END_THRESHOLD) onEndReached();
              }
            : undefined
        }
        refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.accentText} /> : undefined}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + space.md, paddingBottom: tabs ? tabSpace : space.x4 + insets.bottom },
        ]}
      >
        <View style={[styles.column, maxWidth ? { maxWidth } : null]}>{children}</View>
    </ScrollView>
  );
  return <View style={[styles.root, { backgroundColor: colors.bg }]}>{scroll}</View>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: space.lg, alignItems: 'center' },
  column: { width: '100%', maxWidth: layout.maxContentWidth, gap: space.lg },
});

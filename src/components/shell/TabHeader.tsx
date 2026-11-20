import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { space } from '@/theme/tokens';

/** Judul layar tab: judul besar + keterangan satu baris + slot aksi kanan. */
export function TabHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <View style={styles.row}>
      <View style={styles.text}>
        <AppText variant="h1" accessibilityRole="header">
          {title}
        </AppText>
        {subtitle && (
          <AppText variant="body" tone="muted">
            {subtitle}
          </AppText>
        )}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  // Ruang atas setara baris tombol di ScreenHeader, supaya judul tab tidak menempel ke tepi.
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: space.md, marginTop: space.lg },
  text: { flex: 1, gap: space.sm },
});

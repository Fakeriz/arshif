import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';

type SectionProps = { index: string; title: string; note?: string; children: ReactNode };

export function Section({ index, title, note, children }: SectionProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.section, { borderTopColor: colors.border }]}>
      <View style={styles.header}>
        <AppText variant="overline" tone="accent" uppercase>
          {index}
        </AppText>
        <AppText variant="h1" accessibilityRole="header">
          {title}
        </AppText>
        {note && (
          <AppText variant="body" tone="secondary">
            {note}
          </AppText>
        )}
      </View>
      {children}
    </View>
  );
}

/** Label kecil di atas contoh state ("Loading", "Kosong", dst). */
export function StateLabel({ children }: { children: string }) {
  return (
    <AppText variant="overline" tone="muted" uppercase style={styles.stateLabel}>
      {children}
    </AppText>
  );
}

export function Row({ children, wrap = true }: { children: ReactNode; wrap?: boolean }) {
  return <View style={[styles.row, wrap && styles.wrap]}>{children}</View>;
}

const styles = StyleSheet.create({
  section: { gap: space.xl, paddingTop: space.x3, borderTopWidth: 1 },
  header: { gap: space.xs },
  stateLabel: { marginBottom: -space.sm },
  row: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
  wrap: { flexWrap: 'wrap' },
});

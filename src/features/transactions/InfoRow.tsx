import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';
import { layout, space } from '@/theme/tokens';

export function InfoRow({ label, value, divider }: { label: string; value: string; divider?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.row, divider && { borderBottomWidth: layout.hairline, borderBottomColor: colors.border }]}>
      <AppText variant="caption" tone="secondary">
        {label}
      </AppText>
      <AppText variant="bodyStrong" align="right" style={styles.value}>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: space.lg, paddingVertical: space.md },
  value: { flex: 1 },
});

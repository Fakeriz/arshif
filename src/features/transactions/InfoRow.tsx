import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { space } from '@/theme/tokens';

export function InfoRow({ label, value, divider }: { label: string; value: string; divider?: boolean }) {
  return (
    <View style={[styles.row, divider && styles.divider]}>
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
  divider: {},
  value: { flex: 1 },
});

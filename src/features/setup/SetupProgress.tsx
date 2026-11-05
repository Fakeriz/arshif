import { StyleSheet, View } from 'react-native';

import { AppText, ProgressBar } from '@/components/ui';
import { useT } from '@/i18n';
import { space } from '@/theme/tokens';

export function SetupProgress({ step, total }: { step: number; total: number }) {
  const t = useT();
  const label = t('auth.setup.stepOf', { n: step + 1, total });
  return (
    <View style={styles.wrap}>
      <AppText variant="caption" tone="secondary">
        {label}
      </AppText>
      <ProgressBar value={(step + 1) / total} tone="accent" height={6} accessibilityLabel={label} />
    </View>
  );
}

const styles = StyleSheet.create({ wrap: { gap: space.sm } });

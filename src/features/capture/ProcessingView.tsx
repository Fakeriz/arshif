import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AppText, GlassView } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

/** Keadaan "AI sedang bekerja": menyebut apa yang sedang dikerjakan dan bahwa gagal tidak memotong kuota. */
export function ProcessingView({ title, message }: { title: string; message: string }) {
  const { colors } = useTheme();
  return (
    <GlassView level="floating" radius={radius.lg} style={styles.card} accessibilityLabel={`${title}. ${message}`}>
      <ActivityIndicator color={colors.accentText} size="large" />
      <AppText variant="h3" align="center" aria-live="polite">
        {title}
      </AppText>
      <AppText variant="caption" tone="secondary" align="center">
        {message}
      </AppText>
    </GlassView>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: 'center', gap: space.md, padding: space.xxl, maxWidth: 320, alignSelf: 'center' },
});

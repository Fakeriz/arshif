import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AppText, GlassView, StepList } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

/**
 * Keadaan "AI sedang bekerja": menyebut apa yang sedang dikerjakan dan bahwa gagal tidak memotong kuota.
 * `steps` + `done`: urutan proses (Motion Kit "Langkah"), supaya pengguna tahu sedang di tahap mana.
 */
export function ProcessingView({ title, message, steps, done = 0 }: { title: string; message: string; steps?: string[]; done?: number }) {
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
      {steps ? (
        <View style={styles.steps}>
          <StepList steps={steps} done={done} />
        </View>
      ) : null}
    </GlassView>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: 'center', gap: space.md, padding: space.xxl, maxWidth: 320, alignSelf: 'center' },
  steps: { alignSelf: 'stretch', marginTop: space.sm },
});

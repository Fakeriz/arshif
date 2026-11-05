import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AmbientGlow, AppText, EmptyState } from '@/components/ui';
import { useT } from '@/i18n';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';

/**
 * Layar saat data pertama dimuat (web; native masih menampilkan splash) atau saat muat pertama gagal.
 * Tanpa onRetry = sedang memuat.
 */
export function BootScreen({ onRetry }: { onRetry?: () => void }) {
  const { colors } = useTheme();
  const t = useT();
  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <AmbientGlow />
      {onRetry ? (
        <EmptyState kind="error" title={t('common.bootErrorTitle')} message={t('common.bootErrorMessage')} actionLabel={t('common.retry')} onAction={onRetry} />
      ) : (
        <View style={styles.loading} accessibilityRole="progressbar" accessibilityLabel={t('common.bootLoading')}>
          <ActivityIndicator color={colors.accentText} />
          <AppText variant="caption" tone="secondary">
            {t('common.bootLoading')}
          </AppText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.lg },
  loading: { alignItems: 'center', gap: space.md },
});

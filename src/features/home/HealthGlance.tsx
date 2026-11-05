import { ChevronRight, TrendingDown, TrendingUp } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { useT } from '@/i18n';
import { AppText, Card, Icon } from '@/components/ui';
import { healthBand } from '@/lib/chart';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';

export function HealthGlance({ score, delta, onPress }: { score: number | null; delta: number; onPress: () => void }) {
  const { colors } = useTheme();
  const t = useT();
  const band = score === null ? null : healthBand(score);
  const bandLabel = band ? t(`domain.healthBand.${band.key}`) : '';
  const label = score === null ? t('common.health.a11yNone') : t('common.health.a11y', { score, band: bandLabel });
  return (
    <Card onPress={onPress} accessibilityLabel={t('home.health.openCoach', { label })} padding="md">
      <View style={styles.row}>
        <AppText variant="display" numeric style={styles.score}>
          {score === null ? '–' : score}
        </AppText>
        <View style={styles.text}>
          <AppText variant="bodyStrong">{t('home.health.title')}</AppText>
          <AppText variant="caption" tone="secondary">
            {score === null ? t('common.health.needsData') : t('common.health.outOf', { band: bandLabel })}
          </AppText>
          {score !== null && delta !== 0 && (
            <View style={styles.delta}>
              <Icon icon={delta > 0 ? TrendingUp : TrendingDown} color={delta > 0 ? colors.positive : colors.negative} size={14} />
              <AppText variant="caption" tone={delta > 0 ? 'positive' : 'negative'}>
                {t(delta > 0 ? 'common.health.up' : 'common.health.down', { n: Math.abs(delta) })}
              </AppText>
            </View>
          )}
        </View>
        <Icon icon={ChevronRight} color={colors.textMuted} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  score: { minWidth: 64, textAlign: 'center' },
  text: { flex: 1, gap: space.xxs },
  delta: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
});

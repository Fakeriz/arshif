import { ChevronRight, TrendingDown, TrendingUp } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppText, Card, Icon } from '@/components/ui';
import { healthBand } from '@/lib/chart';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';

export function HealthGlance({ score, delta, onPress }: { score: number | null; delta: number; onPress: () => void }) {
  const { colors } = useTheme();
  const band = score === null ? null : healthBand(score);
  const label = score === null ? 'Skor kesehatan keuangan belum tersedia' : `Skor kesehatan keuangan ${score} dari 100, ${band?.label}`;
  return (
    <Card onPress={onPress} accessibilityLabel={`${label}. Buka Coach`} padding="md">
      <View style={styles.row}>
        <AppText variant="display" numeric style={styles.score}>
          {score === null ? '–' : score}
        </AppText>
        <View style={styles.text}>
          <AppText variant="bodyStrong">Kesehatan keuangan</AppText>
          <AppText variant="caption" tone="secondary">
            {score === null ? 'Butuh data 1 bulan' : `dari 100 · ${band?.label}`}
          </AppText>
          {score !== null && delta !== 0 && (
            <View style={styles.delta}>
              <Icon icon={delta > 0 ? TrendingUp : TrendingDown} color={delta > 0 ? colors.positive : colors.negative} size={14} />
              <AppText variant="caption" tone={delta > 0 ? 'positive' : 'negative'}>
                {`${delta > 0 ? 'Naik' : 'Turun'} ${Math.abs(delta)} poin dari bulan lalu`}
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

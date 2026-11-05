import { Sparkles } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppText, Badge, Card, EmptyState, HealthGauge, Icon, ProgressBar } from '@/components/ui';
import type { Pillar } from '@/lib/health';
import { useT } from '@/i18n';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';

/** Narasi AI sungguhan datang di Fase 2 (Gemini via Edge Function). Ini contoh yang selaras dengan data. */
const SAMPLE_ACTIONS = ['coach.score.action1', 'coach.score.action2', 'coach.score.action3'] as const;

function tone(ratio: number): 'positive' | 'warning' | 'negative' {
  return ratio >= 0.7 ? 'positive' : ratio >= 0.4 ? 'warning' : 'negative';
}

export function ScoreTab({ score, delta, pillars }: { score: number | null; delta: number; pillars: Pillar[] }) {
  const { colors } = useTheme();
  const t = useT();
  if (score === null) {
    return <EmptyState title={t('coach.score.emptyTitle')} message={t('coach.score.emptyMessage')} />;
  }
  return (
    <View style={styles.wrap}>
      <Card padding="xl">
        <HealthGauge score={score} delta={delta} />
      </Card>
      <Card>
        <AppText variant="h3">{t('coach.score.whereFrom')}</AppText>
        <AppText variant="caption" tone="muted">
          {t('coach.score.formula')}
        </AppText>
        <View style={styles.pillars}>
          {pillars.map((p) => {
            const label = t(`domain.pillar.${p.key}.label`);
            return (
              <View key={p.key} style={styles.pillar}>
                <View style={styles.pillarHead}>
                  <AppText variant="bodyStrong" style={styles.flex}>
                    {label}
                  </AppText>
                  <AppText variant="bodyStrong" numeric>{`${p.points}`}</AppText>
                  <AppText variant="caption" tone="muted" numeric>{`/ ${p.max}`}</AppText>
                </View>
                <ProgressBar value={p.points / p.max} tone={tone(p.points / p.max)} height={6} accessibilityLabel={t('coach.score.pillarA11y', { label, points: p.points, max: p.max })} />
                <AppText variant="caption" tone="muted">
                  {t(`domain.pillar.${p.key}.hint`)}
                </AppText>
              </View>
            );
          })}
        </View>
      </Card>
      <Card>
        <View style={styles.narrHead}>
          <Icon icon={Sparkles} color={colors.accentText} />
          <AppText variant="h3" style={styles.flex}>
            {t('coach.score.says')}
          </AppText>
          <Badge label={t('coach.score.sample')} />
        </View>
        <AppText variant="body" tone="secondary" style={styles.narr}>
          {t('coach.score.narration')}
        </AppText>
        {SAMPLE_ACTIONS.map((a, i) => (
          <View key={a} style={styles.action}>
            <View style={[styles.num, { backgroundColor: colors.accentSoft }]}>
              <AppText variant="caption" tone="accent" numeric>
                {i + 1}
              </AppText>
            </View>
            <AppText variant="body" style={styles.flex}>
              {t(a)}
            </AppText>
          </View>
        ))}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.lg },
  flex: { flex: 1 },
  pillars: { gap: space.xl, marginTop: space.xl },
  pillar: { gap: space.sm },
  pillarHead: { flexDirection: 'row', alignItems: 'baseline', gap: space.xs },
  narrHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  narr: { marginVertical: space.md },
  action: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingVertical: space.xs + 2 },
  num: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});

import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Card, EmptyState, HealthGauge, ProgressBar } from '@/components/ui';
import type { Pillar } from '@/lib/health';
import { useT } from '@/i18n';
import { space } from '@/theme/tokens';

function tone(ratio: number): 'positive' | 'warning' | 'negative' {
  return ratio >= 0.7 ? 'positive' : ratio >= 0.4 ? 'warning' : 'negative';
}

/** `narration` = kartu narasi Coach (AI di server), disusun oleh layar karena butuh data recap + anggaran. */
export function ScoreTab({ score, delta, pillars, narration }: { score: number | null; delta: number; pillars: Pillar[]; narration: ReactNode }) {
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
      {narration}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.lg },
  flex: { flex: 1 },
  pillars: { gap: space.xl, marginTop: space.xl },
  pillar: { gap: space.sm },
  pillarHead: { flexDirection: 'row', alignItems: 'baseline', gap: space.xs },
});

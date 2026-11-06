import { StyleSheet, View } from 'react-native';

import { AppText, Badge, Card, GoalRing } from '@/components/ui';
import type { Goal } from '@/data/planning';
import { useI18n } from '@/i18n';
import { diffDays, shortDate, todayYmd } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { goalProgress, suggestedMonthly } from '@/lib/planning/goals';
import { space } from '@/theme/tokens';

/** Kartu goal: terkumpul / target, progress, saran setoran per bulan atau status. */
export function GoalCard({ goal: g, onPress }: { goal: Goal; onPress?: () => void }) {
  const { t, lang } = useI18n();
  const today = todayYmd();
  const p = goalProgress(g);
  const monthly = suggestedMonthly(g, today);
  const late = g.status === 'active' && g.deadline && diffDays(g.deadline, today) < 0;
  const note =
    g.status === 'completed'
      ? t('plan.goals.completedOn', { date: g.completedAt ? shortDate(g.completedAt.slice(0, 10), lang) : '' })
      : late
        ? t('plan.goals.overdue', { date: shortDate(g.deadline!, lang) })
        : monthly !== null
          ? t('plan.goals.suggestion', { amount: formatMoney(monthly, g.currency), date: shortDate(g.deadline!, lang) })
          : t('plan.goals.noDeadline');
  return (
    <Card onPress={onPress} accessibilityLabel={`${g.name}. ${t('plan.goals.progress', { collected: formatMoney(g.collected, g.currency), target: formatMoney(g.target, g.currency) })}. ${note}`}>
      <View style={styles.main}>
        <GoalRing value={p} label={g.name} size={60} thickness={6} />
        <View style={styles.flex}>
          <View style={styles.head}>
            <AppText variant="bodyStrong" numberOfLines={1} style={styles.flex}>
              {g.name}
            </AppText>
            {g.status === 'completed' && <Badge label={t('plan.goals.completed')} tone="positive" />}
          </View>
          <View style={styles.amounts}>
            <AppText variant="h3" numeric>
              {formatMoney(g.collected, g.currency)}
            </AppText>
            <AppText variant="caption" tone="secondary" numeric>
              {`/ ${formatMoney(g.target, g.currency)}`}
            </AppText>
          </View>
        </View>
      </View>
      <AppText variant="caption" tone={late ? 'warning' : 'secondary'} style={styles.note}>
        {note}
      </AppText>
    </Card>
  );
}

const styles = StyleSheet.create({
  main: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1, minWidth: 0 },
  amounts: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: space.xs, marginTop: space.xs },
  note: { marginTop: space.md },
});

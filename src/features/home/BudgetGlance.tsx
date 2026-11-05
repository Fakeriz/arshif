import { ChevronRight } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppText, Badge, Card, CurrencyText, Icon, ProgressBar } from '@/components/ui';
import { useI18n } from '@/i18n';
import type { BudgetPeriod, Pace } from '@/lib/budget';
import { shortDate } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';

const PACE_TONE: Record<Pace, 'positive' | 'warning' | 'negative'> = { sesuai: 'positive', agak_cepat: 'warning', terlalu_cepat: 'negative' };

export type BudgetGlanceProps = {
  period: BudgetPeriod;
  pace: Pace;
  safePerDay: number;
  spent: number;
  limit: number;
  currency: string;
  onPress: () => void;
};

/** Ringkasan satu keputusan: berapa yang aman dibelanjakan hari ini. */
export function BudgetGlance({ period, pace, safePerDay, spent, limit, currency, onPress }: BudgetGlanceProps) {
  const { colors } = useTheme();
  const { t, lang } = useI18n();
  const paceLabel = t(`domain.pace.${pace}`);
  return (
    <Card onPress={onPress} accessibilityLabel={t('home.budget.a11y', { pace: paceLabel, amount: formatMoney(safePerDay, currency) })}>
      <View style={styles.head}>
        <View style={styles.titles}>
          <AppText variant="h3">{t('home.budget.title')}</AppText>
          <AppText variant="caption" tone="muted">
            {t('home.budget.period', { start: shortDate(period.start, lang), end: shortDate(period.end, lang), count: period.daysLeft })}
          </AppText>
        </View>
        <Badge label={paceLabel} tone={PACE_TONE[pace]} />
        <Icon icon={ChevronRight} color={colors.textMuted} />
      </View>
      <View style={styles.safe}>
        <AppText variant="caption" tone="secondary">
          {t('home.budget.safe')}
        </AppText>
        <View style={styles.safeRow}>
          <CurrencyText amount={safePerDay} currency={currency} variant="h1" />
          <AppText variant="caption" tone="muted">
            {t('home.budget.perDay')}
          </AppText>
        </View>
      </View>
      <ProgressBar value={limit > 0 ? spent / limit : 0} accessibilityLabel={t('home.budget.usageA11y')} />
      <AppText variant="caption" tone="muted">
        {t('home.budget.usage', { spent: formatMoney(spent, currency), limit: formatMoney(limit, currency) })}
      </AppText>
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  titles: { flex: 1, gap: space.xxs },
  safe: { marginTop: space.lg, marginBottom: space.md, gap: space.xxs },
  safeRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
});

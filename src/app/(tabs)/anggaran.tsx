import { SlidersHorizontal } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/shell/Screen';
import { TabHeader } from '@/components/shell/TabHeader';
import { AppText, Badge, Button, Card, CurrencyText, DonutChart, EmptyState, Skeleton } from '@/components/ui';
import { BucketSection } from '@/features/budget/BucketSection';
import { SplitSheet } from '@/features/budget/SplitSheet';
import { useI18n } from '@/i18n';
import { BUCKETS } from '@/lib/budget';
import { shortDate } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { useStore } from '@/state/AppStore';
import { useDemoState } from '@/state/demo';
import { useBudget, useLedger } from '@/state/derived';
import { useRetry } from '@/state/useRetry';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

export default function AnggaranScreen() {
  const demo = useDemoState();
  const retry = useRetry();
  const { state, dispatch } = useStore();
  const { hues } = useTheme();
  const { t, lang } = useI18n();
  const { mainCurrency, transactions } = useLedger();
  const b = useBudget();
  const [sheet, setSheet] = useState(false);
  const colors = { needs: hues.sky, wants: hues.saffron, savings: hues.jade };
  const subtitle = t('budget.period', { start: shortDate(b.period.start, lang), end: shortDate(b.period.end, lang), days: b.period.daysLeft });

  if (demo === 'error') {
    return (
      <Screen tabs>
        <TabHeader title={t('budget.title')} />
        <EmptyState kind="error" title={t('budget.errorTitle')} message={t('budget.errorMessage')} actionLabel={t('common.retry')} onAction={retry} />
      </Screen>
    );
  }
  if (demo === 'loading') {
    return (
      <Screen tabs>
        <TabHeader title={t('budget.title')} />
        <View style={styles.skeleton} accessibilityLabel={t('budget.loading')} aria-busy>
          <Skeleton height={180} radius={radius.lg} />
          <Skeleton height={260} radius={radius.lg} />
          <Skeleton height={260} radius={radius.lg} />
        </View>
      </Screen>
    );
  }

  const total = b.spent.needs + b.spent.wants + b.spent.savings;
  return (
    <Screen tabs onRefresh={retry} refreshing={false}>
      <TabHeader
        title={t('budget.title')}
        subtitle={subtitle}
        right={<Button label={t('budget.adjust')} icon={SlidersHorizontal} variant="secondary" size="sm" onPress={() => setSheet(true)} />}
      />
      <Card>
        <View style={styles.safeHead}>
          <AppText variant="caption" tone="secondary">
            {t('budget.safeToSpend')}
          </AppText>
          <Badge label={t(`domain.pace.${b.flexPace}`)} tone={b.flexPace === 'sesuai' ? 'positive' : b.flexPace === 'agak_cepat' ? 'warning' : 'negative'} />
        </View>
        <View style={styles.safeRow}>
          <CurrencyText amount={b.safePerDay} currency={mainCurrency} variant="amountHero" />
          <AppText variant="caption" tone="muted">
            {t('budget.perDay')}
          </AppText>
        </View>
        <AppText variant="caption" tone="secondary">
          {transactions.length === 0
            ? t('budget.untouched')
            : t('budget.remaining', { amount: formatMoney(Math.max(0, b.flexLimit - b.flexSpent), mainCurrency), days: b.period.daysLeft })}
        </AppText>
      </Card>
      <Card padding="xl">
        <DonutChart
          currency={mainCurrency}
          centerLabel={t('budget.donutCenter')}
          emptyLabel={t('budget.donutEmpty')}
          segments={BUCKETS.map((x) => ({ key: x.key, label: t(`domain.bucket.${x.key}`), value: b.spent[x.key], color: colors[x.key], caption: t('budget.donutCaption', { amount: formatMoney(b.limits[x.key], mainCurrency), pct: state.split[x.key] }) }))}
        />
        {total === 0 && (
          <AppText variant="caption" tone="muted" align="center" style={styles.note}>
            {t('budget.chartHint')}
          </AppText>
        )}
      </Card>
      {BUCKETS.map((x) => (
        <BucketSection
          key={x.key}
          bucket={x.key}
          label={t(`domain.bucket.${x.key}`)}
          percent={state.split[x.key]}
          color={colors[x.key]}
          spent={b.spent[x.key]}
          limit={b.limits[x.key]}
          pace={b.bucketPace(x.key)}
          currency={mainCurrency}
          categoryLimits={b.categoryLimits}
          categorySpent={b.categorySpent}
        />
      ))}
      <SplitSheet visible={sheet} onClose={() => setSheet(false)} split={state.split} onSave={(split) => dispatch({ type: 'budget/split', split })} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  skeleton: { gap: space.lg },
  safeHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  safeRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm, marginVertical: space.sm },
  note: { marginTop: space.md },
});

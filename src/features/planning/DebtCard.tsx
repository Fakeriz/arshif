import { StyleSheet, View } from 'react-native';

import { AppText, Badge, Card, ProgressBar } from '@/components/ui';
import type { Debt } from '@/data/planning';
import { useI18n } from '@/i18n';
import { shortDate } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { space } from '@/theme/tokens';

import { formatBp } from './forms';

/** Utang/piutang: sisa saldo dari saldo awal, bunga, cicilan minimum, jatuh tempo. */
export function DebtCard({ debt: d, onPress }: { debt: Debt; onPress?: () => void }) {
  const { t, lang } = useI18n();
  const paidRatio = d.principal > 0 ? (d.principal - d.balance) / d.principal : 0;
  const meta = [
    d.aprBp > 0 ? t('plan.debts.aprLabel', { pct: `${formatBp(d.aprBp)}%` }) : null,
    d.minPayment > 0 ? t('plan.debts.minLabel', { amount: formatMoney(d.minPayment, d.currency) }) : null,
    d.dueDate ? shortDate(d.dueDate, lang) : null,
  ].filter(Boolean).join(' · ');
  return (
    <Card onPress={onPress} accessibilityLabel={`${d.counterparty}. ${t('plan.debts.balance', { amount: formatMoney(d.balance, d.currency) })} ${t('plan.debts.ofPrincipal', { amount: formatMoney(d.principal, d.currency) })}`}>
      <View style={styles.head}>
        <AppText variant="bodyStrong" numberOfLines={1} style={styles.flex}>
          {d.counterparty}
        </AppText>
        {d.status === 'paid' && <Badge label={t('plan.debts.paidOff')} tone="positive" />}
      </View>
      <View style={styles.amounts}>
        <AppText variant="h3" numeric>
          {formatMoney(d.balance, d.currency)}
        </AppText>
        <AppText variant="caption" tone="secondary" numeric>
          {t('plan.debts.ofPrincipal', { amount: formatMoney(d.principal, d.currency) })}
        </AppText>
      </View>
      <ProgressBar value={paidRatio} tone="positive" accessibilityLabel={`${Math.round(paidRatio * 100)}%`} />
      {meta ? (
        <AppText variant="caption" tone="secondary" style={styles.meta}>
          {meta}
        </AppText>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1, minWidth: 0 },
  amounts: { flexDirection: 'row', alignItems: 'baseline', gap: space.xs, marginVertical: space.sm, flexWrap: 'wrap' },
  meta: { marginTop: space.sm },
});

import { StyleSheet, View } from 'react-native';

import { AppText, Badge, Card, Group, ListCard, ListItem } from '@/components/ui';
import { useI18n } from '@/i18n';
import { shortDate } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import type { PaydayCycleProjection } from '@/lib/planning/paydayCycle';
import { space } from '@/theme/tokens';

/** Ringkasan proyeksi kewajiban tagihan & langganan hingga gajian berikutnya per akun tertaut. */
export function PaydayProjectionCard({ projection, mainCurrency }: { projection: PaydayCycleProjection; mainCurrency: string }) {
  const { t, lang } = useI18n();
  if (projection.totalItems === 0) return null;

  return (
    <Group label={t('plan.bills.projectionHeading')}>
      <Card>
        <View style={styles.head}>
          <View style={styles.flex}>
            <AppText variant="caption" tone="secondary">
              {t('plan.bills.projectionUntil', { date: shortDate(projection.nextPayday, lang), count: projection.totalItems })}
            </AppText>
            <AppText variant="h2" numeric>
              {formatMoney(projection.totalDueMain, mainCurrency)}
            </AppText>
          </View>
          <Badge
            label={
              projection.shortfallAccountsCount > 0
                ? t('plan.bills.shortfallCount', { count: projection.shortfallAccountsCount })
                : t('plan.bills.allCovered')
            }
            tone={projection.shortfallAccountsCount > 0 ? 'negative' : 'positive'}
          />
        </View>
        {projection.unassignedCount > 0 && (
          <AppText variant="caption" tone="muted" style={styles.note}>
            {t('plan.bills.unassignedDue', {
              count: projection.unassignedCount,
              amount: formatMoney(projection.unassignedDueMain, mainCurrency),
            })}
          </AppText>
        )}
      </Card>
      {projection.accounts.length > 0 && (
        <ListCard>
          {projection.accounts.map((a, i) => (
            <ListItem
              key={a.account.id}
              title={a.account.name}
              subtitle={t('plan.bills.accountDue', {
                amount: formatMoney(a.dueAmount, a.account.currency),
                count: a.itemCount,
              })}
              trailing={formatMoney(a.projectedBalance, a.account.currency)}
              trailingCaption={
                a.shortfall > 0
                  ? t('plan.bills.shortfallAmount', { amount: formatMoney(a.shortfall, a.account.currency) })
                  : t('plan.bills.projectedOk')
              }
              divider={i < projection.accounts.length - 1}
            />
          ))}
        </ListCard>
      )}
    </Group>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md, flexWrap: 'wrap' },
  flex: { flex: 1, minWidth: 0, gap: space.xxs },
  note: { marginTop: space.sm },
});

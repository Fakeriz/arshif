import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { useI18n } from '@/i18n';
import { AppText, Card } from '@/components/ui';
import type { Transaction } from '@/data/types';
import { dayLabel, dayLong } from '@/lib/dates';
import { groupByDay } from '@/lib/transactions';
import type { AccountWithBalance } from '@/state/AppStore';
import { space } from '@/theme/tokens';

import { TransactionRow } from './TransactionRow';

export function TransactionList({ transactions, accounts, mainCurrency }: { transactions: Transaction[]; accounts: AccountWithBalance[]; mainCurrency: string }) {
  const router = useRouter();
  const { t, lang } = useI18n();
  return (
    <View style={styles.list}>
      {groupByDay(transactions).map((g) => (
        <View key={g.date} style={styles.group}>
          <AppText variant="caption" tone="secondary" accessibilityRole="header" accessibilityLabel={dayLong(g.date, lang)} style={styles.day}>
            {dayLabel(g.date, lang)}
          </AppText>
          <Card padding="md">
            {g.items.map((tx, i) => (
              <TransactionRow
                key={tx.id}
                tx={tx}
                accountName={accounts.find((a) => a.id === tx.accountId)?.name ?? t('tx.accountFallback')}
                mainCurrency={mainCurrency}
                divider={i < g.items.length - 1}
                onPress={() => router.push({ pathname: '/trx/[id]', params: { id: tx.id } })}
              />
            ))}
          </Card>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.lg },
  group: { gap: space.sm },
  day: { paddingHorizontal: space.xs },
});

import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { useI18n } from '@/i18n';
import { Group, ListCard } from '@/components/ui';
import type { Transaction } from '@/data/types';
import { dayLabel, dayLong } from '@/lib/dates';
import { groupByDay } from '@/lib/transactions';
import type { AccountWithBalance } from '@/state/AppStore';
import { space } from '@/theme/tokens';

import { TransactionRow } from './TransactionRow';

/** `onSelect` (desktop): baris membuka detail di panel samping, bukan pindah layar. */
export function TransactionList({
  transactions,
  accounts,
  mainCurrency,
  selectedId,
  onSelect,
}: {
  transactions: Transaction[];
  accounts: AccountWithBalance[];
  mainCurrency: string;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}) {
  const router = useRouter();
  const { t, lang } = useI18n();
  return (
    <View style={styles.list}>
      {groupByDay(transactions).map((g) => (
        <Group key={g.date} label={dayLabel(g.date, lang)} labelA11y={dayLong(g.date, lang)}>
          <ListCard>
            {g.items.map((tx, i) => (
              <TransactionRow
                key={tx.id}
                tx={tx}
                accountName={accounts.find((a) => a.id === tx.accountId)?.name ?? t('tx.accountFallback')}
                mainCurrency={mainCurrency}
                divider={i < g.items.length - 1}
                selected={onSelect ? tx.id === selectedId : undefined}
                onPress={() => (onSelect ? onSelect(tx.id) : router.push({ pathname: '/trx/[id]', params: { id: tx.id } }))}
              />
            ))}
          </ListCard>
        </Group>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.lg },
});

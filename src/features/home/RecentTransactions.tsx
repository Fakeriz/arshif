import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { useT } from '@/i18n';
import { Button, EmptyState, Group, ListCard } from '@/components/ui';
import type { Transaction } from '@/data/types';
import { sortNewestFirst } from '@/lib/transactions';
import type { AccountWithBalance } from '@/state/AppStore';
import { space } from '@/theme/tokens';

import { TransactionRow } from '../transactions/TransactionRow';

/** accountId: hanya transaksi akun itu (termasuk transfer masuk), "Lihat semua" membuka Transaksi terfilter akun itu. */
export function RecentTransactions({ transactions, accounts, mainCurrency, accountId }: { transactions: Transaction[]; accounts: AccountWithBalance[]; mainCurrency: string; accountId?: string }) {
  const router = useRouter();
  const t = useT();
  const own = accountId ? transactions.filter((tx) => tx.accountId === accountId || tx.toAccountId === accountId) : transactions;
  const recent = sortNewestFirst(own).slice(0, 5);
  const account = accountId ? accounts.find((a) => a.id === accountId) : undefined;
  return (
    <Group
      label={account ? t('home.recent.forAccount', { name: account.name }) : t('home.recent.title')}
      right={
        recent.length > 0 ? (
          // Margin negatif: tombol tetap 42 px untuk diketuk, tapi tidak membuat baris judul setinggi tombol.
          <View style={styles.seeAll}>
            <Button label={t('home.recent.seeAll')} variant="ghost" size="sm" onPress={() => router.navigate(accountId ? { pathname: '/transaksi', params: { akun: accountId } } : '/transaksi')} />
          </View>
        ) : undefined
      }
    >
      <ListCard>
      {recent.length === 0 ? (
        <EmptyState compact title={t('home.recent.emptyTitle')} message={t('home.recent.emptyMessage')} actionLabel={t('home.recent.emptyAction')} onAction={() => router.push('/tambah')} />
      ) : (
        recent.map((tx, i) => (
          <TransactionRow
            key={tx.id}
            tx={tx}
            accountName={accounts.find((a) => a.id === tx.accountId)?.name ?? t('home.recent.accountFallback')}
            mainCurrency={mainCurrency}
            divider={i < recent.length - 1}
            onPress={() => router.push({ pathname: '/trx/[id]', params: { id: tx.id } })}
          />
        ))
      )}
      </ListCard>
    </Group>
  );
}

const styles = StyleSheet.create({
  seeAll: { marginVertical: -11, marginRight: -space.sm },
});

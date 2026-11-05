import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Card, EmptyState } from '@/components/ui';
import type { Transaction } from '@/data/types';
import { sortNewestFirst } from '@/lib/transactions';
import type { AccountWithBalance } from '@/state/AppStore';
import { space } from '@/theme/tokens';

import { TransactionRow } from '../transactions/TransactionRow';

export function RecentTransactions({ transactions, accounts, mainCurrency }: { transactions: Transaction[]; accounts: AccountWithBalance[]; mainCurrency: string }) {
  const router = useRouter();
  const recent = sortNewestFirst(transactions).slice(0, 5);
  return (
    <Card padding="md">
      <View style={styles.head}>
        <AppText variant="h3">Transaksi terakhir</AppText>
        {recent.length > 0 && <Button label="Lihat semua" variant="ghost" size="sm" onPress={() => router.navigate('/transaksi')} />}
      </View>
      {recent.length === 0 ? (
        <EmptyState compact title="Belum ada transaksi" message="Foto struk atau ucapkan pengeluaranmu, tercatat dalam 10 detik." actionLabel="Catat sekarang" onAction={() => router.push('/tambah')} />
      ) : (
        recent.map((tx, i) => (
          <TransactionRow
            key={tx.id}
            tx={tx}
            accountName={accounts.find((a) => a.id === tx.accountId)?.name ?? 'Akun'}
            mainCurrency={mainCurrency}
            divider={i < recent.length - 1}
            onPress={() => router.push({ pathname: '/trx/[id]', params: { id: tx.id } })}
          />
        ))
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.xs },
});

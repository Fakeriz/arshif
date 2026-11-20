import { useRouter } from 'expo-router';

import { useT } from '@/i18n';
import { Button, EmptyState, Group, ListCard } from '@/components/ui';
import type { Transaction } from '@/data/types';
import { sortNewestFirst } from '@/lib/transactions';
import type { AccountWithBalance } from '@/state/AppStore';

import { TransactionRow } from '../transactions/TransactionRow';

export function RecentTransactions({ transactions, accounts, mainCurrency }: { transactions: Transaction[]; accounts: AccountWithBalance[]; mainCurrency: string }) {
  const router = useRouter();
  const t = useT();
  const recent = sortNewestFirst(transactions).slice(0, 5);
  return (
    <Group
      label={t('home.recent.title')}
      right={recent.length > 0 ? <Button label={t('home.recent.seeAll')} variant="ghost" size="sm" onPress={() => router.navigate('/transaksi')} /> : undefined}
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


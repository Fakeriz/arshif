import { ListFilter, Search } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { categoryLabel, useT, type MsgKey } from '@/i18n';
import { Screen } from '@/components/shell/Screen';
import { TabHeader } from '@/components/shell/TabHeader';
import { AppText, Chip, CurrencyText, EmptyState, Input } from '@/components/ui';
import { ReviewBanner } from '@/features/smartlog/ReviewBanner';
import { MissingRatesBanner } from '@/features/fx/MissingRatesBanner';
import { FilterSheet } from '@/features/transactions/FilterSheet';
import { TransactionList } from '@/features/transactions/TransactionList';
import { TransactionListSkeleton } from '@/features/transactions/TransactionListSkeleton';
import { useLoadState } from '@/state/loadState';
import { useLedger } from '@/state/derived';
import { useRetry } from '@/state/useRetry';
import { filterTransactions, isFilterActive, reimbursementIncomeIds, totals, type TxFilter } from '@/lib/transactions';
import { space } from '@/theme/tokens';

const TYPES: { key: NonNullable<TxFilter['type']>; label: MsgKey }[] = [
  { key: 'all', label: 'tx.all' },
  { key: 'expense', label: 'common.expense' },
  { key: 'income', label: 'common.income' },
  { key: 'transfer', label: 'common.transfer' },
];

export default function TransaksiScreen() {
  const router = useRouter();
  const t = useT();
  const demo = useLoadState();
  const retry = useRetry();
  const { akun } = useLocalSearchParams<{ akun?: string }>();
  const ledger = useLedger();
  const [filter, setFilter] = useState<TxFilter>({ type: 'all', accountId: akun ?? null });
  const [sheet, setSheet] = useState(false);

  const shown = useMemo(() => filterTransactions(ledger.transactions, filter, (k) => categoryLabel(t, k)), [ledger.transactions, filter, t]);
  // Pemasukan pengganti reimbursement dicari dari SEMUA transaksi (pengeluarannya bisa tidak ikut tersaring).
  const repayments = useMemo(() => reimbursementIncomeIds(ledger.transactions), [ledger.transactions]);
  const sum = useMemo(() => totals(shown, ledger.mainCurrency, repayments), [shown, ledger.mainCurrency, repayments]);
  const extra = (filter.accountId ? 1 : 0) + (filter.categoryKey ? 1 : 0);
  const active = isFilterActive(filter);

  let body;
  if (demo === 'error') {
    body = <EmptyState kind="error" title={t('tx.errorTitle')} message={t('tx.errorMessage')} actionLabel={t('common.retry')} onAction={retry} />;
  } else if (demo === 'loading') {
    body = <TransactionListSkeleton />;
  } else if (ledger.transactions.length === 0) {
    body = <EmptyState title={t('tx.emptyTitle')} message={t('tx.emptyMessage')} actionLabel={t('tx.emptyAction')} onAction={() => router.push('/tambah')} />;
  } else if (shown.length === 0) {
    body = (
      <EmptyState
        title={t('tx.noMatchTitle')}
        message={t('tx.noMatchMessage')}
        actionLabel={t('tx.clearFilters')}
        onAction={() => setFilter({ type: 'all', accountId: null, categoryKey: null, query: '' })}
      />
    );
  } else {
    body = <TransactionList transactions={shown} accounts={ledger.accounts} mainCurrency={ledger.mainCurrency} />;
  }

  const ready = demo !== 'error' && demo !== 'loading' && ledger.transactions.length > 0;

  return (
    <Screen tabs>
      <TabHeader title={t('tx.title')} subtitle={ready ? t('tx.count', { shown: shown.length, total: ledger.transactions.length }) : undefined} />
      <ReviewBanner />
      <MissingRatesBanner />
      {ready && (
        <>
          <Input
            label={t('tx.search')}
            icon={Search}
            placeholder={t('tx.searchPlaceholder')}
            value={filter.query ?? ''}
            onChangeText={(query) => setFilter((f) => ({ ...f, query }))}
            returnKeyType="search"
            autoCorrect={false}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips} contentContainerStyle={styles.chipRow}>
            {TYPES.map((ty) => (
              <Chip key={ty.key} label={t(ty.label)} selected={(filter.type ?? 'all') === ty.key} onPress={() => setFilter((f) => ({ ...f, type: ty.key }))} />
            ))}
            <Chip label={t('tx.filter')} icon={ListFilter} count={extra || undefined} selected={extra > 0} onPress={() => setSheet(true)} />
          </ScrollView>
          {active && shown.length > 0 && (
            <View style={styles.sum}>
              <AppText variant="caption" tone="secondary">
                {t('tx.filterResult')}
              </AppText>
              <View style={styles.sumVals}>
                <CurrencyText amount={sum.income} currency={ledger.mainCurrency} kind="income" variant="caption" />
                <CurrencyText amount={sum.expense} currency={ledger.mainCurrency} kind="expense" variant="caption" />
              </View>
            </View>
          )}
        </>
      )}
      {body}
      <FilterSheet visible={sheet} onClose={() => setSheet(false)} filter={filter} onChange={setFilter} accounts={ledger.accounts} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { marginHorizontal: -space.lg },
  chipRow: { gap: space.sm, paddingHorizontal: space.lg },
  sum: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.md },
  sumVals: { flexDirection: 'row', gap: space.md },
});

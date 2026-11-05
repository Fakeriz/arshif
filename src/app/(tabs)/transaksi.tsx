import { ListFilter, Search } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/shell/Screen';
import { TabHeader } from '@/components/shell/TabHeader';
import { AppText, Chip, CurrencyText, EmptyState, Input } from '@/components/ui';
import { FilterSheet } from '@/features/transactions/FilterSheet';
import { TransactionList } from '@/features/transactions/TransactionList';
import { TransactionListSkeleton } from '@/features/transactions/TransactionListSkeleton';
import { useDemoState } from '@/state/demo';
import { useLedger } from '@/state/derived';
import { useRetry } from '@/state/useRetry';
import { filterTransactions, isFilterActive, totals, type TxFilter } from '@/lib/transactions';
import { space } from '@/theme/tokens';

const TYPES: { key: NonNullable<TxFilter['type']>; label: string }[] = [
  { key: 'all', label: 'Semua' },
  { key: 'expense', label: 'Pengeluaran' },
  { key: 'income', label: 'Pemasukan' },
  { key: 'transfer', label: 'Transfer' },
];

export default function TransaksiScreen() {
  const router = useRouter();
  const demo = useDemoState();
  const retry = useRetry();
  const { akun } = useLocalSearchParams<{ akun?: string }>();
  const ledger = useLedger();
  const [filter, setFilter] = useState<TxFilter>({ type: 'all', accountId: akun ?? null });
  const [sheet, setSheet] = useState(false);

  const shown = useMemo(() => filterTransactions(ledger.transactions, filter), [ledger.transactions, filter]);
  const sum = useMemo(() => totals(shown, ledger.mainCurrency), [shown, ledger.mainCurrency]);
  const extra = (filter.accountId ? 1 : 0) + (filter.categoryKey ? 1 : 0);
  const active = isFilterActive(filter);

  let body;
  if (demo === 'error') {
    body = <EmptyState kind="error" title="Transaksi gagal dimuat" message="Periksa koneksimu lalu coba lagi. Datamu aman." actionLabel="Coba lagi" onAction={retry} />;
  } else if (demo === 'loading') {
    body = <TransactionListSkeleton />;
  } else if (ledger.transactions.length === 0) {
    body = <EmptyState title="Belum ada transaksi" message="Foto struk atau ucapkan pengeluaranmu, tercatat dalam 10 detik." actionLabel="Catat sekarang" onAction={() => router.push('/tambah')} />;
  } else if (shown.length === 0) {
    body = (
      <EmptyState
        title="Tidak ada transaksi yang cocok"
        message="Coba kata kunci lain atau longgarkan filternya."
        actionLabel="Hapus semua filter"
        onAction={() => setFilter({ type: 'all', accountId: null, categoryKey: null, query: '' })}
      />
    );
  } else {
    body = <TransactionList transactions={shown} accounts={ledger.accounts} mainCurrency={ledger.mainCurrency} />;
  }

  const ready = demo !== 'error' && demo !== 'loading' && ledger.transactions.length > 0;

  return (
    <Screen tabs>
      <TabHeader title="Transaksi" subtitle={ready ? `${shown.length} dari ${ledger.transactions.length} transaksi` : undefined} />
      {ready && (
        <>
          <Input
            label="Cari transaksi"
            icon={Search}
            placeholder="Toko, catatan, kategori"
            value={filter.query ?? ''}
            onChangeText={(query) => setFilter((f) => ({ ...f, query }))}
            returnKeyType="search"
            autoCorrect={false}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips} contentContainerStyle={styles.chipRow}>
            {TYPES.map((t) => (
              <Chip key={t.key} label={t.label} selected={(filter.type ?? 'all') === t.key} onPress={() => setFilter((f) => ({ ...f, type: t.key }))} />
            ))}
            <Chip label="Filter" icon={ListFilter} count={extra || undefined} selected={extra > 0} onPress={() => setSheet(true)} />
          </ScrollView>
          {active && shown.length > 0 && (
            <View style={styles.sum}>
              <AppText variant="caption" tone="secondary">
                Hasil filter
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

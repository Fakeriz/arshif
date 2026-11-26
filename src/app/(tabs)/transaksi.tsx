import { ListFilter, Search } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';

import { categoryLabel, useT, type MsgKey } from '@/i18n';
import { DESKTOP_WIDE, GridCell, GridRow } from '@/components/shell/DesktopGrid';
import { Screen } from '@/components/shell/Screen';
import { HeaderButton } from '@/components/shell/HeaderActions';
import { TabHeader } from '@/components/shell/TabHeader';
import { AppText, Badge, Chip, CurrencyText, EmptyState, Input, PopIn } from '@/components/ui';
import { ReviewBanner } from '@/features/smartlog/ReviewBanner';
import { MissingRatesBanner } from '@/features/fx/MissingRatesBanner';
import { FilterSheet } from '@/features/transactions/FilterSheet';
import { TransactionDetail } from '@/features/transactions/TransactionDetail';
import { TransactionList } from '@/features/transactions/TransactionList';
import { TransactionListSkeleton } from '@/features/transactions/TransactionListSkeleton';
import { useDesktop } from '@/hooks/useDesktop';
import { useLoadState } from '@/state/loadState';
import { useEnter } from '@/theme/motion';
import { useLedger } from '@/state/derived';
import { useRetry } from '@/state/useRetry';
import { filterTransactions, isFilterActive, reimbursementIncomeIds, sortNewestFirst, totals, type TxFilter } from '@/lib/transactions';
import { space } from '@/theme/tokens';

const TYPES: { key: NonNullable<TxFilter['type']>; label: MsgKey }[] = [
  { key: 'all', label: 'tx.all' },
  { key: 'expense', label: 'common.expense' },
  { key: 'income', label: 'common.income' },
  { key: 'transfer', label: 'common.transfer' },
];

/** Baris per tahap render daftar transaksi. */
const PAGE_ROWS = 60;

export default function TransaksiScreen() {
  const router = useRouter();
  const t = useT();
  const demo = useLoadState();
  const retry = useRetry();
  const { akun } = useLocalSearchParams<{ akun?: string }>();
  const ledger = useLedger();
  const [filter, setFilter] = useState<TxFilter>({ type: 'all', accountId: akun ?? null });
  useEffect(() => {
    if (akun !== undefined) setFilter((f) => ({ ...f, accountId: akun || null }));
  }, [akun]);
  const [sheet, setSheet] = useState(false);
  // Render bertahap: daftar panjang (ratusan baris di ScrollView) membuat scroll patah-patah.
  const [limit, setLimit] = useState(PAGE_ROWS);

  const shown = useMemo(() => filterTransactions(ledger.transactions, filter, (k) => categoryLabel(t, k)), [ledger.transactions, filter, t]);
  const visible = useMemo(() => sortNewestFirst(shown).slice(0, limit), [shown, limit]);
  // Filter berubah = mulai lagi dari atas.
  useEffect(() => setLimit(PAGE_ROWS), [filter]);
  // Pemasukan pengganti reimbursement dicari dari SEMUA transaksi (pengeluarannya bisa tidak ikut tersaring).
  const repayments = useMemo(() => reimbursementIncomeIds(ledger.transactions), [ledger.transactions]);
  const sum = useMemo(() => totals(shown, ledger.mainCurrency, repayments), [shown, ledger.mainCurrency, repayments]);
  const extra = (filter.accountId ? 1 : 0) + (filter.categoryKey ? 1 : 0);
  const active = isFilterActive(filter);
  const desktop = useDesktop();
  // Desktop: transaksi yang dibuka di panel kanan; bawaan = baris teratas yang terlihat.
  const [picked, setPicked] = useState<string | null>(null);
  const selectedId = visible.some((tx) => tx.id === picked) ? picked : (visible[0]?.id ?? null);

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
    body = (
      <TransactionList
        transactions={visible}
        accounts={ledger.accounts}
        mainCurrency={ledger.mainCurrency}
        selectedId={desktop ? selectedId : undefined}
        onSelect={desktop ? setPicked : undefined}
      />
    );
  }

  const ready = demo !== 'error' && demo !== 'loading' && ledger.transactions.length > 0;

  const list = (
    <>
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
            // Jumlah hasil muncul saat mengetik (Motion Kit "Pencarian"); abu bila tidak ada.
            trailing={
              <PopIn visible={(filter.query ?? '').trim().length >= 2} from={0.5}>
                <View aria-live="polite">
                  <Badge label={t('tx.searchResults', { count: shown.length })} tone={shown.length ? 'accent' : 'neutral'} />
                </View>
              </PopIn>
            }
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips} contentContainerStyle={styles.chipRow}>
            {TYPES.map((ty) => (
              <Chip key={ty.key} label={t(ty.label)} selected={(filter.type ?? 'all') === ty.key} onPress={() => setFilter((f) => ({ ...f, type: ty.key }))} />
            ))}
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
    </>
  );
  const split = desktop && ready && !!selectedId;
  return (
    <Screen tabs maxWidth={split ? DESKTOP_WIDE : undefined} onEndReached={visible.length < shown.length ? () => setLimit((n) => n + PAGE_ROWS) : undefined}>
      <TabHeader
        title={t('tx.title')}
        subtitle={ready ? t('tx.count', { shown: shown.length, total: ledger.transactions.length }) : undefined}
        right={ready ? <HeaderButton label={extra ? `${t('tx.filter')}, ${extra}` : t('tx.filter')} icon={ListFilter} badge={extra} selected={extra > 0} onPress={() => setSheet(true)} /> : undefined}
      />
      {split && selectedId ? (
        // Desktop: daftar kiri, detail transaksi terpilih menempel di kanan saat daftar digulir.
        <GridRow>
          <GridCell span={7} order={0}>
            {list}
          </GridCell>
          <GridCell span={5} order={1}>
            <View style={styles.sticky}>
              <DetailPanel key={selectedId} id={selectedId} onDeleted={() => setPicked(null)} />
            </View>
          </GridCell>
        </GridRow>
      ) : (
        list
      )}
      <FilterSheet visible={sheet} onClose={() => setSheet(false)} filter={filter} onChange={setFilter} accounts={ledger.accounts} />
    </Screen>
  );
}

/** Detail di panel: muncul naik 8px tiap kali baris lain dipilih, menandai isi panel sudah berganti. */
function DetailPanel({ id, onDeleted }: { id: string; onDeleted: () => void }) {
  const enter = useEnter({ y: 8 });
  return (
    <Animated.View style={[styles.panel, enter]}>
      <TransactionDetail id={id} embedded onDeleted={onDeleted} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Web: panel tetap terlihat saat daftar panjang digulir (RN-web meneruskan position sticky).
  sticky: { position: 'sticky' as ViewStyle['position'], top: space.lg },
  panel: { gap: space.lg },
  chips: { marginHorizontal: -space.lg },
  chipRow: { gap: space.sm, paddingHorizontal: space.lg },
  sum: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.md },
  sumVals: { flexDirection: 'row', gap: space.md },
});

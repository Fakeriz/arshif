import { ArrowDownLeft, ArrowUpRight } from 'lucide-react-native';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, StatTile } from '@/components/ui';
import type { Transaction } from '@/data/types';
import { useT } from '@/i18n';
import { periodSeries } from '@/lib/budget';
import { pctChange } from '@/lib/chart';
import { todayYmd } from '@/lib/dates';
import { useStore } from '@/state/AppStore';
import { space } from '@/theme/tokens';

/** Pemasukan & pengeluaran periode gajian berjalan, delta setara vs periode lalu, sparkline 6 periode. */
export function PeriodStats({
  transactions,
  currency,
  hidden,
}: {
  transactions: Transaction[];
  currency: string;
  hidden: boolean;
}) {
  const t = useT();
  const { state } = useStore();
  const s = useMemo(
    () => periodSeries(transactions, todayYmd(), state.payday, currency),
    // ratesVersion: konversi ke mata uang utama ikut berubah saat kurs dimuat.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [transactions, state.payday, currency, state.ratesVersion],
  );
  const last = s.income.length - 1;
  // Pembanding 0 (periode lalu kosong) → badge 'belum ada pembanding', bukan +∞%.
  const incomeChange =
    last > 0 ? pctChange(s.income[last - 1], s.income[last]) : null;
  const expenseChange =
    last > 0 ? pctChange(s.expense[last - 1], s.expense[last]) : null;

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <StatTile
          label={t('common.income')}
          icon={ArrowDownLeft}
          amount={s.income[last]}
          currency={currency}
          change={incomeChange}
          series={s.income}
          hidden={hidden}
        />
        <StatTile
          label={t('common.expense')}
          icon={ArrowUpRight}
          amount={s.expense[last]}
          currency={currency}
          change={expenseChange}
          series={s.expense}
          invert
          hidden={hidden}
        />
      </View>
      {(incomeChange !== null || expenseChange !== null) && (
        <AppText variant='caption' tone='muted'>
          {t('home.stats.caption', { days: s.days })}
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
});

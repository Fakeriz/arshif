import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

import { AppText } from './AppText';
import type { CashflowPoint } from './CashflowChart';
import { CurrencyText } from './CurrencyText';

/**
 * Ringkasan kolom terpilih: pemasukan, pengeluaran, selisih.
 * Baris label–nilai (bukan tiga kolom sempit) agar nominal tidak pernah terpotong.
 */
export function CashflowSummary({ point, currency }: { point: CashflowPoint; currency: string }) {
  const { colors } = useTheme();
  const net = point.income - point.expense;
  return (
    <View style={[styles.box, { backgroundColor: colors.surfaceSunken, borderColor: colors.border }]}>
      <AppText variant="overline" tone="muted" uppercase>
        {point.label}
      </AppText>
      <Stat label="Pemasukan" dot={colors.positive}>
        <CurrencyText amount={point.income} currency={currency} kind="income" variant="bodyStrong" />
      </Stat>
      <Stat label="Pengeluaran" dot={colors.textSecondary}>
        <CurrencyText amount={point.expense} currency={currency} kind="expense" variant="bodyStrong" />
      </Stat>
      <View style={[styles.divider, { backgroundColor: colors.border }]} />
      <Stat label="Selisih">
        <CurrencyText amount={net} currency={currency} kind={net >= 0 ? 'income' : 'over'} variant="bodyStrong" />
      </Stat>
    </View>
  );
}

function Stat({ label, dot, children }: { label: string; dot?: string; children: ReactNode }) {
  return (
    <View style={styles.row}>
      <View style={styles.labelRow}>
        {dot && <View style={[styles.dot, { backgroundColor: dot }]} />}
        <AppText variant="caption" tone="secondary" numberOfLines={1}>
          {label}
        </AppText>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: radius.md, borderWidth: 1, padding: space.md, gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs, flexShrink: 1 },
  dot: { width: 8, height: 8, borderRadius: radius.full },
  divider: { height: 1 },
});

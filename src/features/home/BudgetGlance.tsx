import { ChevronRight } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppText, Badge, Card, CurrencyText, Icon, ProgressBar } from '@/components/ui';
import { PACE_LABEL, type BudgetPeriod, type Pace } from '@/lib/budget';
import { shortDate } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';

const PACE_TONE: Record<Pace, 'positive' | 'warning' | 'negative'> = { sesuai: 'positive', agak_cepat: 'warning', terlalu_cepat: 'negative' };

export type BudgetGlanceProps = {
  period: BudgetPeriod;
  pace: Pace;
  safePerDay: number;
  spent: number;
  limit: number;
  currency: string;
  onPress: () => void;
};

/** Ringkasan satu keputusan: berapa yang aman dibelanjakan hari ini. */
export function BudgetGlance({ period, pace, safePerDay, spent, limit, currency, onPress }: BudgetGlanceProps) {
  const { colors } = useTheme();
  return (
    <Card onPress={onPress} accessibilityLabel={`Anggaran periode ini, ${PACE_LABEL[pace]}. Aman dibelanjakan ${formatMoney(safePerDay, currency)} per hari. Buka Anggaran`}>
      <View style={styles.head}>
        <View style={styles.titles}>
          <AppText variant="h3">Anggaran periode ini</AppText>
          <AppText variant="caption" tone="muted">
            {`${shortDate(period.start)} sampai ${shortDate(period.end)} · ${period.daysLeft} hari lagi`}
          </AppText>
        </View>
        <Badge label={PACE_LABEL[pace]} tone={PACE_TONE[pace]} />
        <Icon icon={ChevronRight} color={colors.textMuted} />
      </View>
      <View style={styles.safe}>
        <AppText variant="caption" tone="secondary">
          Aman dibelanjakan
        </AppText>
        <View style={styles.safeRow}>
          <CurrencyText amount={safePerDay} currency={currency} variant="h1" />
          <AppText variant="caption" tone="muted">
            per hari
          </AppText>
        </View>
      </View>
      <ProgressBar value={limit > 0 ? spent / limit : 0} accessibilityLabel="Pemakaian anggaran kebutuhan dan keinginan" />
      <AppText variant="caption" tone="muted">
        {`${formatMoney(spent, currency)} dari ${formatMoney(limit, currency)} untuk kebutuhan dan keinginan`}
      </AppText>
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  titles: { flex: 1, gap: space.xxs },
  safe: { marginTop: space.lg, marginBottom: space.md, gap: space.xxs },
  safeRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
});

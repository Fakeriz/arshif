import { Eye, EyeOff, RefreshCw } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  AppText,
  Card,
  CategoryIcon,
  CurrencyText,
  Icon,
  ListItem,
  ListItemSkeleton,
  ProgressBar,
} from '@/components/ui';
import { CATEGORIES } from '@/constants/categories';
import { formatCompact } from '@/lib/money';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';

import { budgetRows, sampleTransactions } from './sample-data';
import { Row, Section, StateLabel } from './Section';

export function MoneySection() {
  const { colors } = useTheme();
  const [hidden, setHidden] = useState(false);
  const [worth, setWorth] = useState(48215400);
  return (
    <Section index="08 · Nominal" title="CurrencyText" note="Pemasukan hijau dengan “+”, pengeluaran warna teks dengan “−”, merah hanya untuk over budget.">
      <Card variant="raised" padding="xl">
        <View style={styles.heroHead}>
          <AppText variant="caption" tone="secondary">
            Total kekayaan bersih
          </AppText>
          <Pressable onPress={() => setHidden((h) => !h)} hitSlop={12} accessibilityRole="button" accessibilityLabel={hidden ? 'Tampilkan saldo' : 'Sembunyikan saldo'}>
            <Icon icon={hidden ? EyeOff : Eye} color={colors.textSecondary} />
          </Pressable>
        </View>
        <CurrencyText amount={worth} currency="IDR" variant="amountHero" countUp hidden={hidden} />
        <View style={styles.heroFoot}>
          <AppText variant="caption" tone="muted">
            4 akun · dikonversi ke IDR · kurs per 14.00
          </AppText>
          <Pressable onPress={() => setWorth((w) => w + 1250000)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Simulasikan perubahan saldo">
            <Icon icon={RefreshCw} color={colors.textMuted} size={16} />
          </Pressable>
        </View>
      </Card>
      <Row>
        <CurrencyText amount={14250000} currency="IDR" kind="income" />
        <CurrencyText amount={87500} currency="IDR" kind="expense" />
        <CurrencyText amount={-115000} currency="IDR" kind="over" />
      </Row>
      <Row>
        <CurrencyText amount={1250} currency="MYR" />
        <CurrencyText amount={35000} currency="TRY" />
        <CurrencyText amount={999} currency="USD" />
        <CurrencyText amount={-2340000} currency="IDR" />
      </Row>
    </Section>
  );
}

export function ProgressSection() {
  return (
    <Section index="09 · Progress" title="ProgressBar" note="< 80% kuningan · 80–100% peringatan · > 100% merah — sama dengan ambang notifikasi budget.">
      {budgetRows.map((b) => {
        const ratio = b.used / b.limit;
        return (
          <View key={b.category} style={styles.budgetRow}>
            <View style={styles.budgetHead}>
              <CategoryIcon category={b.category} size={32} />
              <AppText variant="bodyStrong" style={styles.flex} numberOfLines={1}>
                {b.label}
              </AppText>
              <CurrencyText amount={b.used} currency="IDR" variant="caption" kind={ratio > 1 ? 'over' : 'balance'} />
              <AppText variant="caption" tone="muted">{`/ ${formatCompact(b.limit, 'IDR')}`}</AppText>
            </View>
            <ProgressBar value={ratio} accessibilityLabel={`${b.label} ${Math.round(ratio * 100)} persen`} />
          </View>
        );
      })}
      <StateLabel>Loading</StateLabel>
      <ProgressBar value={0} loading />
    </Section>
  );
}

export function ListSection() {
  return (
    <Section index="10 · Daftar" title="ListItem & CategoryIcon">
      <Card padding="lg" style={styles.listCard}>
        {sampleTransactions.map((t, i) => (
          <ListItem
            key={t.id}
            leading={<CategoryIcon category={t.category} />}
            title={t.merchant}
            subtitle={`${t.account} · ${t.time}`}
            trailing={<CurrencyText amount={t.amount} currency={t.currency} kind={t.kind} variant="bodyStrong" />}
            divider={i < sampleTransactions.length - 1}
            onPress={() => undefined}
          />
        ))}
      </Card>
      <StateLabel>Loading</StateLabel>
      <Card padding="lg" style={styles.listCard}>
        <ListItemSkeleton divider />
        <ListItemSkeleton />
      </Card>
      <View style={styles.iconGrid}>
        {CATEGORIES.map((c) => (
          <View key={c.key} style={styles.iconCell}>
            <CategoryIcon category={c.key} />
            <AppText variant="caption" tone="muted" align="center" numberOfLines={2}>
              {c.label}
            </AppText>
          </View>
        ))}
      </View>
    </Section>
  );
}

const styles = StyleSheet.create({
  heroHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space.xs },
  heroFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space.sm },
  budgetRow: { gap: space.sm },
  budgetHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1 },
  listCard: { paddingVertical: space.xs },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space.lg },
  iconCell: { width: '25%', alignItems: 'center', gap: space.xs, paddingHorizontal: space.xs },
});

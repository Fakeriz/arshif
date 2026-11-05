import { StyleSheet, View } from 'react-native';

import { AppText, Badge, Card, CategoryIcon, CurrencyText, ProgressBar } from '@/components/ui';
import { CATEGORIES, type Bucket } from '@/constants/categories';
import { PACE_LABEL, type Pace } from '@/lib/budget';
import { formatCompact } from '@/lib/money';
import { space } from '@/theme/tokens';

const PACE_TONE: Record<Pace, 'positive' | 'warning' | 'negative'> = { sesuai: 'positive', agak_cepat: 'warning', terlalu_cepat: 'negative' };

export type BucketSectionProps = {
  bucket: Bucket;
  label: string;
  percent: number;
  color: string;
  spent: number;
  limit: number;
  pace: Pace;
  currency: string;
  categoryLimits: Record<string, number>;
  categorySpent: (key: string) => number;
};

export function BucketSection({ bucket, label, percent, color, spent, limit, pace, currency, categoryLimits, categorySpent }: BucketSectionProps) {
  const rows = CATEGORIES.filter((c) => c.bucket === bucket && (categoryLimits[c.key] !== undefined || categorySpent(c.key) > 0)).sort((a, b) => categorySpent(b.key) - categorySpent(a.key));
  const saving = bucket === 'savings';
  const over = !saving && spent > limit;
  return (
    <Card>
      <View style={styles.head}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <View style={styles.titles}>
          <AppText variant="h3">{label}</AppText>
          <AppText variant="caption" tone="muted">{saving ? `${percent}% dari penghasilan, target` : `${percent}% dari penghasilan`}</AppText>
        </View>
        {saving ? (
          <Badge label={`${limit > 0 ? Math.round((spent / limit) * 100) : 0}% dari target`} tone="positive" />
        ) : (
          <Badge label={PACE_LABEL[pace]} tone={PACE_TONE[pace]} />
        )}
      </View>
      <View style={styles.total}>
        <CurrencyText amount={spent} currency={currency} kind={over ? 'over' : 'balance'} variant="h2" />
        <AppText variant="caption" tone="muted">{`${saving ? 'target' : 'dari'} ${formatCompact(limit, currency)}`}</AppText>
      </View>
      <ProgressBar value={limit > 0 ? spent / limit : 0} tone={saving ? 'positive' : 'auto'} accessibilityLabel={saving ? `${label} tercapai` : `${label} terpakai`} />
      <View style={styles.rows}>
        {rows.map((c) => {
          const s = categorySpent(c.key);
          const l = categoryLimits[c.key];
          return (
            <View key={c.key} style={styles.row}>
              <View style={styles.rowTop}>
                <CategoryIcon category={c.key} size={32} />
                <AppText variant="bodyStrong" style={styles.rowName} numberOfLines={1}>
                  {c.label}
                </AppText>
                <CurrencyText amount={s} currency={currency} kind={l !== undefined && s > l ? 'over' : 'balance'} variant="caption" />
                {l !== undefined && <AppText variant="caption" tone="muted">{`/ ${formatCompact(l, currency)}`}</AppText>}
              </View>
              {l !== undefined && <ProgressBar value={s / l} height={6} accessibilityLabel={`${c.label} ${Math.round((s / l) * 100)} persen`} />}
            </View>
          );
        })}
        {rows.length === 0 && (
          <AppText variant="caption" tone="muted">
            Belum ada pengeluaran di bucket ini.
          </AppText>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  dot: { width: 12, height: 12, borderRadius: 6 },
  titles: { flex: 1, gap: space.xxs },
  total: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm, marginTop: space.lg, marginBottom: space.sm },
  rows: { gap: space.lg, marginTop: space.xl },
  row: { gap: space.sm },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  rowName: { flex: 1 },
});

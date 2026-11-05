import { StyleSheet, View } from 'react-native';

import { AppText, Card } from '@/components/ui';
import type { Plan } from '@/data/types';
import { useT, type TFunction } from '@/i18n';
import { QUOTA_WINDOW, quotaFor, type QuotaKey } from '@/lib/quota';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, space } from '@/theme/tokens';

const ROWS: QuotaKey[] = ['accounts', 'goals', 'billsDebts', 'subscriptions', 'automation', 'scan', 'importPdf', 'invoice'];

function limitLabel(t: TFunction, plan: Plan, key: QuotaKey): string {
  const n = quotaFor(plan, key);
  if (n === null) return t('billing.compare.unlimited');
  if (n === 0) return t('billing.compare.locked');
  const w = QUOTA_WINDOW[key];
  if (w === 'total') return t('billing.compare.max', { n });
  if (w === 'day') return t('billing.compare.perDay', { n });
  return t('billing.compare.perMonth', { n });
}

/** Tabel Free vs Premium dari QUOTAS (cermin plan_limits server), jadi angka di layar = angka yang ditegakkan. */
export function PlanCompare() {
  const t = useT();
  const { colors } = useTheme();
  const rows: { label: string; free: string; premium: string }[] = [
    ...ROWS.map((k) => ({ label: t(`domain.quota.${k}`), free: limitLabel(t, 'free', k), premium: limitLabel(t, 'premium', k) })),
    { label: t('billing.compare.taxRow'), free: t('billing.compare.taxFree'), premium: t('billing.compare.taxPremium') },
    { label: t('billing.compare.coachRow'), free: t('billing.compare.coachFree'), premium: t('billing.compare.coachPremium') },
  ];
  return (
    <Card padding="md">
      <AppText variant="h3" style={styles.title}>
        {t('billing.compare.title')}
      </AppText>
      <View style={[styles.row, styles.header]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={styles.label} />
        <AppText variant="overline" tone="secondary" style={styles.col}>
          {t('billing.compare.free')}
        </AppText>
        <AppText variant="overline" tone="accent" style={styles.col}>
          {t('billing.compare.premium')}
        </AppText>
      </View>
      {rows.map((r, i) => (
        <View
          key={r.label}
          accessible
          accessibilityLabel={`${r.label}. ${t('billing.compare.free')}: ${r.free}. ${t('billing.compare.premium')}: ${r.premium}`}
          style={[styles.row, styles.item, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}
        >
          <AppText variant="body" style={styles.label}>
            {r.label}
          </AppText>
          <AppText variant="caption" tone="secondary" style={styles.col}>
            {r.free}
          </AppText>
          <AppText variant="caption" style={[styles.col, styles.premium]}>
            {r.premium}
          </AppText>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { paddingHorizontal: space.xs, paddingTop: space.xs },
  header: { paddingTop: space.md, paddingBottom: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.xs },
  item: { paddingVertical: space.md },
  label: { flex: 1, minWidth: 0 },
  col: { width: 92 },
  premium: { fontFamily: fonts.semibold },
});

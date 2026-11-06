import { StyleSheet, View } from 'react-native';

import { AppText, ProgressBar } from '@/components/ui';
import { useT } from '@/i18n';
import type { Utilization } from '@/lib/credit';
import { formatMoney } from '@/lib/money';
import { space } from '@/theme/tokens';

/**
 * Utilisasi limit. Kartu di grup memakai angka grup (terpakai gabungan ÷ limit gabungan), dengan nama grupnya,
 * supaya jelas angka itu bukan limit kartu ini saja.
 */
export function UtilizationBlock({ u, compact }: { u: Utilization; compact?: boolean }) {
  const t = useT();
  const pct = Math.round(u.ratio * 100);
  const label = u.scope === 'group' ? t('acct.limit.groupUsed', { name: u.groupName ?? '', pct }) : t('acct.limit.cardUsed', { pct });
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <AppText variant={compact ? 'caption' : 'bodyStrong'} style={styles.flex} numberOfLines={2}>
          {label}
        </AppText>
        <AppText variant="caption" tone="secondary" numeric>
          {`${pct}%`}
        </AppText>
      </View>
      <ProgressBar value={u.ratio} height={compact ? 6 : 8} accessibilityLabel={label} />
      <AppText variant="caption" tone="muted">
        {t('acct.limit.usedOf', { used: formatMoney(u.used, u.currency), limit: formatMoney(u.limit, u.currency) })}
      </AppText>
      {u.scope === 'group' && !compact && (
        <AppText variant="caption" tone="muted">
          {t('acct.limit.groupNote', { count: u.members ?? 0 })}
        </AppText>
      )}
      {!!u.skipped && (
        <AppText variant="caption" tone="warning">
          {t('acct.limit.skipped', { count: u.skipped })}
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1 },
});

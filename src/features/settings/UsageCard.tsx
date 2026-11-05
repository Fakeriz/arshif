import { Crown } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';

import { AppText, Badge, Button, Card, ProgressBar } from '@/components/ui';
import { useI18n } from '@/i18n';
import { isoDateLabel } from '@/lib/dates';
import { quotaFor, type QuotaKey, type Usage } from '@/lib/quota';
import type { Plan } from '@/data/types';
import { useStore } from '@/state/AppStore';
import { space } from '@/theme/tokens';

const KEYS: QuotaKey[] = ['scan', 'automation', 'importPdf', 'accounts'];

/** Pemakaian kuota bulan ini. Batas yang sudah penuh ditandai dan mengarah ke Premium. */
export function UsageCard({ plan, usage, accountCount }: { plan: Plan; usage: Usage; accountCount: number }) {
  const router = useRouter();
  const { t, lang } = useI18n();
  const { state } = useStore();
  const source =
    state.premiumSource === 'store'
      ? t('billing.settings.viaStore', { store: t(`billing.store.${Platform.OS === 'ios' ? 'ios' : 'android'}`) })
      : state.premiumSource === 'web'
        ? t('billing.settings.viaWeb')
        : state.premiumSource === 'manual'
          ? t('billing.settings.viaManual')
          : null;
  return (
    <Card>
      <View style={styles.head}>
        <AppText variant="h3" style={styles.flex}>
          {t('settings.usage.title')}
        </AppText>
        <Badge label={t(plan === 'free' ? 'settings.usage.planFree' : 'settings.usage.planPremium')} tone={plan === 'free' ? 'neutral' : 'accent'} />
      </View>
      {plan === 'premium' && (
        <View style={styles.premium}>
          {state.premiumUntil && (
            <AppText variant="body" tone="secondary">
              {t('billing.settings.until', { date: isoDateLabel(state.premiumUntil, lang) })}
            </AppText>
          )}
          {source && (
            <AppText variant="caption" tone="muted">
              {source}
            </AppText>
          )}
        </View>
      )}
      <View style={styles.list}>
        {KEYS.map((k) => {
          const limit = quotaFor(plan, k);
          const used = k === 'accounts' ? accountCount : usage[k];
          const full = limit !== null && used >= limit;
          const label = t(`domain.quota.${k}`);
          return (
            <View key={k} style={styles.item}>
              <View style={styles.row}>
                <AppText variant="bodyStrong" style={styles.flex}>
                  {label}
                </AppText>
                <AppText variant="caption" tone={full ? 'warning' : 'secondary'} numeric>
                  {limit === null ? t('settings.usage.unlimited', { used }) : `${used} / ${limit}`}
                </AppText>
              </View>
              {limit !== null && <ProgressBar value={used / limit} accessibilityLabel={t('settings.usage.a11y', { label, used, limit })} height={6} />}
            </View>
          );
        })}
      </View>
      <AppText variant="caption" tone="muted" style={styles.reset}>
        {t('settings.usage.reset')}
      </AppText>
      <Button
        label={plan === 'free' ? t('settings.usage.unlock') : t('billing.settings.manage')}
        icon={Crown}
        variant="secondary"
        size="md"
        fullWidth
        onPress={() => router.push(plan === 'free' ? { pathname: '/premium', params: { alasan: t('settings.usage.unlockReason') } } : '/premium')}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm },
  list: { gap: space.lg, marginVertical: space.lg },
  item: { gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  flex: { flex: 1 },
  reset: { marginBottom: space.lg },
  premium: { gap: space.xxs, marginTop: space.sm },
});

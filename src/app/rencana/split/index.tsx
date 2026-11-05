import { useRouter } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppText, Badge, Button, Card, EmptyState } from '@/components/ui';
import { PlanScreen } from '@/features/planning/kit';
import { useI18n } from '@/i18n';
import { shortDate } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { usePlanning } from '@/state/planning';
import { space } from '@/theme/tokens';

export default function SplitList() {
  const { t, lang } = useI18n();
  const router = useRouter();
  const { splits } = usePlanning();
  const create = () => router.push({ pathname: '/rencana/split/[id]', params: { id: 'baru' } });

  return (
    <PlanScreen title={t('plan.split.title')} right={splits.length ? <Button label={t('plan.split.create')} icon={Plus} size="sm" variant="secondary" onPress={create} /> : undefined}>
      {splits.length === 0 ? (
        <EmptyState title={t('plan.split.emptyTitle')} message={t('plan.split.emptyMessage')} actionLabel={t('plan.split.create')} onAction={create} />
      ) : (
        splits.map((s) => {
          const others = s.participants.filter((p) => !p.owner);
          const paid = others.filter((p) => p.paidAt).length;
          const done = others.length > 0 && paid === others.length;
          return (
            <Card key={s.id} onPress={() => router.push({ pathname: '/rencana/split/[id]', params: { id: s.id } })} accessibilityLabel={`${s.title}, ${formatMoney(s.total, s.currency)}, ${t('plan.split.paidCount', { paid, count: others.length })}`}>
              <View style={styles.head}>
                <AppText variant="bodyStrong" numberOfLines={1} style={styles.flex}>
                  {s.title}
                </AppText>
                <AppText variant="bodyStrong" numeric>
                  {formatMoney(s.total, s.currency)}
                </AppText>
              </View>
              <View style={styles.head}>
                <AppText variant="caption" tone="secondary" style={styles.flex}>
                  {`${shortDate(s.date, lang)} · ${t(`plan.split.modes.${s.mode}`)}`}
                </AppText>
                <Badge label={t('plan.split.paidCount', { paid, count: others.length })} tone={done ? 'positive' : 'warning'} />
              </View>
            </Card>
          );
        })
      )}
    </PlanScreen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.xxs },
  flex: { flex: 1, minWidth: 0 },
});

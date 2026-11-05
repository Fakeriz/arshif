import { StyleSheet, View } from 'react-native';

import { useT } from '@/i18n';
import { Card, ListItemSkeleton, Skeleton } from '@/components/ui';
import { radius, space } from '@/theme/tokens';

/** Kerangka dengan proporsi sama seperti Home, supaya tidak ada layar kosong saat memuat. */
export function HomeSkeleton() {
  const t = useT();
  return (
    <View style={styles.wrap} accessibilityLabel={t('common.loading')} aria-busy>
      <View style={styles.balance}>
        <Skeleton width={140} height={14} />
        <Skeleton width={260} height={44} />
        <Skeleton width={200} height={12} />
      </View>
      <Skeleton height={168} radius={radius.lg} width={280} />
      <Skeleton height={112} radius={radius.lg} />
      <Skeleton height={168} radius={radius.lg} />
      <Card padding="md">
        <ListItemSkeleton divider />
        <ListItemSkeleton divider />
        <ListItemSkeleton />
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.lg },
  balance: { alignItems: 'center', gap: space.sm, paddingVertical: space.lg },
});

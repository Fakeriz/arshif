import { View } from 'react-native';

import { Card, ListItemSkeleton, Skeleton } from '@/components/ui';
import { space } from '@/theme/tokens';

export function TransactionListSkeleton() {
  return (
    <View style={{ gap: space.lg }} accessibilityLabel="Memuat transaksi" aria-busy>
      {[4, 3].map((n, g) => (
        <View key={g} style={{ gap: space.sm }}>
          <Skeleton width={80} height={12} />
          <Card padding="md">
            {Array.from({ length: n }, (_, i) => (
              <ListItemSkeleton key={i} divider={i < n - 1} />
            ))}
          </Card>
        </View>
      ))}
    </View>
  );
}

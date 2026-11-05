import { StyleSheet, View } from 'react-native';

import { AppText, Card, CurrencyText } from '@/components/ui';
import type { ReceiptItem } from '@/data/types';
import { itemsTotal } from '@/lib/receipt';
import { formatMoney } from '@/lib/money';
import { space } from '@/theme/tokens';

export function ReceiptItems({ items, currency }: { items: ReceiptItem[]; currency: string }) {
  return (
    <Card>
      <AppText variant="h3">Item belanja</AppText>
      <View style={styles.list}>
        {items.map((it, i) => (
          <View key={`${it.name}-${i}`} style={styles.row}>
            <View style={styles.name}>
              <AppText variant="bodyStrong" numberOfLines={2}>
                {it.name}
              </AppText>
              <AppText variant="caption" tone="muted">
                {`${it.qty} × ${formatMoney(it.unitPrice, currency)}`}
              </AppText>
            </View>
            <CurrencyText amount={it.total} currency={currency} variant="bodyStrong" />
          </View>
        ))}
      </View>
      <View style={styles.total}>
        <AppText variant="caption" tone="secondary">
          Jumlah item
        </AppText>
        <CurrencyText amount={itemsTotal(items)} currency={currency} variant="bodyStrong" />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.md, marginTop: space.md },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  name: { flex: 1, minWidth: 0 },
  total: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space.lg },
});

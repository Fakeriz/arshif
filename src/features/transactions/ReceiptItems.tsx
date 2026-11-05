import { StyleSheet, View } from 'react-native';

import { useT } from '@/i18n';
import { AppText, Card, CurrencyText } from '@/components/ui';
import type { ReceiptDetails, ReceiptItem } from '@/data/types';
import { itemPaid, itemsTotal } from '@/lib/receipt';
import { formatMoney } from '@/lib/money';
import { space } from '@/theme/tokens';

import { ReceiptSummary } from './ReceiptSections';

/** Item struk: harga awal, diskon, dan harga bayar per item, lalu hitungan subtotal - diskon = total. */
export function ReceiptItems({ items, currency, receipt, total }: { items: ReceiptItem[]; currency: string; receipt?: ReceiptDetails; total: number }) {
  const t = useT();
  const money = (v: number) => formatMoney(v, currency);
  return (
    <Card>
      <AppText variant="h3">{t('tx.detail.receiptItems')}</AppText>
      <View style={styles.list}>
        {items.map((it, i) => {
          const discount = Math.min(it.discount ?? 0, it.total);
          const meta = [`${it.qty} × ${money(it.unitPrice)}`, it.taxRate !== undefined ? t('tx.receipt.taxRate', { rate: `${it.taxRate}%` }) : null].filter(Boolean).join(' · ');
          return (
            <View key={`${it.name}-${i}`} style={styles.item}>
              <View style={styles.row}>
                <View style={styles.name}>
                  <AppText variant="bodyStrong" numberOfLines={2}>
                    {it.name}
                  </AppText>
                  <AppText variant="caption" tone="muted">
                    {meta}
                  </AppText>
                </View>
                <CurrencyText amount={itemPaid(it)} currency={currency} variant="bodyStrong" />
              </View>
              {discount > 0 && (
                <AppText variant="caption" tone="secondary">
                  {t('tx.receipt.itemBreakdown', { original: money(it.total), discount: `−${money(discount)}` })}
                </AppText>
              )}
            </View>
          );
        })}
      </View>
      {receipt ? (
        <ReceiptSummary
          currency={currency}
          s={{
            subtotal: receipt.subtotal ?? itemsTotal(items),
            discount: receipt.discountTotal ?? 0,
            tax: receipt.taxTotal,
            taxIncluded: receipt.taxIncluded,
            service: receipt.service,
            total,
          }}
        />
      ) : (
        <View style={styles.total}>
          <AppText variant="caption" tone="secondary">
            {t('tx.detail.itemsTotal')}
          </AppText>
          <CurrencyText amount={items.reduce((s, it) => s + itemPaid(it), 0)} currency={currency} variant="bodyStrong" />
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.lg, marginTop: space.md },
  item: { gap: space.xxs },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  name: { flex: 1, minWidth: 0 },
  total: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space.lg },
});

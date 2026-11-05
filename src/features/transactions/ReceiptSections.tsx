import { ChevronDown, CircleCheck, TriangleAlert } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AmountField, AppText, Badge, Card, Icon } from '@/components/ui';
import type { ReceiptDetails, ReceiptDiscount, ReceiptItem } from '@/data/types';
import { useT } from '@/i18n';
import { formatMoney } from '@/lib/money';
import { itemPaid, itemsTotal, promoLabelFor, totalCheck } from '@/lib/receipt';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';

/**
 * Rincian struk untuk layar review scan dan detail transaksi. Tiap angka tampil sekali: diskon di baris item
 * dan baris Diskon, pajak hanya di baris Pajak (rincian per tarif dibuka bila perlu), detail toko dilipat.
 */

const minus = (v: string) => `−${v}`;
export const pctLabel = (rate: number) => `${Number.isInteger(rate) ? rate : rate.toFixed(2).replace(/\.?0+$/, '')}%`;

/** Baris yang bisa dibuka-tutup. Tertutup secara bawaan. */
function Expandable({ header, children, label }: { header: ReactNode; children: ReactNode; label: string }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((o) => !o)}
        hitSlop={{ top: 8, bottom: 8 }}
        style={({ pressed }) => [styles.expHeader, pressed && styles.pressed]}
      >
        <View style={styles.flex}>{header}</View>
        <View style={open ? styles.chevronOpen : undefined}>
          <Icon icon={ChevronDown} color={colors.textSecondary} size={16} />
        </View>
      </Pressable>
      {open && <View style={styles.expBody}>{children}</View>}
    </View>
  );
}

function Line({ label, value, tone, strong }: { label: string; value: string; tone?: 'positive'; strong?: boolean }) {
  return (
    <View style={styles.line}>
      <AppText variant="body" tone="secondary" style={styles.flex}>
        {label}
      </AppText>
      <AppText variant={strong ? 'bodyStrong' : 'body'} numeric tone={tone}>
        {value}
      </AppText>
    </View>
  );
}

type ItemRowProps = { item: ReceiptItem; promo?: string; currency: string; editing?: boolean; onPressPrice?: () => void; onChangeTotal?: (v: number) => void };

/** Satu item: nama + tarif pajak | harga bayar. Bila didiskon: nama promo | harga awal dicoret + badge diskon. */
function ItemRow({ item, promo, currency, editing, onPressPrice, onChangeTotal }: ItemRowProps) {
  const t = useT();
  const money = (v: number) => formatMoney(v, currency);
  const discount = Math.min(item.discount ?? 0, item.total);
  const price = (
    <View style={styles.price}>
      <AppText variant="bodyStrong" numeric>
        {money(itemPaid(item))}
      </AppText>
    </View>
  );
  return (
    <View style={styles.item}>
      <View style={styles.itemTop}>
        <View style={styles.nameWrap}>
          <AppText variant="body" numberOfLines={1} style={styles.name}>
            {item.qty !== 1 ? `${item.qty} × ${item.name}` : item.name}
          </AppText>
          {item.taxRate !== undefined && <Badge label={pctLabel(item.taxRate)} />}
        </View>
        {onPressPrice ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('tx.receipt.editPrice', { name: item.name, price: money(item.total) })}
            accessibilityState={{ expanded: !!editing }}
            onPress={onPressPrice}
            hitSlop={{ top: 10, bottom: 10, left: 12 }}
            style={({ pressed }) => pressed && styles.pressed}
          >
            {price}
          </Pressable>
        ) : (
          price
        )}
      </View>
      {discount > 0 && (
        <View style={styles.itemSub}>
          <AppText variant="caption" tone="muted" numberOfLines={1} style={styles.flex}>
            {promo ?? ''}
          </AppText>
          <AppText variant="caption" tone="muted" numeric style={styles.struck} accessibilityLabel={t('tx.receipt.originalPrice', { price: money(item.total) })}>
            {money(item.total)}
          </AppText>
          <Badge label={minus(money(discount))} tone="positive" />
        </View>
      )}
      {editing && onChangeTotal && (
        <AmountField
          label={t('tx.receipt.originalPriceLabel')}
          value={item.total}
          currency={currency}
          autoFocus
          onChange={(v) => onChangeTotal(v ?? 0)}
        />
      )}
    </View>
  );
}

export type ReceiptCardProps = {
  title: string;
  items: ReceiptItem[];
  currency: string;
  receipt?: ReceiptDetails;
  /** Total transaksi (field Total belanja / nominal di detail). Tidak ditampilkan ulang di sini. */
  total: number;
  /** Peringatan keyakinan OCR untuk daftar item. */
  warning?: string;
  /** Layar review: harga awal item bisa diubah dengan mengetuk harga. */
  onChangeItemTotal?: (index: number, total: number) => void;
};

/** Kartu item + blok Subtotal / Diskon / Pajak + status cocok (subtotal - diskon = total). */
export function ReceiptCard({ title, items, currency, receipt, total, warning, onChangeItemTotal }: ReceiptCardProps) {
  const t = useT();
  const { colors } = useTheme();
  const [editing, setEditing] = useState<number | null>(null);
  const money = (v: number) => formatMoney(v, currency);
  const discounts: ReceiptDiscount[] = receipt?.discounts ?? [];
  const subtotal = receipt?.subtotal ?? itemsTotal(items);
  const discount = receipt?.discountTotal ?? items.reduce((s, i) => s + Math.min(i.discount ?? 0, i.total), 0);
  const tax = receipt?.taxTotal;
  const added = receipt?.taxIncluded === false;
  const check = totalCheck({ subtotal, discount, tax, taxIncluded: receipt?.taxIncluded, service: receipt?.service, total });
  const showTotals = !!receipt || items.length > 0;

  return (
    <Card>
      <AppText variant="h3">{title}</AppText>
      {warning ? (
        <AppText variant="caption" tone="warning" style={styles.gapTop}>
          {warning}
        </AppText>
      ) : null}
      <View style={styles.items}>
        {items.map((it, i) => (
          <ItemRow
            key={`${it.name}-${i}`}
            item={it}
            promo={promoLabelFor(it, discounts)}
            currency={currency}
            editing={editing === i}
            onPressPrice={onChangeItemTotal ? () => setEditing((e) => (e === i ? null : i)) : undefined}
            onChangeTotal={onChangeItemTotal ? (v) => onChangeItemTotal(i, v) : undefined}
          />
        ))}
      </View>
      {showTotals && (
        <View style={[styles.totals, { borderTopColor: colors.border }]}>
          <Line label={t('tx.receipt.subtotal')} value={money(subtotal)} />
          {discount > 0 && <Line label={t('tx.receipt.discount')} value={minus(money(discount))} tone="positive" />}
          {tax !== undefined && tax > 0 &&
            (receipt && receipt.taxLines.length > 0 ? (
              <Expandable
                label={t(added ? 'tx.receipt.taxAddedRow' : 'tx.receipt.taxIncludedRow')}
                header={<Line label={t(added ? 'tx.receipt.taxAddedRow' : 'tx.receipt.taxIncludedRow')} value={money(tax)} />}
              >
                {receipt.taxLines.map((l, i) => (
                  <View key={`${l.rate}-${i}`} style={styles.line}>
                    <AppText variant="caption" tone="secondary" style={styles.flex}>
                      {l.gross !== undefined ? t('tx.receipt.taxLine', { rate: pctLabel(l.rate), gross: money(l.gross) }) : pctLabel(l.rate)}
                    </AppText>
                    <AppText variant="caption" numeric>
                      {money(l.tax)}
                    </AppText>
                  </View>
                ))}
              </Expandable>
            ) : (
              <Line label={t(added ? 'tx.receipt.taxAddedRow' : 'tx.receipt.taxIncludedRow')} value={money(tax)} />
            ))}
          {receipt?.service !== undefined && receipt.service > 0 && <Line label={t('tx.receipt.service')} value={money(receipt.service)} />}
          <View style={styles.status} accessibilityRole={check.ok ? undefined : 'alert'}>
            <Icon icon={check.ok ? CircleCheck : TriangleAlert} color={check.ok ? colors.positive : colors.warning} size={14} />
            <AppText variant="caption" tone={check.ok ? 'secondary' : 'warning'} style={styles.flex}>
              {check.ok ? t('tx.receipt.matchOk') : t('tx.receipt.matchOff', { diff: money(Math.abs(check.diff)) })}
            </AppText>
          </View>
        </View>
      )}
    </Card>
  );
}

/** Lokasi (alamat), nomor pajak toko, nomor struk, metode bayar. Nama toko tidak diulang. Tertutup secara bawaan. */
export function ReceiptDetailsCard({ receipt }: { receipt: Pick<ReceiptDetails, 'storeAddress' | 'storeTaxId' | 'receiptNo' | 'paymentMethod'> }) {
  const t = useT();
  const rows = (
    [
      [t('tx.receipt.location'), receipt.storeAddress],
      [t('tx.receipt.taxId'), receipt.storeTaxId],
      [t('tx.receipt.receiptNo'), receipt.receiptNo],
      [t('tx.receipt.paymentMethod'), receipt.paymentMethod],
    ] as const
  ).filter((r): r is readonly [string, string] => !!r[1]);
  if (rows.length === 0) return null;
  return (
    <Card padding="md">
      <Expandable label={t('tx.receipt.store')} header={<AppText variant="bodyStrong">{t('tx.receipt.store')}</AppText>}>
        <View style={styles.details}>
          {rows.map(([label, value]) => (
            <View key={label} style={styles.detail}>
              <AppText variant="caption" tone="secondary">
                {label}
              </AppText>
              <AppText variant="body" selectable>
                {value}
              </AppText>
            </View>
          ))}
        </View>
      </Expandable>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.6 },
  gapTop: { marginTop: space.xs },
  items: { gap: space.md, marginTop: space.md },
  item: { gap: space.xxs },
  itemTop: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  nameWrap: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  name: { flexShrink: 1 },
  price: { minHeight: 32, justifyContent: 'center' },
  itemSub: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  struck: { textDecorationLine: 'line-through' },
  totals: { marginTop: space.md, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth, gap: space.xs },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 28 },
  expHeader: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 32 },
  chevronOpen: { transform: [{ rotate: '180deg' }] },
  expBody: { gap: space.xxs, paddingBottom: space.xs },
  status: { flexDirection: 'row', alignItems: 'center', gap: space.xs, marginTop: space.xs },
  details: { gap: space.md, marginTop: space.sm },
  detail: { gap: space.xxs },
});

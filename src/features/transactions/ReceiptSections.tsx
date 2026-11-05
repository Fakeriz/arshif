import { CircleCheck, TriangleAlert } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Card, Icon } from '@/components/ui';
import type { ReceiptDetails, ReceiptDiscount, ReceiptItem } from '@/data/types';
import { useT } from '@/i18n';
import { formatMoney } from '@/lib/money';
import { totalCheck } from '@/lib/receipt';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

/** Bagian rincian struk (diskon, pajak, hitungan total, detail toko). Dipakai layar review scan dan detail transaksi. */

const minus = (v: string) => `−${v}`;
const pctLabel = (rate: number) => `${Number.isInteger(rate) ? rate : rate.toFixed(2).replace(/0+$/, '')}%`;

export function Row({ label, sub, value, strong, tone }: { label: string; sub?: string; value: string; strong?: boolean; tone?: 'positive' }) {
  return (
    <View style={styles.row}>
      <View style={styles.flex}>
        <AppText variant={strong ? 'bodyStrong' : 'body'} tone={strong ? undefined : 'secondary'}>
          {label}
        </AppText>
        {sub ? (
          <AppText variant="caption" tone="muted">
            {sub}
          </AppText>
        ) : null}
      </View>
      <AppText variant="bodyStrong" numeric tone={tone}>
        {value}
      </AppText>
    </View>
  );
}

function Divided({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return <View style={[styles.divider, { borderTopColor: colors.border }]}>{children}</View>;
}

type Summary = { subtotal: number; discount: number; tax?: number; taxIncluded?: boolean; service?: number; total: number };

/** Subtotal, diskon, pajak, total + pemeriksaan rumus subtotal - diskon = total (kuning bila tidak cocok). */
export function ReceiptSummary({ s, currency }: { s: Summary; currency: string }) {
  const t = useT();
  const { colors } = useTheme();
  const money = (v: number) => formatMoney(v, currency);
  const check = totalCheck(s);
  return (
    <View style={styles.summary}>
      <Row label={t('tx.receipt.subtotal')} value={money(s.subtotal)} />
      {s.discount > 0 && <Row label={t('tx.receipt.discount')} value={minus(money(s.discount))} tone="positive" />}
      {s.tax !== undefined && s.tax > 0 && (
        <Row label={t('tx.receipt.tax')} sub={s.taxIncluded === false ? t('tx.receipt.taxAdded') : t('tx.receipt.taxIncluded')} value={s.taxIncluded === false ? money(s.tax) : `(${money(s.tax)})`} />
      )}
      {s.service !== undefined && s.service > 0 && <Row label={t('tx.receipt.service')} value={money(s.service)} />}
      <Row label={t('tx.receipt.total')} value={money(s.total)} strong />
      {check.ok ? (
        <View style={[styles.note, { backgroundColor: colors.positiveSoft }]}>
          <Icon icon={CircleCheck} color={colors.positive} />
          <AppText variant="caption" style={styles.flex}>
            {t('tx.receipt.formulaOk', { total: money(s.total) })}
          </AppText>
        </View>
      ) : (
        <View style={[styles.note, { backgroundColor: colors.warningSoft }]} accessibilityRole="alert">
          <Icon icon={TriangleAlert} color={colors.warning} />
          <AppText variant="caption" style={styles.flex}>
            {t('tx.receipt.formulaMismatch', { expected: money(check.expected), total: money(s.total), diff: money(Math.abs(check.diff)) })}
          </AppText>
        </View>
      )}
    </View>
  );
}

/** Diskon per item (nominal negatif) + total hemat. */
export function DiscountsCard({ discounts, currency }: { discounts: ReceiptDiscount[]; currency: string }) {
  const t = useT();
  const money = (v: number) => formatMoney(v, currency);
  if (discounts.length === 0) return null;
  const total = discounts.reduce((sum, d) => sum + d.amount, 0);
  return (
    <Card>
      <AppText variant="h3">{t('tx.receipt.discounts')}</AppText>
      <View style={styles.list}>
        {discounts.map((d, i) => (
          <Row
            key={`${d.itemName ?? ''}-${i}`}
            label={d.itemName ?? t('tx.receipt.wholeReceipt')}
            sub={[d.label, d.taxRate !== undefined ? t('tx.receipt.taxRate', { rate: pctLabel(d.taxRate) }) : null].filter(Boolean).join(' · ') || undefined}
            value={minus(money(d.amount))}
            tone="positive"
          />
        ))}
      </View>
      <Divided>
        <Row label={t('tx.receipt.savings')} value={money(total)} strong tone="positive" />
      </Divided>
    </Card>
  );
}

/** Pajak: tarif per item, rincian per tarif, total pajak. */
export function TaxCard({ receipt, items, currency }: { receipt: Pick<ReceiptDetails, 'taxTotal' | 'taxIncluded' | 'taxLines'>; items: ReceiptItem[]; currency: string }) {
  const t = useT();
  const money = (v: number) => formatMoney(v, currency);
  const rated = items.filter((i) => i.taxRate !== undefined);
  if (receipt.taxTotal === undefined && receipt.taxLines.length === 0 && rated.length === 0) return null;
  return (
    <Card>
      <AppText variant="h3">{t('tx.receipt.tax')}</AppText>
      <AppText variant="caption" tone="muted" style={styles.gapTop}>
        {receipt.taxIncluded === false ? t('tx.receipt.taxAdded') : t('tx.receipt.taxIncluded')}
      </AppText>
      {rated.length > 0 && (
        <View style={styles.list}>
          <AppText variant="caption" tone="secondary">
            {t('tx.receipt.taxPerItem')}
          </AppText>
          {rated.map((it, i) => (
            <Row key={`${it.name}-${i}`} label={it.name} value={pctLabel(it.taxRate!)} />
          ))}
        </View>
      )}
      {receipt.taxLines.length > 0 && (
        <View style={styles.list}>
          <AppText variant="caption" tone="secondary">
            {t('tx.receipt.taxPerRate')}
          </AppText>
          {receipt.taxLines.map((l, i) => (
            <Row
              key={`${l.rate}-${i}`}
              label={t('tx.receipt.taxRate', { rate: pctLabel(l.rate) })}
              sub={l.gross !== undefined ? t('tx.receipt.taxBase', { gross: money(l.gross) }) : undefined}
              value={money(l.tax)}
            />
          ))}
        </View>
      )}
      {receipt.taxTotal !== undefined && (
        <Divided>
          <Row label={t('tx.receipt.taxTotal')} value={money(receipt.taxTotal)} strong />
        </Divided>
      )}
    </Card>
  );
}

/** Lokasi toko, NPWP/nomor pajak, nomor struk, metode bayar. */
export function StoreCard({ merchant, receipt }: { merchant: string; receipt: Pick<ReceiptDetails, 'storeAddress' | 'storeTaxId' | 'receiptNo' | 'paymentMethod'> }) {
  const t = useT();
  const rows = [
    [t('tx.receipt.location'), [merchant, receipt.storeAddress].filter(Boolean).join('\n')],
    [t('tx.receipt.taxId'), receipt.storeTaxId],
    [t('tx.receipt.receiptNo'), receipt.receiptNo],
    [t('tx.receipt.paymentMethod'), receipt.paymentMethod],
  ].filter((r): r is [string, string] => !!r[1]);
  if (!receipt.storeAddress && rows.length <= 1) return null;
  return (
    <Card>
      <AppText variant="h3">{t('tx.receipt.store')}</AppText>
      <View style={styles.list}>
        {rows.map(([label, value]) => (
          <View key={label} style={styles.stack}>
            <AppText variant="caption" tone="secondary">
              {label}
            </AppText>
            <AppText variant="body" selectable>
              {value}
            </AppText>
          </View>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: space.md },
  list: { gap: space.md, marginTop: space.md },
  summary: { gap: space.sm, marginTop: space.lg },
  gapTop: { marginTop: space.xs },
  stack: { gap: space.xxs },
  divider: { marginTop: space.md, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth },
  note: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start', padding: space.md, borderRadius: radius.md, marginTop: space.xs },
});

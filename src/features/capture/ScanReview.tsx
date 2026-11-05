import { RotateCcw, TriangleAlert } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useT } from '@/i18n';
import { AmountField, AppText, Button, Card, Icon, Input } from '@/components/ui';
import type { ReceiptDetails, ReceiptItem, Transaction } from '@/data/types';
import { formatMoney } from '@/lib/money';
import { discountsTotal, isLowConfidence, itemPaid, itemsTotal, subtotalMismatch, totalCheck } from '@/lib/receipt';
import { newId } from '@/lib/uuid';
import { useActiveAccountId, type AccountWithBalance } from '@/state/AppStore';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

import type { ScanResult } from '../../../supabase/functions/_shared/contracts';
import { AccountPicker, CategoryPicker } from '../transactions/pickers';
import { DiscountsCard, ReceiptSummary, StoreCard, TaxCard } from '../transactions/ReceiptSections';
import { localHm, localYmd } from './clock';

const pct = (c: number) => `${Math.round(c * 100)}%`;
const YMD = /^\d{4}-\d{2}-\d{2}$/;

type Props = {
  result: ScanResult;
  receiptPath: string;
  accounts: AccountWithBalance[];
  /** Baca ulang struk transaksi yang sudah ada: akun, sumber, dan catatannya dipertahankan. */
  existing?: Transaction;
  onSave: (tx: Transaction) => void;
  onRetake: () => void;
};

const opt = <T,>(v: T | null): T | undefined => (v === null ? undefined : v);

/** Rincian struk dari hasil scan untuk disimpan di transaksi. */
export function receiptFromScan(r: ScanResult): ReceiptDetails {
  return {
    subtotal: opt(r.subtotal),
    discountTotal: opt(r.discount) ?? (r.discounts.length ? discountsTotal(r.discounts) : undefined),
    taxTotal: opt(r.tax),
    taxIncluded: r.taxIncluded,
    service: opt(r.service),
    discounts: r.discounts.map((d) => ({ amount: d.amount, label: opt(d.label), itemName: opt(d.itemName), taxRate: opt(d.taxRate) })),
    taxLines: r.taxLines.map((l) => ({ rate: l.rate, tax: l.tax, gross: opt(l.gross) })),
    receiptNo: opt(r.receiptNo),
    paymentMethod: opt(r.paymentMethod),
    storeAddress: opt(r.storeAddress),
    storeTaxId: opt(r.storeTaxId),
  };
}

/**
 * Layar review struk (FR-OCR-3): keyakinan < 70% ditandai kuning, selisih item vs subtotal diperingatkan,
 * dan hitungan subtotal - diskon = total ditandai kuning bila tidak cocok.
 */
export function ScanReview({ result: r, receiptPath, accounts, existing, onSave, onRetake }: Props) {
  const { colors } = useTheme();
  const t = useT();
  const conf = (c: number) => (isLowConfidence(c) ? t('capture.confidence', { pct: pct(c) }) : undefined);
  const [merchant, setMerchant] = useState(r.merchant);
  const [date, setDate] = useState(r.date ?? localYmd());
  const [total, setTotal] = useState<number | null>(r.total);
  const [category, setCategory] = useState<string | null>(r.categoryKey);
  const activeId = useActiveAccountId();
  const [accountId, setAccountId] = useState<string | null>(existing?.accountId ?? activeId ?? accounts[0]?.id ?? null);
  const [items, setItems] = useState<ReceiptItem[]>(
    r.items.map((i) => ({ name: i.name, qty: i.qty, unitPrice: i.unitPrice, total: i.total, discount: i.discount || undefined, taxRate: opt(i.taxRate) })),
  );
  const [receipt] = useState(() => receiptFromScan(r));
  const [tried, setTried] = useState(false);

  const mismatch = r.subtotal !== null && items.length > 0 ? subtotalMismatch(items, r.subtotal) : { mismatch: false, diff: 0 };
  const errors = {
    merchant: tried && !merchant.trim() ? t('capture.scanReview.merchantError') : undefined,
    date: tried && !YMD.test(date) ? t('capture.scanReview.dateError') : undefined,
    total: tried && (!total || total <= 0) ? t('capture.scanReview.totalError') : undefined,
  };
  const money = (v: number) => formatMoney(v, r.currency);
  const formula = totalCheck({ subtotal: r.subtotal ?? itemsTotal(items), discount: receipt.discountTotal ?? 0, tax: receipt.taxTotal, taxIncluded: receipt.taxIncluded, service: receipt.service, total: total ?? 0 });
  const hasBreakdown = r.subtotal !== null || items.length > 0;

  const save = () => {
    setTried(true);
    if (!merchant.trim() || !YMD.test(date) || !total || total <= 0 || !accountId || !category) return;
    onSave({
      id: existing?.id ?? newId(),
      type: 'expense',
      merchant: merchant.trim(),
      categoryKey: category,
      accountId,
      date,
      time: r.time ?? existing?.time ?? localHm(),
      amount: total,
      currency: r.currency,
      note: existing?.note,
      source: existing?.source ?? 'scan',
      receiptPath,
      items: items.length ? items : undefined,
      receipt,
    });
  };

  return (
    <View style={styles.wrap}>
      <AppText variant="body" tone="secondary" style={styles.intro}>
        {t('capture.scanReview.intro')}
      </AppText>
      <Input label={t('capture.scanReview.merchant')} value={merchant} onChangeText={setMerchant} error={errors.merchant} warning={conf(r.confidence.merchant)} />
      <Input label={t('capture.scanReview.date')} value={date} onChangeText={setDate} error={errors.date} warning={r.date ? conf(r.confidence.date) : conf(0)} />
      <AmountField label={t('capture.scanReview.total', { currency: r.currency })} value={total} onChange={setTotal} currency={r.currency} error={errors.total} warning={hasBreakdown && total && !formula.ok ? t('tx.receipt.totalWarning') : conf(r.confidence.total)} />
      <CategoryPicker type="expense" scroll value={category} onChange={setCategory} />
      <AccountPicker label={t('capture.scanReview.paidFrom')} accounts={accounts} value={accountId} onChange={setAccountId} />

      {(items.length > 0 || r.subtotal !== null) && (
        <Card>
          <AppText variant="h3">{t('capture.scanReview.items')}</AppText>
          {items.length > 0 && conf(r.confidence.items) && (
            <AppText variant="caption" tone="warning" style={styles.gapTop}>
              {conf(r.confidence.items)}
            </AppText>
          )}
          {mismatch.mismatch && r.subtotal !== null && (
            <View style={[styles.warn, { backgroundColor: colors.warningSoft }]} accessibilityRole="alert">
              <Icon icon={TriangleAlert} color={colors.warning} />
              <AppText variant="caption" style={styles.flex}>
                {t('capture.scanReview.mismatch', { items: money(itemsTotal(items)), diff: money(Math.abs(mismatch.diff)), subtotal: money(r.subtotal) })}
              </AppText>
            </View>
          )}
          <View style={styles.items}>
            {items.map((it, i) => (
              <View key={`${it.name}-${i}`} style={styles.item}>
                <AppText variant="bodyStrong">{it.name}</AppText>
                <AmountField
                  label={[`${it.qty} × ${money(it.unitPrice)}`, it.taxRate !== undefined ? t('tx.receipt.taxRate', { rate: `${it.taxRate}%` }) : null].filter(Boolean).join(' · ')}
                  value={it.total}
                  currency={r.currency}
                  onChange={(v) => setItems((list) => list.map((x, j) => (j === i ? { ...x, total: v ?? 0 } : x)))}
                />
                {(it.discount ?? 0) > 0 && (
                  <AppText variant="caption" tone="secondary">
                    {`${t('tx.receipt.itemBreakdown', { original: money(it.total), discount: `\u2212${money(Math.min(it.discount ?? 0, it.total))}` })} · ${t('tx.receipt.paidLabel', { paid: money(itemPaid(it)) })}`}
                  </AppText>
                )}
              </View>
            ))}
          </View>
          <ReceiptSummary
            currency={r.currency}
            s={{
              subtotal: r.subtotal ?? itemsTotal(items),
              discount: receipt.discountTotal ?? 0,
              tax: receipt.taxTotal,
              taxIncluded: receipt.taxIncluded,
              service: receipt.service,
              total: total ?? 0,
            }}
          />
        </Card>
      )}
      <DiscountsCard discounts={receipt.discounts} currency={r.currency} />
      <TaxCard receipt={receipt} items={items} currency={r.currency} />
      <StoreCard merchant={merchant} receipt={receipt} />

      <View style={styles.actions}>
        <Button label={t('capture.scanReview.save')} fullWidth onPress={save} />
        <Button label={existing ? t('common.back') : t('capture.scan.retake')} icon={existing ? undefined : RotateCcw} variant="secondary" fullWidth onPress={onRetake} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xl },
  intro: { marginTop: -space.sm },
  flex: { flex: 1 },
  gapTop: { marginTop: space.xs },
  warn: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start', padding: space.md, borderRadius: radius.md, marginTop: space.md },
  items: { gap: space.lg, marginTop: space.lg },
  item: { gap: space.xs },
  actions: { gap: space.sm },
});

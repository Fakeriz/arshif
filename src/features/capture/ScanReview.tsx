import { RotateCcw, TriangleAlert } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useT } from '@/i18n';
import { AmountField, AppText, Button, Card, Icon, Input } from '@/components/ui';
import type { ReceiptItem, Transaction } from '@/data/types';
import { formatMoney } from '@/lib/money';
import { isLowConfidence, itemsTotal, subtotalMismatch } from '@/lib/receipt';
import { newId } from '@/lib/uuid';
import { useActiveAccountId, type AccountWithBalance } from '@/state/AppStore';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

import type { ScanResult } from '../../../supabase/functions/_shared/contracts';
import { AccountPicker, CategoryPicker } from '../transactions/pickers';
import { localHm, localYmd } from './clock';

const pct = (c: number) => `${Math.round(c * 100)}%`;
const YMD = /^\d{4}-\d{2}-\d{2}$/;

type Props = { result: ScanResult; receiptPath: string; accounts: AccountWithBalance[]; onSave: (tx: Transaction) => void; onRetake: () => void };

/** Layar review struk (FR-OCR-3): keyakinan < 70% ditandai kuning, selisih item vs subtotal diperingatkan. */
export function ScanReview({ result: r, receiptPath, accounts, onSave, onRetake }: Props) {
  const { colors } = useTheme();
  const t = useT();
  const conf = (c: number) => (isLowConfidence(c) ? t('capture.confidence', { pct: pct(c) }) : undefined);
  const [merchant, setMerchant] = useState(r.merchant);
  const [date, setDate] = useState(r.date ?? localYmd());
  const [total, setTotal] = useState<number | null>(r.total);
  const [category, setCategory] = useState<string | null>(r.categoryKey);
  const activeId = useActiveAccountId();
  const [accountId, setAccountId] = useState<string | null>(activeId ?? accounts[0]?.id ?? null);
  const [items, setItems] = useState<ReceiptItem[]>(r.items.map((i) => ({ name: i.name, qty: i.qty, unitPrice: i.unitPrice, total: i.total })));
  const [tried, setTried] = useState(false);

  const mismatch = r.subtotal !== null && items.length > 0 ? subtotalMismatch(items, r.subtotal) : { mismatch: false, diff: 0 };
  const errors = {
    merchant: tried && !merchant.trim() ? t('capture.scanReview.merchantError') : undefined,
    date: tried && !YMD.test(date) ? t('capture.scanReview.dateError') : undefined,
    total: tried && (!total || total <= 0) ? t('capture.scanReview.totalError') : undefined,
  };
  const money = (v: number) => formatMoney(v, r.currency);
  const extras = ([['tax', r.tax], ['service', r.service], ['discount', r.discount]] as const).filter(([, v]) => v !== null && v > 0);

  const save = () => {
    setTried(true);
    if (!merchant.trim() || !YMD.test(date) || !total || total <= 0 || !accountId || !category) return;
    onSave({ id: newId(), type: 'expense', merchant: merchant.trim(), categoryKey: category, accountId, date, time: r.time ?? localHm(), amount: total, currency: r.currency, source: 'scan', receiptPath, items: items.length ? items : undefined });
  };

  return (
    <View style={styles.wrap}>
      <AppText variant="body" tone="secondary" style={styles.intro}>
        {t('capture.scanReview.intro')}
      </AppText>
      <Input label={t('capture.scanReview.merchant')} value={merchant} onChangeText={setMerchant} error={errors.merchant} warning={conf(r.confidence.merchant)} />
      <Input label={t('capture.scanReview.date')} value={date} onChangeText={setDate} error={errors.date} warning={r.date ? conf(r.confidence.date) : conf(0)} />
      <AmountField label={t('capture.scanReview.total', { currency: r.currency })} value={total} onChange={setTotal} currency={r.currency} error={errors.total} warning={conf(r.confidence.total)} />
      <CategoryPicker type="expense" scroll value={category} onChange={setCategory} />
      <AccountPicker label={t('capture.scanReview.paidFrom')} accounts={accounts} value={accountId} onChange={setAccountId} />

      {(items.length > 0 || r.subtotal !== null || extras.length > 0) && (
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
                <AmountField label={`${it.qty} × ${money(it.unitPrice)}`} value={it.total} currency={r.currency} onChange={(v) => setItems((list) => list.map((x, j) => (j === i ? { ...x, total: v ?? 0 } : x)))} />
              </View>
            ))}
          </View>
          {r.subtotal !== null && <Row label={t('capture.scanReview.subtotal')} value={money(r.subtotal)} />}
          {extras.map(([k, v]) => (
            <Row key={k} label={t(`capture.scanReview.${k}`)} value={k === 'discount' ? `−${money(v as number)}` : money(v as number)} />
          ))}
        </Card>
      )}

      <View style={styles.actions}>
        <Button label={t('capture.scanReview.save')} fullWidth onPress={save} />
        <Button label={t('capture.scan.retake')} icon={RotateCcw} variant="secondary" fullWidth onPress={onRetake} />
      </View>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.sub}>
      <AppText variant="caption" tone="secondary" style={styles.flex}>
        {label}
      </AppText>
      <AppText variant="bodyStrong" numeric>
        {value}
      </AppText>
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
  sub: { flexDirection: 'row', justifyContent: 'space-between', gap: space.md, marginTop: space.lg },
  actions: { gap: space.sm },
});

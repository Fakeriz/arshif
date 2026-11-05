import { RotateCcw, TriangleAlert } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useT } from '@/i18n';
import { AmountField, AppText, Button, Card, Icon, Input } from '@/components/ui';
import { sampleScan } from '@/data/seed';
import type { ReceiptItem, Transaction } from '@/data/types';
import { formatMoney } from '@/lib/money';
import { isLowConfidence, itemsTotal, subtotalMismatch } from '@/lib/receipt';
import type { AccountWithBalance } from '@/state/AppStore';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

import { AccountPicker, CategoryPicker } from '../transactions/pickers';

const pct = (c: number) => `${Math.round(c * 100)}%`;

/** Layar review struk (FR-OCR-3): keyakinan < 70% ditandai kuning, selisih item vs subtotal diperingatkan. */
export function ScanReview({ accounts, onSave, onRetake }: { accounts: AccountWithBalance[]; onSave: (tx: Transaction) => void; onRetake: () => void }) {
  const { colors } = useTheme();
  const t = useT();
  const s = sampleScan;
  const conf = (c: number) => (isLowConfidence(c) ? t('capture.confidence', { pct: pct(c) }) : undefined);
  const [merchant, setMerchant] = useState(s.merchant.value);
  const [date, setDate] = useState(s.date.value);
  const [total, setTotal] = useState<number | null>(s.total.value);
  const [category, setCategory] = useState<string | null>(s.category.value);
  const [accountId, setAccountId] = useState<string | null>(accounts[0]?.id ?? null);
  const [items, setItems] = useState<ReceiptItem[]>(s.items);
  const [tried, setTried] = useState(false);

  const mismatch = subtotalMismatch(items, s.subtotal);
  const errors = {
    merchant: tried && !merchant.trim() ? t('capture.scanReview.merchantError') : undefined,
    total: tried && (!total || total <= 0) ? t('capture.scanReview.totalError') : undefined,
  };

  const save = () => {
    setTried(true);
    if (!merchant.trim() || !total || total <= 0 || !accountId || !category) return;
    onSave({ id: `n-${Date.now().toString(36)}`, type: 'expense', merchant: merchant.trim(), categoryKey: category, accountId, date, time: s.time, amount: total, currency: s.currency, source: 'scan', items });
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.intro}>
        <AppText variant="body" tone="secondary">
          {t('capture.scanReview.intro')}
        </AppText>
      </View>
      <Input label={t('capture.scanReview.merchant')} value={merchant} onChangeText={setMerchant} error={errors.merchant} warning={conf(s.merchant.conf)} />
      <Input label={t('capture.scanReview.date')} value={date} onChangeText={setDate} warning={conf(s.date.conf)} />
      <AmountField label={t('capture.scanReview.total', { currency: s.currency })} value={total} onChange={setTotal} currency={s.currency} error={errors.total} warning={conf(s.total.conf)} />
      <CategoryPicker type="expense" scroll value={category} onChange={setCategory} warning={isLowConfidence(s.category.conf) ? t('capture.scanReview.categoryWarning', { pct: pct(s.category.conf) }) : undefined} />
      <AccountPicker label={t('capture.scanReview.paidFrom')} accounts={accounts} value={accountId} onChange={setAccountId} />

      <Card>
        <AppText variant="h3">{t('capture.scanReview.items')}</AppText>
        {mismatch.mismatch && (
          <View style={[styles.warn, { backgroundColor: colors.warningSoft }]} accessibilityRole="alert">
            <Icon icon={TriangleAlert} color={colors.warning} />
            <AppText variant="caption" style={styles.flex}>
              {t('capture.scanReview.mismatch', { items: formatMoney(itemsTotal(items), s.currency), diff: formatMoney(Math.abs(mismatch.diff), s.currency), subtotal: formatMoney(s.subtotal, s.currency) })}
            </AppText>
          </View>
        )}
        <View style={styles.items}>
          {items.map((it, i) => (
            <View key={`${it.name}-${i}`} style={styles.item}>
              <AppText variant="bodyStrong">{it.name}</AppText>
              <AmountField label={`${it.qty} × ${formatMoney(it.unitPrice, s.currency)}`} value={it.total} currency={s.currency} onChange={(v) => setItems((list) => list.map((x, j) => (j === i ? { ...x, total: v ?? 0 } : x)))} />
            </View>
          ))}
        </View>
        <View style={styles.sub}>
          <AppText variant="caption" tone="secondary" style={styles.flex}>
            {t('capture.scanReview.subtotal')}
          </AppText>
          <AppText variant="bodyStrong" numeric>
            {formatMoney(s.subtotal, s.currency)}
          </AppText>
        </View>
      </Card>

      <View style={styles.actions}>
        <Button label={t('capture.scanReview.save')} fullWidth onPress={save} />
        <Button label={t('capture.scan.retake')} icon={RotateCcw} variant="secondary" fullWidth onPress={onRetake} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xl },
  intro: { marginTop: -space.sm },
  flex: { flex: 1 },
  warn: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start', padding: space.md, borderRadius: radius.md, marginTop: space.md },
  items: { gap: space.lg, marginTop: space.lg },
  item: { gap: space.xs },
  sub: { flexDirection: 'row', justifyContent: 'space-between', gap: space.md, marginTop: space.lg },
  actions: { gap: space.sm },
});

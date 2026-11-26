import { RotateCcw } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useT } from '@/i18n';
import { AmountField, AppText, Button, DateField, Input, useSaveThen } from '@/components/ui';
import type { ReceiptDetails, ReceiptItem, Transaction, TxPlace } from '@/data/types';
import { PlaceField, type PlaceGuess } from '@/features/places/PlaceField';
import { tryConvert } from '@/lib/fx';
import { formatMoney } from '@/lib/money';
import { discountsTotal, isLowConfidence, itemsTotal, subtotalMismatch, totalCheck } from '@/lib/receipt';
import { newId } from '@/lib/uuid';
import { useActiveAccountId, type AccountWithBalance } from '@/state/AppStore';
import { space } from '@/theme/tokens';
import { isYmd, todayYmd } from '@/lib/dates';

import type { ScanResult } from '../../../supabase/functions/_shared/contracts';
import { AccountPicker, CategoryPicker } from '../transactions/pickers';
import { ReceiptCard, ReceiptDetailsCard } from '../transactions/ReceiptSections';
import { localHm } from './clock';

const pct = (c: number) => `${Math.round(c * 100)}%`;

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
  const t = useT();
  const conf = (c: number) => (isLowConfidence(c) ? t('capture.confidence', { pct: pct(c) }) : undefined);
  const saving = useSaveThen();
  const [merchant, setMerchant] = useState(r.merchant);
  const [date, setDate] = useState(r.date ?? todayYmd());
  const [total, setTotal] = useState<number | null>(r.total);
  const [category, setCategory] = useState<string | null>(r.categoryKey);
  const activeId = useActiveAccountId();
  const [accountId, setAccountId] = useState<string | null>(existing?.accountId ?? activeId ?? accounts[0]?.id ?? null);
  useEffect(() => {
    if (!accountId && accounts[0]) setAccountId(existing?.accountId ?? activeId ?? accounts[0].id);
  }, [accountId, accounts, activeId, existing?.accountId]);
  const [items, setItems] = useState<ReceiptItem[]>(
    r.items.map((i) => ({ name: i.name, qty: i.qty, unitPrice: i.unitPrice, total: i.total, discount: i.discount || undefined, taxRate: opt(i.taxRate) })),
  );
  const [receipt] = useState(() => receiptFromScan(r));
  const [tried, setTried] = useState(false);
  const [place, setPlace] = useState<TxPlace | null>(existing?.place ?? null);
  // Tebakan sekali dari nama + alamat cabang di struk; transaksi yang sudah punya lokasi tidak ditebak ulang.
  const [guess] = useState<PlaceGuess | undefined>(() => (existing?.place || !r.merchant.trim() ? undefined : { query: [r.merchant, r.storeAddress].filter(Boolean).join(', '), from: 'scan' }));

  const mismatch = r.subtotal !== null && items.length > 0 ? subtotalMismatch(items, r.subtotal) : { mismatch: false, diff: 0 };
  const errors = {
    merchant: tried && !merchant.trim() ? t('capture.scanReview.merchantError') : undefined,
    date: tried && !isYmd(date) ? t('capture.scanReview.dateError') : undefined,
    total: tried && (!total || total <= 0) ? t('capture.scanReview.totalError') : undefined,
  };
  const money = (v: number) => formatMoney(v, r.currency);
  const formula = totalCheck({ subtotal: r.subtotal ?? itemsTotal(items), discount: receipt.discountTotal ?? 0, tax: receipt.taxTotal, taxIncluded: receipt.taxIncluded, service: receipt.service, total: total ?? 0 });
  const hasBreakdown = r.subtotal !== null || items.length > 0;

  const save = () => {
    setTried(true);
    if (!merchant.trim() || !isYmd(date) || !total || total <= 0 || !accountId || !category) return;
    const acc = accounts.find((a) => a.id === accountId);
    const accountAmount = acc && acc.currency !== r.currency ? (tryConvert(total, r.currency, acc.currency) ?? undefined) : undefined;
    saving.run(() =>
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
        accountAmount,
        note: existing?.note,
        source: existing?.source ?? 'scan',
        receiptPath,
        items: items.length ? items : undefined,
        receipt,
        place: place ?? undefined,
        reimburseStatus: existing?.reimburseStatus,
        reimbursedBy: existing?.reimbursedBy,
      }),
    );
  };

  return (
    <View style={styles.wrap}>
      <AppText variant="body" tone="secondary" style={styles.intro}>
        {t('capture.scanReview.intro')}
      </AppText>
      <Input label={t('capture.scanReview.merchant')} value={merchant} onChangeText={setMerchant} error={errors.merchant} warning={conf(r.confidence.merchant)} />
      <DateField label={t('capture.scanReview.date')} value={date} onChange={setDate} error={errors.date} warning={r.date ? conf(r.confidence.date) : conf(0)} />
      <AmountField label={t('capture.scanReview.total', { currency: r.currency })} value={total} onChange={setTotal} currency={r.currency} error={errors.total} warning={hasBreakdown && total && !formula.ok ? t('tx.receipt.totalWarning') : conf(r.confidence.total)} />
      <CategoryPicker type="expense" value={category} onChange={setCategory} />
      <AccountPicker label={t('capture.scanReview.paidFrom')} accounts={accounts} value={accountId} onChange={setAccountId} />
      <PlaceField value={place} onChange={setPlace} guess={guess} />

      {hasBreakdown && (
        <ReceiptCard
          title={t('capture.scanReview.items')}
          items={items}
          currency={r.currency}
          receipt={receipt}
          total={total ?? 0}
          warning={
            mismatch.mismatch && r.subtotal !== null
              ? t('capture.scanReview.mismatch', { items: money(itemsTotal(items)), diff: money(Math.abs(mismatch.diff)), subtotal: money(r.subtotal) })
              : items.length > 0
                ? conf(r.confidence.items)
                : undefined
          }
          onChangeItemTotal={(i, v) => setItems((list) => list.map((x, j) => (j === i ? { ...x, total: v } : x)))}
        />
      )}
      <ReceiptDetailsCard receipt={receipt} />

      <View style={styles.actions}>
        <Button label={saving.done ? t('common.ui.saved') : t('capture.scanReview.save')} done={saving.done} fullWidth onPress={save} />
        <Button label={existing ? t('common.back') : t('capture.scan.retake')} icon={existing ? undefined : RotateCcw} variant="secondary" fullWidth onPress={onRetake} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.lg },
  intro: { marginTop: -space.sm },
  actions: { gap: space.sm, marginTop: space.sm },
});

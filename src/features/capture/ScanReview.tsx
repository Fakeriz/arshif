import { RotateCcw, TriangleAlert } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

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
  const s = sampleScan;
  const [merchant, setMerchant] = useState(s.merchant.value);
  const [date, setDate] = useState(s.date.value);
  const [total, setTotal] = useState<number | null>(s.total.value);
  const [category, setCategory] = useState<string | null>(s.category.value);
  const [accountId, setAccountId] = useState<string | null>(accounts[0]?.id ?? null);
  const [items, setItems] = useState<ReceiptItem[]>(s.items);
  const [tried, setTried] = useState(false);

  const mismatch = subtotalMismatch(items, s.subtotal);
  const errors = {
    merchant: tried && !merchant.trim() ? 'Nama toko tidak boleh kosong.' : undefined,
    total: tried && (!total || total <= 0) ? 'Isi total belanja.' : undefined,
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
          Isi sudah dibaca AI. Periksa kolom bertanda kuning sebelum menyimpan.
        </AppText>
      </View>
      <Input label="Toko" value={merchant} onChangeText={setMerchant} error={errors.merchant} warning={isLowConfidence(s.merchant.conf) ? `Keyakinan ${pct(s.merchant.conf)}, cek ulang.` : undefined} />
      <Input label="Tanggal" value={date} onChangeText={setDate} warning={isLowConfidence(s.date.conf) ? `Keyakinan ${pct(s.date.conf)}, cek ulang.` : undefined} />
      <AmountField label={`Total belanja (${s.currency})`} value={total} onChange={setTotal} currency={s.currency} error={errors.total} warning={isLowConfidence(s.total.conf) ? `Keyakinan ${pct(s.total.conf)}, cek ulang.` : undefined} />
      <CategoryPicker type="expense" scroll value={category} onChange={setCategory} warning={isLowConfidence(s.category.conf) ? `Keyakinan ${pct(s.category.conf)}, pastikan kategorinya benar.` : undefined} />
      <AccountPicker label="Dibayar dari" accounts={accounts} value={accountId} onChange={setAccountId} />

      <Card>
        <AppText variant="h3">Item belanja</AppText>
        {mismatch.mismatch && (
          <View style={[styles.warn, { backgroundColor: colors.warningSoft }]} accessibilityRole="alert">
            <Icon icon={TriangleAlert} color={colors.warning} />
            <AppText variant="caption" style={styles.flex}>
              {`Jumlah item ${formatMoney(itemsTotal(items), s.currency)} berbeda ${formatMoney(Math.abs(mismatch.diff), s.currency)} dari subtotal ${formatMoney(s.subtotal, s.currency)}. Cek harga tiap item.`}
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
          <AppText variant="caption" tone="secondary">
            Subtotal di struk
          </AppText>
          <AppText variant="bodyStrong" numeric>
            {formatMoney(s.subtotal, s.currency)}
          </AppText>
        </View>
      </Card>

      <View style={styles.actions}>
        <Button label="Simpan transaksi" fullWidth onPress={save} />
        <Button label="Foto ulang" icon={RotateCcw} variant="secondary" fullWidth onPress={onRetake} />
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
  sub: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space.lg },
  actions: { gap: space.sm },
});

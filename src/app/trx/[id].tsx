import { Pencil, Trash2 } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/shell/Screen';
import { ScreenHeader } from '@/components/shell/ScreenHeader';
import { AppText, Button, Card, CategoryIcon, CurrencyText, Dialog, EmptyState, useToast } from '@/components/ui';
import { getCategory } from '@/constants/categories';
import { InfoRow } from '@/features/transactions/InfoRow';
import { ReceiptItems } from '@/features/transactions/ReceiptItems';
import { dayLong } from '@/lib/dates';
import { crossRate } from '@/lib/fx';
import { formatMoney } from '@/lib/money';
import { useStore } from '@/state/AppStore';
import { space } from '@/theme/tokens';

const SOURCE: Record<string, string> = { manual: 'Dicatat manual', scan: 'Scan struk', voice: 'Voice Log', import: 'Import PDF', smartlog: 'Notifikasi bank' };

export default function TransactionDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { show } = useToast();
  const { state, dispatch } = useStore();
  const [confirm, setConfirm] = useState(false);
  const tx = state.transactions.find((t) => t.id === id);

  if (!tx) {
    return (
      <Screen glow={false}>
        <ScreenHeader title="Detail transaksi" />
        <EmptyState title="Transaksi tidak ditemukan" message="Transaksi ini mungkin sudah dihapus." actionLabel="Ke daftar transaksi" onAction={() => router.replace('/transaksi')} />
      </Screen>
    );
  }

  const account = state.accounts.find((a) => a.id === tx.accountId);
  const toAccount = state.accounts.find((a) => a.id === tx.toAccountId);
  const converted = account && account.currency !== tx.currency && tx.accountAmount !== undefined;
  const kind = tx.type === 'income' ? 'income' : tx.type === 'transfer' ? 'balance' : 'expense';

  return (
    <Screen>
      <ScreenHeader title="Detail transaksi" />
      <View style={styles.hero}>
        <CategoryIcon category={tx.categoryKey} size={56} />
        <AppText variant="h2" align="center">
          {tx.merchant}
        </AppText>
        <CurrencyText amount={tx.amount} currency={tx.currency} kind={kind} variant="amountHero" />
        <AppText variant="caption" tone="muted">
          {tx.time ? `${dayLong(tx.date)}, ${tx.time.replace(':', '.')}` : dayLong(tx.date)}
        </AppText>
      </View>
      <Card>
        <InfoRow label={tx.type === 'transfer' ? 'Dari akun' : 'Akun'} value={account?.name ?? '-'} divider />
        {toAccount && <InfoRow label="Ke akun" value={toAccount.name} divider />}
        <InfoRow label="Kategori" value={getCategory(tx.categoryKey).label} divider />
        <InfoRow label="Sumber" value={SOURCE[tx.source]} divider={!!tx.note} />
        {tx.note && <InfoRow label="Catatan" value={tx.note} />}
      </Card>
      {converted && account && tx.accountAmount !== undefined && (
        <Card>
          <AppText variant="h3">Konversi mata uang</AppText>
          <InfoRow label="Nominal struk" value={formatMoney(tx.amount, tx.currency)} divider />
          <InfoRow label={`Dipotong dari ${account.name}`} value={formatMoney(tx.accountAmount, account.currency)} divider />
          <InfoRow label="Kurs" value={`1 ${tx.currency} = ${Number(crossRate(tx.currency, account.currency)).toFixed(4)} ${account.currency}`} />
        </Card>
      )}
      {tx.items && tx.items.length > 0 && <ReceiptItems items={tx.items} currency={tx.currency} />}
      <View style={styles.actions}>
        <Button label="Ubah" icon={Pencil} variant="secondary" fullWidth onPress={() => router.push({ pathname: '/tambah', params: { id: tx.id } })} />
        <Button label="Hapus transaksi" icon={Trash2} variant="danger" fullWidth onPress={() => setConfirm(true)} />
      </View>
      <Dialog
        visible={confirm}
        tone="danger"
        title="Hapus transaksi ini?"
        message={`${tx.merchant} · ${formatMoney(tx.amount, tx.currency)}. Saldo ${account?.name ?? 'akun'} akan dikembalikan. Tindakan ini tidak bisa dibatalkan.`}
        confirmLabel="Hapus"
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          setConfirm(false);
          dispatch({ type: 'tx/delete', id: tx.id });
          show({ tone: 'success', title: 'Transaksi dihapus' });
          router.back();
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: space.sm, paddingVertical: space.lg },
  actions: { gap: space.sm },
});

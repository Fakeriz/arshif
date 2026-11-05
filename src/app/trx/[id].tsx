import { Pencil, Trash2 } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { categoryLabel, useI18n } from '@/i18n';
import { Screen } from '@/components/shell/Screen';
import { ScreenHeader } from '@/components/shell/ScreenHeader';
import { AppText, Button, Card, CategoryIcon, CurrencyText, Dialog, EmptyState, useToast } from '@/components/ui';
import { InfoRow } from '@/features/transactions/InfoRow';
import { ReceiptItems } from '@/features/transactions/ReceiptItems';
import { dayLong } from '@/lib/dates';
import { crossRate } from '@/lib/fx';
import { formatMoney } from '@/lib/money';
import { useStore } from '@/state/AppStore';
import { space } from '@/theme/tokens';

export default function TransactionDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t, lang } = useI18n();
  const { show } = useToast();
  const { state, dispatch } = useStore();
  const [confirm, setConfirm] = useState(false);
  const tx = state.transactions.find((t) => t.id === id);

  if (!tx) {
    return (
      <Screen glow={false}>
        <ScreenHeader title={t('tx.detail.title')} />
        <EmptyState title={t('tx.detail.notFoundTitle')} message={t('tx.detail.notFoundMessage')} actionLabel={t('tx.detail.toList')} onAction={() => router.replace('/transaksi')} />
      </Screen>
    );
  }

  const account = state.accounts.find((a) => a.id === tx.accountId);
  const toAccount = state.accounts.find((a) => a.id === tx.toAccountId);
  const converted = account && account.currency !== tx.currency && tx.accountAmount !== undefined;
  const kind = tx.type === 'income' ? 'income' : tx.type === 'transfer' ? 'balance' : 'expense';

  return (
    <Screen>
      <ScreenHeader title={t('tx.detail.title')} />
      <View style={styles.hero}>
        <CategoryIcon category={tx.categoryKey} size={56} />
        <AppText variant="h2" align="center">
          {tx.merchant}
        </AppText>
        <CurrencyText amount={tx.amount} currency={tx.currency} kind={kind} variant="amountHero" />
        <AppText variant="caption" tone="muted">
          {tx.time ? `${dayLong(tx.date, lang)}, ${tx.time.replace(':', '.')}` : dayLong(tx.date, lang)}
        </AppText>
      </View>
      <Card>
        <InfoRow label={tx.type === 'transfer' ? t('tx.detail.fromAccount') : t('tx.detail.account')} value={account?.name ?? '-'} divider />
        {toAccount && <InfoRow label={t('tx.detail.toAccount')} value={toAccount.name} divider />}
        <InfoRow label={t('tx.detail.category')} value={categoryLabel(t, tx.categoryKey)} divider />
        <InfoRow label={t('tx.detail.source')} value={t(`tx.source.${tx.source}`)} divider={!!tx.note} />
        {tx.note && <InfoRow label={t('tx.detail.note')} value={tx.note} />}
      </Card>
      {converted && account && tx.accountAmount !== undefined && (
        <Card>
          <AppText variant="h3">{t('tx.detail.conversion')}</AppText>
          <InfoRow label={t('tx.detail.receiptAmount')} value={formatMoney(tx.amount, tx.currency)} divider />
          <InfoRow label={t('tx.detail.deductedFrom', { account: account.name })} value={formatMoney(tx.accountAmount, account.currency)} divider />
          <InfoRow label={t('tx.detail.rate')} value={`1 ${tx.currency} = ${Number(crossRate(tx.currency, account.currency)).toFixed(4)} ${account.currency}`} />
        </Card>
      )}
      {tx.items && tx.items.length > 0 && <ReceiptItems items={tx.items} currency={tx.currency} />}
      <View style={styles.actions}>
        <Button label={t('tx.detail.edit')} icon={Pencil} variant="secondary" fullWidth onPress={() => router.push({ pathname: '/tambah', params: { id: tx.id } })} />
        <Button label={t('tx.detail.delete')} icon={Trash2} variant="danger" fullWidth onPress={() => setConfirm(true)} />
      </View>
      <Dialog
        visible={confirm}
        tone="danger"
        title={t('tx.detail.deleteTitle')}
        message={t('tx.detail.deleteMessage', { merchant: tx.merchant, amount: formatMoney(tx.amount, tx.currency), account: account?.name ?? t('tx.detail.deleteAccountFallback') })}
        confirmLabel={t('tx.detail.deleteConfirm')}
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          setConfirm(false);
          dispatch({ type: 'tx/delete', id: tx.id });
          show({ tone: 'success', title: t('tx.detail.deleted') });
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

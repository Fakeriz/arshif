import { Info, Pencil, ScanText, Split, Trash2 } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { categoryLabel, useI18n } from '@/i18n';
import { usePaywall } from '@/components/shell/Paywall';
import { HeaderActions } from '@/components/shell/HeaderActions';
import { ScreenHeader } from '@/components/shell/ScreenHeader';
import { AppText, Button, Card, CategoryIcon, CurrencyText, Dialog, EmptyState, Group, Icon, Skeleton, Tooltip, useToast } from '@/components/ui';
import { PlaceMap } from '@/features/places/PlaceField';
import { invokeFn } from '@/data/remote/functions';
import { failureOf } from '@/features/capture/CaptureError';
import { putHandoff } from '@/features/capture/handoff';
import { ReceiptPhoto } from '@/features/capture/ReceiptPhoto';
import { InfoRow } from './InfoRow';
import { ReimbursementCard } from './ReimbursementCard';
import { ReceiptCard, ReceiptDetailsCard } from './ReceiptSections';
import { dayLong } from '@/lib/dates';
import { txFxBasis } from '@/lib/fxBasis';
import { formatMoney } from '@/lib/money';
import { useStore } from '@/state/AppStore';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import { aiCategories } from '@/constants/categories';

import { FUNCTIONS, ScanResult } from '../../../supabase/functions/_shared/contracts';

/**
 * Isi detail transaksi. Layar /trx/[id] membungkusnya dengan Screen + tombol kembali; di desktop
 * tab Transaksi menampilkannya `embedded` di panel samping (judul tanpa tombol kembali).
 */
export function TransactionDetail({ id, embedded, onDeleted }: { id: string; embedded?: boolean; onDeleted: () => void }) {
  const router = useRouter();
  const { t, lang } = useI18n();
  const { colors } = useTheme();
  const { show } = useToast();
  const { state, dispatch, refreshUsage, reload } = useStore();
  const paywall = usePaywall();
  const [confirm, setConfirm] = useState(false);
  const [rereading, setRereading] = useState(false);
  const tx = state.transactions.find((t) => t.id === id);

  // Baca ulang foto struk yang tersimpan (memakai kuota scan), lalu periksa hasilnya di layar review.
  const reread = async (path: string, txId: string) => {
    setRereading(true);
    try {
      const result = await invokeFn(FUNCTIONS.scan, { path, lang, categories: aiCategories(state.categories) }, ScanResult);
      putHandoff('scan', { result, receiptPath: path, txId });
      router.push('/scan-review');
    } catch (e) {
      const failure = failureOf(e);
      if (failure === 'quota') paywall(t('capture.scan.limitReason'));
      else show({ tone: 'error', title: t(failure === 'unreadable' ? 'capture.scan.failedTitle' : 'tx.receipt.rereadFailed') });
    } finally {
      refreshUsage();
      setRereading(false);
    }
  };

  if (!tx && (state.status === 'idle' || state.status === 'loading')) {
    const skel = (
      <>
        <Skeleton height={120} radius={radius.lg} />
        <Skeleton height={180} radius={radius.lg} />
      </>
    );
    if (embedded) return skel;
    return (
      <>
        <ScreenHeader title={t('tx.detail.title')} />
        {skel}
      </>
    );
  }

  if (!tx && state.status === 'error') {
    const err = <EmptyState kind="error" title={t('tx.errorTitle')} message={t('tx.errorMessage')} actionLabel={t('common.retry')} onAction={reload} />;
    if (embedded) return err;
    return (
      <>
        <ScreenHeader title={t('tx.detail.title')} />
        {err}
      </>
    );
  }

  if (!tx) {
    const empty = <EmptyState title={t('tx.detail.notFoundTitle')} message={t('tx.detail.notFoundMessage')} actionLabel={t('tx.detail.toList')} onAction={() => router.replace('/transaksi')} />;
    if (embedded) return empty;
    return (
      <>
        <ScreenHeader title={t('tx.detail.title')} />
        {empty}
      </>
    );
  }

  const account = state.accounts.find((a) => a.id === tx.accountId);
  const toAccount = state.accounts.find((a) => a.id === tx.toAccountId);
  const fxBasis = txFxBasis(tx, account, toAccount);
  const kind = tx.type === 'income' ? 'income' : tx.type === 'transfer' ? 'balance' : 'expense';

  const actionsEl = (
    <HeaderActions
      actions={[
        ...(tx.type === 'expense'
          ? [{ key: 'split', label: t('plan.split.fromReceipt'), icon: Split, onPress: () => router.push({ pathname: '/rencana/split/[id]', params: { id: 'baru', tx: tx.id } }) }]
          : []),
        { key: 'edit', label: t('tx.detail.edit'), icon: Pencil, pinned: true, onPress: () => router.push({ pathname: '/tambah', params: { id: tx.id } }) },
        { key: 'delete', label: t('tx.detail.delete'), icon: Trash2, danger: true, onPress: () => setConfirm(true) },
      ]}
    />
  );

  return (
    <>
      {embedded ? (
        <View style={styles.panelHead}>
          <AppText variant="h2" accessibilityRole="header">
            {t('tx.detail.title')}
          </AppText>
          <View style={styles.panelActions}>{actionsEl}</View>
        </View>
      ) : (
        <ScreenHeader title={t('tx.detail.title')} right={actionsEl} />
      )}
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
        {tx.type === 'transfer' && <InfoRow label={t('tx.detail.toAccount')} value={toAccount?.name ?? '-'} divider />}
        <InfoRow label={t('tx.detail.category')} value={categoryLabel(t, tx.categoryKey)} divider />
        <InfoRow label={t('tx.detail.source')} value={t(`tx.source.${tx.source}`)} divider={!!tx.note} />
        {tx.note && <InfoRow label={t('tx.detail.note')} value={tx.note} />}
      </Card>
      {tx.place && (
        <Group label={t('tx.place.label')}>
          <Card padding={0}>
            <PlaceMap place={tx.place} />
            <View style={styles.place}>
              <AppText variant="bodyStrong">{tx.place.name}</AppText>
              {tx.place.address ? (
                <AppText variant="caption" tone="muted">
                  {tx.place.address}
                </AppText>
              ) : null}
            </View>
          </Card>
        </Group>
      )}
      {fxBasis && (
        <Card>
          <View style={styles.convHead}>
            <AppText variant="h3">{t('tx.detail.conversion')}</AppText>
            <Tooltip text={t('tx.detail.rateInfo')} accessibilityLabel={t('tx.detail.rateInfoLabel')}>
              <Icon icon={Info} color={colors.textMuted} size={18} />
            </Tooltip>
          </View>
          <InfoRow
            label={fxBasis.kind === 'remittance' ? t('tx.detail.remitSent', { account: account?.name ?? '-' }) : t('tx.detail.receiptAmount')}
            value={formatMoney(fxBasis.fromAmount, fxBasis.fromCurrency)}
            divider
          />
          <InfoRow
            label={fxBasis.kind === 'remittance' ? t('tx.detail.remitReceived', { account: toAccount?.name ?? '-' }) : t('tx.detail.deductedFrom', { account: account?.name ?? '-' })}
            value={formatMoney(fxBasis.toAmount, fxBasis.toCurrency)}
            divider
          />
          <InfoRow
            label={t('tx.detail.rate')}
            value={`1 ${fxBasis.fromCurrency} = ${fxBasis.effectiveRate} ${fxBasis.toCurrency}`}
            divider={fxBasis.fxDeltaTo !== null && fxBasis.fxDeltaTo !== 0}
          />
          {fxBasis.fxDeltaTo !== null && fxBasis.fxDeltaTo !== 0 && (
            <InfoRow label={t('tx.detail.fxDelta')} value={formatMoney(fxBasis.fxDeltaTo, fxBasis.toCurrency, 'always')} />
          )}
        </Card>
      )}
      {((tx.items && tx.items.length > 0) || tx.receipt) && (
        <ReceiptCard title={t('tx.detail.receiptItems')} items={tx.items ?? []} currency={tx.currency} receipt={tx.receipt} total={tx.amount} />
      )}
      {tx.receipt && <ReceiptDetailsCard receipt={tx.receipt} />}
      {tx.receiptPath && <ReceiptPhoto path={tx.receiptPath} merchant={tx.merchant} />}
      <ReimbursementCard tx={tx} />
      {tx.receiptPath && tx.type === 'expense' && (
        <Button label={t('tx.receipt.reread')} icon={ScanText} variant="secondary" fullWidth loading={rereading} disabled={rereading} onPress={() => void reread(tx.receiptPath!, tx.id)} />
      )}
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
          onDeleted();
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  panelHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md, minHeight: 44 },
  panelActions: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  convHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  hero: { alignItems: 'center', gap: space.sm, paddingVertical: space.lg },
  place: { gap: space.xxs, paddingVertical: space.md, paddingHorizontal: space.xl },
});

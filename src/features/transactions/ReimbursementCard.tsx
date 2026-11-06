import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { AppText, Badge, BottomSheet, Button, Card, CurrencyText, EmptyState, ListItem, Toggle, useToast } from '@/components/ui';
import type { Transaction } from '@/data/types';
import { PaySheet } from '@/features/planning/kit';
import { useI18n } from '@/i18n';
import { shortDate } from '@/lib/dates';
import { newId } from '@/lib/uuid';
import { useStore } from '@/state/AppStore';
import { space } from '@/theme/tokens';

/**
 * Reimbursement (FR-TRX-4). Pengeluaran yang diganti teman: tidak dihitung sebagai belanja; status pending sampai
 * pemasukan penggantinya ditautkan (reimbursed). Pemasukan pengganti tidak dihitung sebagai pemasukan.
 */
export function ReimbursementCard({ tx }: { tx: Transaction }) {
  const { t, lang } = useI18n();
  const router = useRouter();
  const { show } = useToast();
  const { state, dispatch, commitTx } = useStore();
  const [linking, setLinking] = useState(false);
  const [recording, setRecording] = useState(false);

  // Pemasukan yang menjadi pengganti pengeluaran lain.
  if (tx.type === 'income') {
    const expenses = state.transactions.filter((e) => e.reimbursedBy === tx.id);
    if (expenses.length === 0) return null;
    return (
      <Card padding="md">
        <AppText variant="h3" style={styles.title}>
          {t('tx.reimb.repaymentTitle')}
        </AppText>
        <AppText variant="caption" tone="secondary" style={styles.title}>
          {t('tx.reimb.repaymentNote')}
        </AppText>
        {expenses.map((e) => (
          <ListItem
            key={e.id}
            title={e.merchant}
            subtitle={shortDate(e.date, lang)}
            trailing={<CurrencyText amount={e.amount} currency={e.currency} kind="expense" variant="bodyStrong" />}
            chevron
            onPress={() => router.push({ pathname: '/trx/[id]', params: { id: e.id } })}
          />
        ))}
      </Card>
    );
  }
  if (tx.type !== 'expense') return null;

  const status = tx.reimburseStatus;
  const repayment = tx.reimbursedBy ? state.transactions.find((x) => x.id === tx.reimbursedBy) : undefined;
  const set = (s: 'pending' | null, by: string | null) => dispatch({ type: 'tx/reimburse', id: tx.id, status: s, reimbursedBy: by });

  return (
    <Card padding="md">
      <ListItem
        title={t('tx.reimb.toggle')}
        subtitle={t('tx.reimb.toggleSub')}
        subtitleLines={3}
        trailing={<Toggle value={!!status} onChange={(on) => set(on ? 'pending' : null, null)} accessibilityLabel={t('tx.reimb.toggle')} />}
      />
      {status === 'pending' && (
        <View style={styles.body}>
          <View style={styles.row}>
            <Badge label={t('tx.reimb.pending')} tone="warning" />
            <AppText variant="caption" tone="secondary" style={styles.flex}>
              {t('tx.reimb.pendingNote')}
            </AppText>
          </View>
          <Button label={t('tx.reimb.link')} variant="secondary" size="md" fullWidth onPress={() => setLinking(true)} />
          <Button label={t('tx.reimb.record')} variant="ghost" size="md" fullWidth onPress={() => setRecording(true)} />
        </View>
      )}
      {status === 'reimbursed' && (
        <View style={styles.body}>
          <View style={styles.row}>
            <Badge label={t('tx.reimb.done')} tone="positive" />
            <AppText variant="caption" tone="secondary" style={styles.flex}>
              {t('tx.reimb.doneNote')}
            </AppText>
          </View>
          {repayment && (
            <ListItem
              title={repayment.merchant}
              subtitle={t('tx.reimb.repaidOn', { date: shortDate(repayment.date, lang) })}
              trailing={<CurrencyText amount={repayment.amount} currency={repayment.currency} kind="income" variant="bodyStrong" />}
              chevron
              onPress={() => router.push({ pathname: '/trx/[id]', params: { id: repayment.id } })}
            />
          )}
          <Button label={t('tx.reimb.unlink')} variant="ghost" size="md" fullWidth onPress={() => set('pending', null)} />
        </View>
      )}
      <LinkSheet
        visible={linking}
        expense={tx}
        onClose={() => setLinking(false)}
        onPick={(income) => {
          set('pending', income.id);
          setLinking(false);
          show({ tone: 'success', title: t('tx.reimb.linked') });
        }}
      />
      <PaySheet
        key={recording ? 'rec' : 'idle'}
        visible={recording}
        onClose={() => setRecording(false)}
        title={t('tx.reimb.recordTitle')}
        note={t('tx.reimb.recordNote')}
        currency={tx.currency}
        initial={tx.amount}
        submitLabel={t('tx.reimb.recordSave')}
        onSubmit={async (p) => {
          try {
            const income = await commitTx({
              id: newId(), type: 'income', merchant: t('tx.reimb.repaymentMerchant', { merchant: tx.merchant }).slice(0, 120), categoryKey: 'other',
              accountId: p.accountId, date: p.date, time: '12:00', amount: p.amount, currency: tx.currency, source: 'manual',
            });
            set('pending', income.id);
            setRecording(false);
            show({ tone: 'success', title: t('tx.reimb.linked') });
          } catch {
            show({ tone: 'error', title: t('common.syncFailed'), message: t('common.syncFailedMessage') });
          }
        }}
      />
    </Card>
  );
}

/** Pilih pemasukan pengganti: pemasukan sejak tanggal pengeluaran, terbaru dulu. */
function LinkSheet({ visible, expense, onClose, onPick }: { visible: boolean; expense: Transaction; onClose: () => void; onPick: (income: Transaction) => void }) {
  const { t, lang } = useI18n();
  const { height } = useWindowDimensions();
  const { state } = useStore();
  const accountName = (id: string) => state.accounts.find((a) => a.id === id)?.name ?? '-';
  const candidates = state.transactions
    .filter((x) => x.type === 'income' && x.date >= expense.date)
    .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`))
    .slice(0, 50);
  return (
    <BottomSheet visible={visible} onClose={onClose} title={t('tx.reimb.linkTitle')} subtitle={t('tx.reimb.linkSub')}>
      {candidates.length === 0 ? (
        <EmptyState compact title={t('tx.reimb.linkEmptyTitle')} message={t('tx.reimb.linkEmptyMessage')} />
      ) : (
        <ScrollView style={{ maxHeight: height * 0.55 }}>
          {candidates.map((x, i) => (
            <ListItem
              key={x.id}
              title={x.merchant}
              subtitle={`${shortDate(x.date, lang)} · ${accountName(x.accountId)}`}
              trailing={<CurrencyText amount={x.amount} currency={x.currency} kind="income" variant="bodyStrong" />}
              divider={i < candidates.length - 1}
              onPress={() => onPick(x)}
            />
          ))}
        </ScrollView>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: { paddingHorizontal: space.xs, paddingTop: space.xs },
  body: { gap: space.sm, paddingHorizontal: space.xs, paddingBottom: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1 },
});

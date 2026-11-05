import { useLocalSearchParams, useRouter } from 'expo-router';
import { HandCoins, Pencil, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Card, Dialog, EmptyState, useToast } from '@/components/ui';
import { DebtCard } from '@/features/planning/DebtCard';
import { DebtForm } from '@/features/planning/forms';
import { PaySheet, PlanScreen, SectionLabel } from '@/features/planning/kit';
import { InfoRow } from '@/features/transactions/InfoRow';
import { useI18n } from '@/i18n';
import { shortDate } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { usePlanning } from '@/state/planning';
import { space } from '@/theme/tokens';

export default function DebtDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t, lang } = useI18n();
  const { show } = useToast();
  const { debts, payments, splits, payDebt, removeDebt } = usePlanning();
  const [pay, setPay] = useState(false);
  const [edit, setEdit] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const debt = debts.find((d) => d.id === id);
  const history = payments.filter((p) => p.debtId === id);
  const split = debt?.splitBillId ? splits.find((s) => s.id === debt.splitBillId) : undefined;

  return (
    <PlanScreen title={debt?.kind === 'receivable' ? t('plan.debts.tabs.receivable') : t('plan.debts.tabs.debt')}>
      {!debt ? (
        <EmptyState title={t('plan.common.notFound')} message={t('plan.common.notFoundMessage')} actionLabel={t('plan.common.back')} onAction={() => router.back()} />
      ) : (
        <>
          <DebtCard debt={debt} />
          {(debt.contact || debt.note || split) && (
            <Card padding="md">
              {debt.contact ? <InfoRow label={t('plan.debts.contact')} value={debt.contact} divider={!!(debt.note || split)} /> : null}
              {debt.note ? <InfoRow label={t('plan.debts.note')} value={debt.note} divider={!!split} /> : null}
              {split ? <InfoRow label={t('plan.split.title')} value={t('plan.debts.fromSplit', { title: split.title })} /> : null}
            </Card>
          )}
          {debt.status === 'active' && (
            <Button label={debt.kind === 'debt' ? t('plan.debts.pay') : t('plan.debts.receive')} icon={HandCoins} fullWidth onPress={() => setPay(true)} />
          )}
          <SectionLabel>{t('plan.common.history')}</SectionLabel>
          <Card padding="md">
            {history.length === 0 ? (
              <AppText variant="body" tone="secondary">
                {t('plan.common.historyEmpty')}
              </AppText>
            ) : (
              history.map((p, i) => <InfoRow key={p.id} label={shortDate(p.date, lang)} value={formatMoney(p.amount, debt.currency)} divider={i < history.length - 1} />)
            )}
          </Card>
          <View style={styles.actions}>
            <Button label={t('plan.common.edit')} icon={Pencil} variant="secondary" fullWidth onPress={() => setEdit(true)} />
            <Button label={t('plan.common.delete')} icon={Trash2} variant="danger" fullWidth onPress={() => setConfirm(true)} />
          </View>
          <PaySheet
            key={pay ? `pay-${debt.balance}` : 'idle'}
            visible={pay}
            onClose={() => setPay(false)}
            title={debt.kind === 'debt' ? t('plan.debts.payTitle', { name: debt.counterparty }) : t('plan.debts.receiveTitle', { name: debt.counterparty })}
            note={debt.kind === 'debt' ? t('plan.debts.payNote') : t('plan.debts.receiveNote')}
            currency={debt.currency}
            initial={debt.minPayment > 0 ? Math.min(debt.minPayment, debt.balance) : debt.balance}
            max={debt.balance}
            submitLabel={debt.kind === 'debt' ? t('plan.debts.pay') : t('plan.debts.receive')}
            onSubmit={async (p) => {
              try {
                const next = await payDebt(debt, p);
                setPay(false);
                show({ tone: 'success', title: t('plan.debts.payDone', { name: debt.counterparty, amount: formatMoney(next.balance, next.currency) }) });
              } catch {
                show({ tone: 'error', title: t('plan.common.saveFailed') });
              }
            }}
          />
          <DebtForm key={edit ? `edit-${debt.id}` : 'closed'} visible={edit} onClose={() => setEdit(false)} debt={debt} kind={debt.kind} />
          <Dialog
            visible={confirm}
            tone="danger"
            title={t('plan.common.deleteTitle', { name: debt.counterparty })}
            message={t('plan.common.deleteMessage')}
            confirmLabel={t('plan.common.delete')}
            onCancel={() => setConfirm(false)}
            onConfirm={() => {
              setConfirm(false);
              removeDebt(debt.id)
                .then(() => {
                  show({ tone: 'success', title: t('plan.common.deleted') });
                  router.back();
                })
                .catch(() => show({ tone: 'error', title: t('plan.common.deleteFailed') }));
            }}
          />
        </>
      )}
    </PlanScreen>
  );
}

const styles = StyleSheet.create({ actions: { gap: space.sm, marginTop: space.sm } });

import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pencil, PiggyBank, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Card, Dialog, EmptyState, useToast } from '@/components/ui';
import { Confetti } from '@/features/planning/Confetti';
import { GoalCard } from '@/features/planning/GoalCard';
import { GoalForm } from '@/features/planning/forms';
import { PaySheet, PlanScreen, SectionLabel } from '@/features/planning/kit';
import { InfoRow } from '@/features/transactions/InfoRow';
import { useI18n } from '@/i18n';
import { shortDate } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { useStore } from '@/state/AppStore';
import { usePlanning } from '@/state/planning';
import { haptic } from '@/theme/motion';
import { space } from '@/theme/tokens';

export default function GoalDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t, lang } = useI18n();
  const { show } = useToast();
  const { state } = useStore();
  const { goals, deposits, depositGoal, removeGoal } = usePlanning();
  const [pay, setPay] = useState(false);
  const [edit, setEdit] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const goal = goals.find((g) => g.id === id);
  const history = deposits.filter((d) => d.goalId === id);

  return (
    <PlanScreen title={t('plan.goals.title')}>
      {!goal ? (
        <EmptyState title={t('plan.common.notFound')} message={t('plan.common.notFoundMessage')} actionLabel={t('plan.common.back')} onAction={() => router.back()} />
      ) : (
        <>
          <GoalCard goal={goal} />
          {goal.status === 'active' && <Button label={t('plan.goals.deposit')} icon={PiggyBank} fullWidth onPress={() => setPay(true)} />}
          <SectionLabel>{t('plan.common.history')}</SectionLabel>
          <Card padding="md">
            {history.length === 0 ? (
              <AppText variant="body" tone="secondary">
                {t('plan.common.historyEmpty')}
              </AppText>
            ) : (
              history.map((d, i) => (
                <InfoRow
                  key={d.id}
                  label={`${shortDate(d.date, lang)}${d.accountId ? ` · ${state.accounts.find((a) => a.id === d.accountId)?.name ?? ''}` : ''}`}
                  value={formatMoney(d.amount, goal.currency)}
                  divider={i < history.length - 1}
                />
              ))
            )}
          </Card>
          <View style={styles.actions}>
            <Button label={t('plan.common.edit')} icon={Pencil} variant="secondary" fullWidth onPress={() => setEdit(true)} />
            <Button label={t('plan.common.delete')} icon={Trash2} variant="danger" fullWidth onPress={() => setConfirm(true)} />
          </View>
          <PaySheet
            key={pay ? 'pay' : 'idle'}
            visible={pay}
            onClose={() => setPay(false)}
            title={t('plan.goals.depositTitle', { name: goal.name })}
            note={t('plan.goals.depositNote')}
            currency={goal.currency}
            initial={null}
            defaultAccountId={goal.accountId}
            submitLabel={t('plan.goals.deposit')}
            onSubmit={async (p) => {
              try {
                const next = await depositGoal(goal, p);
                setPay(false);
                if (next.status === 'completed') {
                  haptic('success');
                  setCelebrate(true);
                  show({ tone: 'success', title: t('plan.goals.reachedTitle'), message: t('plan.goals.reachedMessage', { name: goal.name }) });
                } else show({ tone: 'success', title: t('plan.goals.depositDone', { amount: formatMoney(p.amount, goal.currency), name: goal.name }) });
              } catch {
                show({ tone: 'error', title: t('plan.common.saveFailed') });
              }
            }}
          />
          <GoalForm key={edit ? `edit-${goal.id}` : 'closed'} visible={edit} onClose={() => setEdit(false)} goal={goal} />
          <Dialog
            visible={confirm}
            tone="danger"
            title={t('plan.common.deleteTitle', { name: goal.name })}
            message={t('plan.common.deleteMessage')}
            confirmLabel={t('plan.common.delete')}
            onCancel={() => setConfirm(false)}
            onConfirm={() => {
              setConfirm(false);
              removeGoal(goal.id)
                .then(() => {
                  show({ tone: 'success', title: t('plan.common.deleted') });
                  router.back();
                })
                .catch(() => show({ tone: 'error', title: t('plan.common.deleteFailed') }));
            }}
          />
        </>
      )}
      {celebrate && <Confetti onDone={() => setCelebrate(false)} />}
    </PlanScreen>
  );
}

const styles = StyleSheet.create({ actions: { gap: space.sm, marginTop: space.sm } });

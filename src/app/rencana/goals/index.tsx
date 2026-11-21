import { useRouter } from 'expo-router';
import { useState } from 'react';

import { CardGrid } from '@/components/shell/DesktopGrid';
import { EmptyState, Group } from '@/components/ui';
import { GoalCard } from '@/features/planning/GoalCard';
import { GoalForm } from '@/features/planning/forms';
import { AddButton, PlanScreen } from '@/features/planning/kit';
import { useI18n } from '@/i18n';
import { useLimits } from '@/state/limits';
import { usePlanning } from '@/state/planning';

export default function GoalsScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const { goals } = usePlanning();
  const limits = useLimits();
  const [form, setForm] = useState(false);
  const active = goals.filter((g) => g.status === 'active');
  const done = goals.filter((g) => g.status === 'completed');

  return (
    <PlanScreen
      wide
      title={t('plan.goals.title')}
      right={goals.length ? <AddButton label={t('plan.common.add')} limited={limits.goals} reason={t('plan.goals.limitReason')} onPress={() => setForm(true)} /> : undefined}
    >
      {goals.length === 0 ? (
        <EmptyState title={t('plan.goals.emptyTitle')} message={t('plan.goals.emptyMessage')} actionLabel={t('plan.goals.create')} onAction={() => setForm(true)} />
      ) : (
        <>
          <CardGrid>
            {active.map((g) => (
              <GoalCard key={g.id} goal={g} onPress={() => router.push({ pathname: '/rencana/goals/[id]', params: { id: g.id } })} />
            ))}
          </CardGrid>
          {done.length > 0 && (
            <Group label={t('plan.goals.completed')}>
              <CardGrid>
                {done.map((g) => (
                  <GoalCard key={g.id} goal={g} onPress={() => router.push({ pathname: '/rencana/goals/[id]', params: { id: g.id } })} />
                ))}
              </CardGrid>
            </Group>
          )}
        </>
      )}
      <GoalForm key={form ? 'open' : 'closed'} visible={form} onClose={() => setForm(false)} />
    </PlanScreen>
  );
}

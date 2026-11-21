import { useRouter } from 'expo-router';
import { Calculator } from 'lucide-react-native';
import { useState } from 'react';

import { CardGrid } from '@/components/shell/DesktopGrid';
import { Button, EmptyState, Group, Tabs } from '@/components/ui';
import type { DebtKind } from '@/data/planning';
import { DebtCard } from '@/features/planning/DebtCard';
import { DebtForm } from '@/features/planning/forms';
import { AddButton, PlanScreen } from '@/features/planning/kit';
import { useI18n } from '@/i18n';
import { useLimits } from '@/state/limits';
import { usePlanning } from '@/state/planning';

export default function DebtsScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const { debts } = usePlanning();
  const limits = useLimits();
  const [kind, setKind] = useState<DebtKind>('debt');
  const [form, setForm] = useState(false);
  const list = debts.filter((d) => d.kind === kind);
  const active = list.filter((d) => d.status === 'active');
  const paid = list.filter((d) => d.status === 'paid');
  const open = (id: string) => router.push({ pathname: '/rencana/utang/[id]', params: { id } });

  return (
    <PlanScreen
      wide
      title={t('plan.debts.title')}
      right={<AddButton label={t('plan.common.add')} limited={limits.billsDebts} reason={t('plan.debts.limitReason')} onPress={() => setForm(true)} />}
    >
      <Tabs
        accessibilityLabel={t('plan.debts.kind')}
        value={kind}
        onChange={setKind}
        items={[
          { key: 'debt', label: t('plan.debts.tabs.debt') },
          { key: 'receivable', label: t('plan.debts.tabs.receivable') },
        ]}
      />
      {kind === 'debt' && active.length > 0 && (
        <Button label={t('plan.debts.simulator')} icon={Calculator} variant="secondary" fullWidth onPress={() => router.push('/rencana/simulator')} />
      )}
      {list.length === 0 ? (
        <EmptyState
          title={kind === 'debt' ? t('plan.debts.emptyDebtTitle') : t('plan.debts.emptyReceivableTitle')}
          message={kind === 'debt' ? t('plan.debts.emptyDebtMessage') : t('plan.debts.emptyReceivableMessage')}
          actionLabel={kind === 'debt' ? t('plan.debts.createDebt') : t('plan.debts.createReceivable')}
          onAction={() => setForm(true)}
        />
      ) : (
        <>
          <CardGrid>
            {active.map((d) => (
              <DebtCard key={d.id} debt={d} onPress={() => open(d.id)} />
            ))}
          </CardGrid>
          {paid.length > 0 && (
            <Group label={t('plan.debts.paidOff')}>
              <CardGrid>
                {paid.map((d) => (
                  <DebtCard key={d.id} debt={d} onPress={() => open(d.id)} />
                ))}
              </CardGrid>
            </Group>
          )}
        </>
      )}
      <DebtForm key={form ? `open-${kind}` : 'closed'} visible={form} onClose={() => setForm(false)} kind={kind} />
    </PlanScreen>
  );
}

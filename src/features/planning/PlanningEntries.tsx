import { useRouter, type Href } from 'expo-router';
import { CalendarClock, HandCoins, PiggyBank, Repeat, Split, type LucideIcon } from 'lucide-react-native';
import { StyleSheet } from 'react-native';

import { AppText, Badge, Button, Card, Group, MenuGroup } from '@/components/ui';
import { useI18n } from '@/i18n';
import { todayYmd } from '@/lib/dates';
import { convert, hasRate } from '@/lib/fx';
import { formatMoney } from '@/lib/money';
import { billGroup } from '@/lib/planning/bills';
import { subscriptionTotals } from '@/lib/planning/subscriptions';
import { useStore } from '@/state/AppStore';
import { usePlanning } from '@/state/planning';
import { space } from '@/theme/tokens';

type Entry = { key: string; icon: LucideIcon; title: string; subtitle: string; href: Href; badge?: string };

/** Entri Planning hub di tab Anggaran: ringkasan satu baris per fitur, terlambat ditandai merah. */
export function PlanningEntries() {
  const { t } = useI18n();
  const router = useRouter();
  const { state } = useStore();
  const p = usePlanning();
  const main = state.mainCurrency;
  const toMain = (minor: number, from: string) => (from === main ? minor : hasRate(from) && hasRate(main) ? convert(minor, from, main) : null);
  const sumMain = (list: { balance: number; currency: string }[]) => list.reduce((s, d) => s + (toMain(d.balance, d.currency) ?? 0), 0);

  if (p.status === 'error') {
    return (
      <Group label={t('plan.hub.title')}>
        <Card padding="md">
          <AppText variant="caption" tone="secondary" style={styles.gap}>
            {t('plan.common.loadErrorTitle')}
          </AppText>
          <Button label={t('common.retry')} variant="secondary" size="sm" onPress={() => void p.reload()} />
        </Card>
      </Group>
    );
  }

  const today = todayYmd();
  const groups = p.bills.map((b) => billGroup(b, today));
  const overdue = groups.filter((g) => g === 'overdue').length;
  const waiting = groups.filter((g) => g !== 'paid' && g !== 'later').length;
  const activeGoals = p.goals.filter((g) => g.status === 'active').length;
  const debts = p.debts.filter((d) => d.status === 'active' && d.kind === 'debt');
  const receivables = p.debts.filter((d) => d.status === 'active' && d.kind === 'receivable');
  const subs = p.subscriptions.filter((s) => s.status === 'active');
  const unpaidSplits = p.splits.filter((s) => s.participants.some((x) => !x.owner && !x.paidAt)).length;

  const entries: Entry[] = [
    {
      key: 'goals', icon: PiggyBank, title: t('plan.hub.goals'), href: '/rencana/goals',
      subtitle: p.goals.length ? t('plan.hub.goalsSummary', { active: activeGoals, done: p.goals.length - activeGoals }) : t('plan.hub.goalsEmpty'),
    },
    {
      key: 'bills', icon: CalendarClock, title: t('plan.hub.bills'), href: '/rencana/tagihan',
      subtitle: !p.bills.length ? t('plan.hub.billsEmpty') : waiting ? t('plan.hub.billsSummary', { count: waiting }) : t('plan.hub.billsClear'),
      badge: overdue ? t('plan.hub.billsOverdue', { count: overdue }) : undefined,
    },
    {
      key: 'debts', icon: HandCoins, title: t('plan.hub.debts'), href: '/rencana/utang',
      subtitle: debts.length || receivables.length
        ? [debts.length ? t('plan.hub.debtsSummary', { amount: formatMoney(sumMain(debts), main) }) : null, receivables.length ? t('plan.hub.debtsReceivable', { amount: formatMoney(sumMain(receivables), main) }) : null].filter(Boolean).join(' · ')
        : t('plan.hub.debtsEmpty'),
    },
    {
      key: 'subs', icon: Repeat, title: t('plan.hub.subscriptions'), href: '/rencana/langganan',
      subtitle: subs.length ? t('plan.hub.subsSummary', { amount: formatMoney(subscriptionTotals(subs, main, (m, f) => toMain(m, f)).monthly, main), count: subs.length }) : t('plan.hub.subsEmpty'),
    },
    {
      key: 'split', icon: Split, title: t('plan.hub.split'), href: '/rencana/split',
      subtitle: !p.splits.length ? t('plan.hub.splitEmpty') : unpaidSplits ? t('plan.hub.splitSummary', { count: unpaidSplits }) : t('plan.hub.splitClear'),
    },
  ];

  return (
    <MenuGroup
      label={t('plan.hub.title')}
      loading={p.status !== 'ready'}
      entries={entries.map((e) => ({
        key: e.key,
        icon: e.icon,
        title: e.title,
        subtitle: e.subtitle,
        accessibilityLabel: [e.title, e.subtitle, e.badge].filter(Boolean).join('. '),
        trailing: e.badge ? <Badge label={e.badge} tone="negative" /> : undefined,
        onPress: () => router.push(e.href),
      }))}
    />
  );
}

const styles = StyleSheet.create({
  gap: { marginBottom: space.sm },
});

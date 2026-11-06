import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { CategoryKey } from '../../supabase/functions/_shared/contracts';
import { Screen } from '@/components/shell/Screen';
import { ScreenHeader } from '@/components/shell/ScreenHeader';
import { AppText, EmptyState, Skeleton, Tabs } from '@/components/ui';
import { AskTab } from '@/features/coach/AskTab';
import { RecapTab } from '@/features/coach/RecapTab';
import { ScoreTab } from '@/features/coach/ScoreTab';
import { useT } from '@/i18n';
import { CoachNarration } from '@/features/coach/CoachNarration';
import { todayYmd } from '@/lib/dates';
import { weeklyRecap } from '@/lib/recap';
import { useStore } from '@/state/AppStore';
import { useLoadState } from '@/state/loadState';
import { useBudget, useHealth, useLedger } from '@/state/derived';
import { useRetry } from '@/state/useRetry';
import { radius, space } from '@/theme/tokens';

type Tab = 'score' | 'recap' | 'ask';

export default function CoachScreen() {
  const demo = useLoadState();
  const retry = useRetry();
  const { refreshing } = useStore();
  const { transactions, mainCurrency } = useLedger();
  const health = useHealth();
  const budget = useBudget();
  // Narasi Coach merangkum minggu lalu yang sudah selesai.
  const recap = weeklyRecap(transactions, todayYmd(), mainCurrency, 'last');
  const t = useT();
  const [tab, setTab] = useState<Tab>('score');

  let body;
  if (demo === 'error') {
    body = <EmptyState kind="error" title={t('coach.errorTitle')} message={t('coach.errorMessage')} actionLabel={t('common.retry')} onAction={retry} />;
  } else if (demo === 'loading') {
    body = (
      <View style={styles.skeleton} accessibilityLabel={t('coach.loading')} aria-busy>
        <Skeleton height={220} radius={radius.lg} />
        <Skeleton height={300} radius={radius.lg} />
      </View>
    );
  } else if (tab === 'score') {
    // Hanya ringkasan angka yang dikirim ke AI (FR-COACH-4): persen, hari, kunci kategori.
    const narration =
      health.score === null ? null : (
        <CoachNarration
          input={{
            weekStart: recap.start,
            score: health.score,
            pillars: health.pillars.map((p) => ({ key: p.key, points: p.points, max: p.max })),
            facts: {
              spentChangePct: recap.changePct,
              topCategoryKey: CategoryKey.safeParse(recap.topCategoryKey).data ?? null,
              noSpendDays: recap.noSpendDays,
              budgetUsedPct: budget.flexLimit > 0 ? Math.min(1000, Math.round((budget.flexSpent / budget.flexLimit) * 100)) : 0,
              periodElapsedPct: Math.round((budget.period.elapsedDays / budget.period.totalDays) * 100),
            },
          }}
        />
      );
    body = <ScoreTab score={health.score} delta={health.delta} pillars={health.pillars} narration={narration} />;
  } else if (tab === 'recap') {
    body = <RecapTab transactions={transactions} currency={mainCurrency} />;
  } else {
    body = <AskTab />;
  }

  return (
    <Screen onRefresh={retry} refreshing={refreshing}>
      <ScreenHeader title={t('coach.title')} />
      <AppText variant="caption" tone="secondary" align="center">
        {t('coach.subtitle')}
      </AppText>
      <Tabs
        variant="underline"
        accessibilityLabel={t('coach.sections')}
        value={tab}
        onChange={setTab}
        items={[
          { key: 'score', label: t('coach.tab.score') },
          { key: 'recap', label: t('coach.tab.recap') },
          { key: 'ask', label: t('coach.tab.ask') },
        ]}
      />
      {body}
    </Screen>
  );
}

const styles = StyleSheet.create({
  skeleton: { gap: space.lg },
});

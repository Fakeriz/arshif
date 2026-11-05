import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/shell/Screen';
import { TabHeader } from '@/components/shell/TabHeader';
import { EmptyState, Skeleton, Tabs } from '@/components/ui';
import { AskTab } from '@/features/coach/AskTab';
import { RecapTab } from '@/features/coach/RecapTab';
import { ScoreTab } from '@/features/coach/ScoreTab';
import { useT } from '@/i18n';
import { DEMO_TODAY } from '@/lib/dates';
import { weeklyRecap } from '@/lib/recap';
import { useDemoState } from '@/state/demo';
import { useHealth, useLedger } from '@/state/derived';
import { useRetry } from '@/state/useRetry';
import { radius, space } from '@/theme/tokens';

type Tab = 'score' | 'recap' | 'ask';

export default function CoachScreen() {
  const demo = useDemoState();
  const retry = useRetry();
  const { transactions, mainCurrency } = useLedger();
  const health = useHealth();
  const t = useT();
  const [tab, setTab] = useState<Tab>(demo === 'limit' ? 'ask' : 'score');

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
    body = <ScoreTab score={health.score} delta={health.delta} pillars={health.pillars} />;
  } else if (tab === 'recap') {
    body = <RecapTab recap={weeklyRecap(transactions, DEMO_TODAY, mainCurrency)} currency={mainCurrency} />;
  } else {
    body = <AskTab />;
  }

  return (
    <Screen tabs onRefresh={retry} refreshing={false}>
      <TabHeader title={t('coach.title')} subtitle={t('coach.subtitle')} />
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

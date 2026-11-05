import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/shell/Screen';
import { TabHeader } from '@/components/shell/TabHeader';
import { EmptyState, Skeleton, Tabs } from '@/components/ui';
import { AskTab } from '@/features/coach/AskTab';
import { RecapTab } from '@/features/coach/RecapTab';
import { ScoreTab } from '@/features/coach/ScoreTab';
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
  const [tab, setTab] = useState<Tab>(demo === 'limit' ? 'ask' : 'score');

  let body;
  if (demo === 'error') {
    body = <EmptyState kind="error" title="Coach gagal dimuat" message="Periksa koneksimu lalu coba lagi. Datamu aman." actionLabel="Coba lagi" onAction={retry} />;
  } else if (demo === 'loading') {
    body = (
      <View style={styles.skeleton} accessibilityLabel="Memuat Coach" aria-busy>
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
      <TabHeader title="Coach" subtitle="Gambaran jujur soal kesehatan keuanganmu" />
      <Tabs
        variant="underline"
        accessibilityLabel="Bagian Coach"
        value={tab}
        onChange={setTab}
        items={[
          { key: 'score', label: 'Skor' },
          { key: 'recap', label: 'Recap' },
          { key: 'ask', label: 'Tanya Coach' },
        ]}
      />
      {body}
    </Screen>
  );
}

const styles = StyleSheet.create({
  skeleton: { gap: space.lg },
});

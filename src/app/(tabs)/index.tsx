import { Activity, LayoutGrid, Sparkles } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';

import { CaptureSheet } from '@/components/shell/CaptureSheet';
import { captureOptions, moreOptions } from '@/components/shell/captureOptions';
import { usePaywall } from '@/components/shell/Paywall';
import { Screen } from '@/components/shell/Screen';
import { EmptyState, PromoCard, QuickActions, SwipeDismiss } from '@/components/ui';
import { AccountDeck } from '@/features/home/AccountDeck';
import { BalanceBlock } from '@/features/home/BalanceBlock';
import { MissingRatesBanner } from '@/features/fx/MissingRatesBanner';
import { HomeHeader } from '@/features/home/HomeHeader';
import { HomeSkeleton } from '@/features/home/HomeSkeleton';
import { PeriodStats } from '@/features/home/PeriodStats';
import { RecentTransactions } from '@/features/home/RecentTransactions';
import { useSessionDismiss } from '@/features/home/sessionDismiss';
import { useT } from '@/i18n';
import { useStore } from '@/state/AppStore';
import { useLoadState } from '@/state/loadState';
import { useLedger } from '@/state/derived';
import { useNetWorth, useNetWorthSnapshot } from '@/state/netWorth';
import { useLimits } from '@/state/limits';
import { useRetry } from '@/state/useRetry';

export default function HomeScreen() {
  const router = useRouter();
  const demo = useLoadState();
  const retry = useRetry();
  const { refreshing } = useStore();
  const paywall = usePaywall();
  const limits = useLimits();
  const { state, dispatch } = useStore();
  const ledger = useLedger();
  const netWorth = useNetWorth();
  useNetWorthSnapshot(netWorth);
  const [recapGone, dismissRecap] = useSessionDismiss('weekly_recap');
  const t = useT();
  const [more, setMore] = useState(false);
  const capture = captureOptions(limits, t);
  const moreItems = moreOptions(limits, t);
  const scan = capture.find((o) => o.key === 'scan')!;
  const voice = capture.find((o) => o.key === 'voice')!;
  const openCapture = (o: typeof scan) => (o.limited ? paywall(o.reason) : router.push(o.href));

  if (demo === 'error') {
    return (
      <Screen tabs>
        <HomeHeader />
        <EmptyState kind="error" title={t('home.error.title')} message={t('home.error.message')} actionLabel={t('common.retry')} onAction={retry} />
      </Screen>
    );
  }

  if (demo === 'loading') {
    return (
      <Screen tabs>
        <HomeHeader />
        <HomeSkeleton />
      </Screen>
    );
  }

  return (
    <Screen tabs onRefresh={retry} refreshing={refreshing}>
      <HomeHeader />
      <BalanceBlock amount={state.includeAssets ? netWorth.total : netWorth.total - netWorth.assets} currency={netWorth.currency} accountCount={ledger.accounts.length} complete={netWorth.complete} />
      <AccountDeck
        accounts={ledger.accounts}
        hidden={state.hideBalance}
        limitReached={limits.accounts}
        activeId={state.activeAccountId}
        onActiveChange={(id) => dispatch({ type: 'account/setActive', id })}
      />
      <QuickActions
        actions={[
          { key: 'scan', label: t('home.quick.scan'), icon: scan.icon, primary: true, onPress: () => openCapture(scan) },
          { key: 'voice', label: voice.short, icon: voice.icon, onPress: () => openCapture(voice) },
          { key: 'coach', label: t('home.quick.coach'), icon: Activity, onPress: () => router.push('/coach') },
          { key: 'more', label: t('home.quick.more'), icon: LayoutGrid, onPress: () => setMore(true) },
        ]}
      />
      <MissingRatesBanner />
      {ledger.transactions.length > 0 && (
        <PeriodStats transactions={ledger.transactions} currency={ledger.mainCurrency} hidden={state.hideBalance} />
      )}
      <CaptureSheet
        visible={more}
        onClose={() => setMore(false)}
        title={t('home.more.title')}
        subtitle={t('home.more.subtitle')}
        sections={[
          { key: 'log', title: t('home.more.sectionLog'), keys: ['docscan', 'pdf', 'manual'] },
          { key: 'business', title: t('home.more.sectionBusiness'), extras: moreItems },
        ]}
      />
      {state.notifPrefs.weekly_recap && ledger.transactions.length > 0 && !recapGone && (
        <SwipeDismiss onDismiss={dismissRecap} actionLabel={t('home.recapDismiss')}>
          <PromoCard icon={Sparkles} title={t('home.recapTitle')} message={t('home.recapMessage')} onPress={() => router.push('/coach')} />
        </SwipeDismiss>
      )}
      <RecentTransactions transactions={ledger.transactions} accounts={ledger.accounts} mainCurrency={ledger.mainCurrency} />
    </Screen>
  );
}

import { Sparkles } from 'lucide-react-native';
import { useRouter } from 'expo-router';

import { captureOptions } from '@/components/shell/captureOptions';
import { usePaywall } from '@/components/shell/Paywall';
import { Screen } from '@/components/shell/Screen';
import { EmptyState, PromoCard, QuickActions } from '@/components/ui';
import { AccountsRail } from '@/features/home/AccountsRail';
import { BalanceBlock } from '@/features/home/BalanceBlock';
import { BudgetGlance } from '@/features/home/BudgetGlance';
import { HealthGlance } from '@/features/home/HealthGlance';
import { HomeHeader } from '@/features/home/HomeHeader';
import { HomeSkeleton } from '@/features/home/HomeSkeleton';
import { RecentTransactions } from '@/features/home/RecentTransactions';
import { useT } from '@/i18n';
import { useStore } from '@/state/AppStore';
import { useLoadState } from '@/state/loadState';
import { useBudget, useHealth, useLedger } from '@/state/derived';
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
  const budget = useBudget();
  const health = useHealth();
  const t = useT();
  const options = captureOptions(limits, t);

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
      <BalanceBlock amount={ledger.netWorth} currency={ledger.mainCurrency} accountCount={ledger.accounts.length} />
      <AccountsRail
        accounts={ledger.accounts}
        hidden={state.hideBalance}
        limitReached={limits.accounts}
        activeId={state.activeAccountId}
        onActiveChange={(id) => dispatch({ type: 'account/setActive', id })}
        onPressAccount={(id) => router.navigate({ pathname: '/transaksi', params: { akun: id } })}
      />
      <QuickActions
        actions={options.map((o, i) => ({
          key: o.key,
          label: o.short,
          icon: o.icon,
          primary: i === 0,
          onPress: () => (o.limited ? paywall(o.reason) : router.push(o.href)),
        }))}
      />
      {state.notifPrefs.weekly_recap && ledger.transactions.length > 0 && (
        <PromoCard icon={Sparkles} title={t('home.recapTitle')} message={t('home.recapMessage')} onPress={() => router.navigate('/coach')} />
      )}
      {ledger.transactions.length > 0 && (
        <BudgetGlance
          period={budget.period}
          pace={budget.flexPace}
          safePerDay={budget.safePerDay}
          spent={budget.flexSpent}
          limit={budget.flexLimit}
          currency={ledger.mainCurrency}
          onPress={() => router.navigate('/anggaran')}
        />
      )}
      {ledger.transactions.length > 0 && <HealthGlance score={health.score} delta={health.delta} onPress={() => router.navigate('/coach')} />}
      <RecentTransactions transactions={ledger.transactions} accounts={ledger.accounts} mainCurrency={ledger.mainCurrency} />
    </Screen>
  );
}

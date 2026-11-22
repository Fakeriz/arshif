import { Activity, CalendarRange, LayoutGrid } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { CaptureSheet } from '@/components/shell/CaptureSheet';
import { captureOptions, moreOptions } from '@/components/shell/captureOptions';
import { usePaywall } from '@/components/shell/Paywall';
import { Screen } from '@/components/shell/Screen';
import { EmptyState, Group, PromoCard, QuickActions, SwipeDismiss } from '@/components/ui';
import { useScanSource } from '@/components/shell/ScanSourceSheet';
import { AccountDeck } from '@/features/home/AccountDeck';
import { BalanceBlock } from '@/features/home/BalanceBlock';
import { MissingRatesBanner } from '@/features/fx/MissingRatesBanner';
import { DESKTOP_WIDE, GridCell, GridRow } from '@/components/shell/DesktopGrid';
import { HomeDesktopTitle } from '@/features/home/HomeDesktop';
import { HomeHeader } from '@/features/home/HomeHeader';
import { HomeSheet } from '@/features/home/HomeSheet';
import { HomeSkeleton } from '@/features/home/HomeSkeleton';
import { PeriodStats } from '@/features/home/PeriodStats';
import { RecentTransactions } from '@/features/home/RecentTransactions';
import { useSessionDismiss } from '@/features/home/sessionDismiss';
import { takeProOffer } from '@/features/billing/proOffer';
import { useDesktop } from '@/hooks/useDesktop';
import { useT } from '@/i18n';
import { useStore } from '@/state/AppStore';
import { useLoadState } from '@/state/loadState';
import { useLedger } from '@/state/derived';
import { useNetWorth, useNetWorthSnapshot } from '@/state/netWorth';
import { useLimits } from '@/state/limits';
import { useRetry } from '@/state/useRetry';
import { INK_BASE, InkScope, useTheme } from '@/theme/ThemeProvider';
import { layout, space } from '@/theme/tokens';

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
  const scanSource = useScanSource();
  const openCapture = (o: typeof scan) => (o.limited ? paywall(o.reason) : o.key === 'scan' ? scanSource() : router.push(o.href));
  const desktop = useDesktop();
  const { scheme } = useTheme();
  // Desktop: avatar dan lonceng sudah di nav atas, jadi header ponsel diganti judul halaman.
  const header = desktop ? <HomeDesktopTitle /> : <HomeHeader />;

  // Baru selesai setup: tawarkan Pro sekali, setelah Beranda sempat terlihat (bukan sebelum login).
  useEffect(() => {
    if (!takeProOffer() || state.plan !== 'free') return;
    const id = setTimeout(() => router.push({ pathname: '/premium', params: { alasan: t('billing.premium.welcome') } }), 700);
    return () => clearTimeout(id);
    // Hanya saat Beranda pertama dipasang.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (demo === 'error') {
    return (
      <Screen tabs>
        {header}
        <EmptyState kind="error" title={t('home.error.title')} message={t('home.error.message')} actionLabel={t('common.retry')} onAction={retry} />
      </Screen>
    );
  }

  if (demo === 'loading') {
    return (
      <Screen tabs>
        {header}
        <HomeSkeleton />
      </Screen>
    );
  }

  const balance = (style?: ViewStyle) => (
    <BalanceBlock style={style} amount={state.includeAssets ? netWorth.total : netWorth.total - netWorth.assets} currency={netWorth.currency} accountCount={ledger.accounts.length} complete={netWorth.complete} />
  );
  const deck = (
    <AccountDeck
      accounts={ledger.accounts}
      hidden={state.hideBalance}
      limitReached={limits.accounts}
      activeId={state.activeAccountId}
      onActiveChange={(id) => dispatch({ type: 'account/setActive', id })}
      defaultOpen={desktop}
    />
  );
  const quick = (
    <QuickActions
      actions={[
        { key: 'scan', label: t('home.quick.scan'), icon: scan.icon, primary: true, onPress: () => openCapture(scan) },
        { key: 'voice', label: voice.short, icon: voice.icon, onPress: () => openCapture(voice) },
        { key: 'coach', label: t('home.quick.coach'), icon: Activity, onPress: () => router.push('/coach') },
        { key: 'more', label: t('home.quick.more'), icon: LayoutGrid, onPress: () => setMore(true) },
      ]}
    />
  );
  const stats = ledger.transactions.length > 0 && (
    <PeriodStats transactions={ledger.transactions} currency={ledger.mainCurrency} hidden={state.hideBalance} />
  );
  const moreSheet = (
    <CaptureSheet
      visible={more}
      onClose={() => setMore(false)}
      title={t('home.more.title')}
      subtitle={t('home.more.subtitle')}
      sections={[
        { key: 'log', title: t('home.more.sectionLog'), keys: ['pdf', 'manual'] },
        { key: 'business', title: t('home.more.sectionBusiness'), extras: moreItems },
      ]}
    />
  );
  const recap = state.notifPrefs.weekly_recap && ledger.transactions.length > 0 && !recapGone && (
    <SwipeDismiss onDismiss={dismissRecap} actionLabel={t('home.recapDismiss')}>
      <PromoCard icon={CalendarRange} title={t('home.recapTitle')} message={t('home.recapMessage')} onPress={() => router.push('/coach')} />
    </SwipeDismiss>
  );
  const recent = <RecentTransactions transactions={ledger.transactions} accounts={ledger.accounts} mainCurrency={ledger.mainCurrency} />;

  if (desktop) {
    // Grid 5 + 7 ala Talmo: kartu tinta (titik fokus) kiri atas, angka periode dan aksi di sampingnya,
    // lalu daftar transaksi lebar dengan kartu akun dan recap di kolom sempit.
    return (
      <Screen tabs maxWidth={DESKTOP_WIDE} onRefresh={retry} refreshing={refreshing}>
        {header}
        <GridRow>
          <GridCell span={5} order={0}>
            {balance({ flex: 1, justifyContent: 'center' })}
          </GridCell>
          <GridCell span={7} order={1}>
            {quick}
            {stats}
          </GridCell>
        </GridRow>
        <MissingRatesBanner />
        <GridRow>
          <GridCell span={7} order={2}>
            {recent}
          </GridCell>
          <GridCell span={5} order={3}>
            {/* Berlabel seperti "Transaksi terakhir" agar kedua kolom mulai sejajar. */}
            <Group label={t('settings.accounts.title')}>{deck}</Group>
            {recap}
          </GridCell>
        </GridRow>
        {moreSheet}
      </Screen>
    );
  }

  // Ponsel: lembar kertas (sapaan, kekayaan bersih, pemasukan/pengeluaran, aksi cepat) di atas dasar tinta
  // yang memuat akun dan transaksi. Pemasukan/pengeluaran sudah di lembar, jadi PeriodStats tidak diulang.
  const netAmount = state.includeAssets ? netWorth.total : netWorth.total - netWorth.assets;
  return (
    <Screen tabs bare background={INK_BASE[scheme]} onRefresh={retry} refreshing={refreshing}>
      <HomeSheet
        amount={netAmount}
        currency={netWorth.currency}
        accountCount={ledger.accounts.length}
        transactions={ledger.transactions}
        actions={[
          { key: 'scan', label: t('home.quick.scan'), icon: scan.icon, onPress: () => openCapture(scan) },
          { key: 'voice', label: voice.short, icon: voice.icon, onPress: () => openCapture(voice) },
          { key: 'coach', label: t('home.quick.coach'), icon: Activity, onPress: () => router.push('/coach') },
          { key: 'more', label: t('home.quick.more'), icon: LayoutGrid, onPress: () => setMore(true) },
        ]}
      />
      <InkScope style={styles.ink}>
        <View style={styles.inkColumn}>
          {deck}
          <MissingRatesBanner />
          {recap}
          {recent}
        </View>
      </InkScope>
      {moreSheet}
    </Screen>
  );
}

const styles = StyleSheet.create({
  ink: { flexGrow: 1, alignItems: 'center', paddingHorizontal: space.lg, paddingTop: space.md },
  inkColumn: { width: '100%', maxWidth: layout.maxContentWidth, gap: space.lg },
});

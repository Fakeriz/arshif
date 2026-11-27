import { useRouter } from 'expo-router';
import { Clock, CreditCard, TriangleAlert, Wallet } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { DESKTOP_WIDE, GridCell, GridRow } from '@/components/shell/DesktopGrid';
import { Screen } from '@/components/shell/Screen';
import { HeaderMenu } from '@/components/shell/HeaderActions';
import { TabHeader } from '@/components/shell/TabHeader';
import { AppText, AssetIcon, BalanceText, Card, CurrencyText, EmptyState, Group, Icon, ListCard, ListItem, Skeleton, StatTile, Toggle, TrendBadge } from '@/components/ui';
import { AssetForm } from '@/features/assets/AssetForm';
import { NetWorthChart } from '@/features/assets/NetWorthChart';
import { priceLabel, quantityLabel } from '@/features/assets/view';
import { MissingRatesBanner } from '@/features/fx/MissingRatesBanner';
import { AddButton } from '@/features/planning/kit';
import { useDesktop } from '@/hooks/useDesktop';
import { useI18n } from '@/i18n';
import { changeSince, gainOf, isLiveType, livePricesDown, snapshotTrend, valuationIn, valueAsset } from '@/lib/assets';
import { pctChange } from '@/lib/chart';
import { isCreditType } from '@/lib/credit';
import { shortDate, todayYmd } from '@/lib/dates';
import { tryConvert } from '@/lib/fx';
import { formatMoney } from '@/lib/money';
import { useStore } from '@/state/AppStore';
import { useAssets } from '@/state/assets';
import { useLimits } from '@/state/limits';
import { useNetWorth, useNetWorthSnapshot } from '@/state/netWorth';
import { usePlanning } from '@/state/planning';
import { InkCard, useTheme } from '@/theme/ThemeProvider';
import { layout, radius, space } from '@/theme/tokens';

/** Tab Aset: kekayaan bersih dan rinciannya (brief Fase Aset §6). Angka total sama dengan Home. */
export default function AsetScreen() {
  const { t, lang } = useI18n();
  const router = useRouter();
  const { colors } = useTheme();
  const { state, dispatch, reload: storeReload, refreshing: storeRefreshing } = useStore();
  const limits = useLimits();
  const planning = usePlanning();
  const { assets, prices, snapshots, status, refreshing: assetsRefreshing, pendingPriceKeys, reload } = useAssets();
  const nw = useNetWorth();
  useNetWorthSnapshot(nw);
  const [form, setForm] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const openForm = () => {
    setFormKey((k) => k + 1);
    setForm(true);
  };
  const now = Date.now();
  const currency = nw.currency;
  const today = todayYmd();
  const change = changeSince(snapshots, nw.total, today, currency);
  const assetTrend = snapshotTrend(snapshots, 'assetsTotal', nw.assetsTotal, today, currency);
  const debtTrend = snapshotTrend(snapshots, 'liabilitiesTotal', nw.liabilitiesTotal, today, currency);
  const activeDebts = planning.debts.filter((d) => d.status === 'active' && d.kind === 'debt');
  const hasCredit = state.accounts.some((a) => isCreditType(a.type));
  const cashCount = state.accounts.filter((a) => !isCreditType(a.type)).length;

  const desktop = useDesktop();

  const refresh = () => {
    void storeReload();
    void reload();
    void planning.reload();
  };

  // Satu kartu tinta per layar: angka terpenting Aset (docs/design.md 2.4).
  const hero = (
    <InkCard style={styles.hero}>
      <AppText variant="caption" tone="secondary">
        {t('assets.netWorth')}
      </AppText>
      <BalanceText amount={nw.total} currency={currency} hidden={state.hideBalance} />
      {change && !state.hideBalance && (
        <>
          <TrendBadge value={pctChange(nw.total - change.amount, nw.total)} />
          <AppText variant="caption" tone="muted" align="center">
            {t('assets.change', { amount: formatMoney(change.amount, currency, 'always'), date: shortDate(change.since, lang) })}
          </AppText>
        </>
      )}
    </InkCard>
  );
  const tiles = (
    <View style={styles.tiles}>
      <StatTile
        label={t('assets.totalAssets')}
        icon={Wallet}
        amount={nw.assetsTotal}
        currency={currency}
        change={assetTrend.change}
        series={assetTrend.series}
        hidden={state.hideBalance}
      />
      <StatTile
        label={t('assets.totalDebts')}
        icon={CreditCard}
        amount={nw.liabilitiesTotal}
        currency={currency}
        change={debtTrend.change}
        series={debtTrend.series}
        invert
        hidden={state.hideBalance}
      />
    </View>
  );
  const chart = (
    <Card style={desktop ? styles.fill : undefined}>
      <View style={[styles.cardBody, desktop && styles.fill]}>
        <AppText variant="h3">{t('assets.chartTitle')}</AppText>
        <NetWorthChart snapshots={snapshots} currency={currency} fill={desktop} hidden={state.hideBalance} />
      </View>
    </Card>
  );
  const liveActive = assets.filter((a) => isLiveType(a.type) && a.valueOverride === undefined);
  const allPendingNew =
    liveActive.length > 0 &&
    liveActive.every((a) => Boolean(a.priceKey && pendingPriceKeys.includes(a.priceKey) && !prices[a.priceKey]));
  const banners = (
    <>
      <MissingRatesBanner />
      {allPendingNew ? (
        <Card accessibilityLabel={t('assets.pricesPendingTitle')}>
          <View style={styles.banner}>
            <Icon icon={Clock} color={colors.info} />
            <View style={styles.flex}>
              <AppText variant="bodyStrong">{t('assets.pricesPendingTitle')}</AppText>
              <AppText variant="caption" tone="secondary">
                {t('assets.pricesPendingMessage')}
              </AppText>
            </View>
          </View>
        </Card>
      ) : (
        livePricesDown(assets, prices, now) && (
          <Card accessibilityLabel={t('assets.pricesDownTitle')}>
            <View style={styles.banner}>
              <Icon icon={TriangleAlert} color={colors.warning} />
              <View style={styles.flex}>
                <AppText variant="bodyStrong">{t('assets.pricesDownTitle')}</AppText>
                <AppText variant="caption" tone="secondary">
                  {t('assets.pricesDownMessage')}
                </AppText>
              </View>
            </View>
          </Card>
        )
      )}
    </>
  );
  const assetsGroup = (
    <Group
      label={t('assets.sectionAssets')}
    >
      <ListCard>
        <ListItem
          leading={<AssetIcon kind="cash" />}
          title={t('assets.cash')}
          subtitle={t('assets.cashMeta', { count: cashCount })}
          trailing={<CurrencyText amount={nw.cash} currency={currency} kind="balance" hidden={state.hideBalance} />}
          onPress={() => router.push('/pengaturan/akun')}
          chevron
          divider={assets.length > 0 || nw.receivables > 0}
        />
        {nw.receivables > 0 && (
          <ListItem
            leading={<AssetIcon kind="receivables" />}
            title={t('assets.receivables')}
            trailing={<CurrencyText amount={nw.receivables} currency={currency} kind="balance" hidden={state.hideBalance} />}
            onPress={() => router.push('/rencana/utang')}
            chevron
            divider={assets.length > 0}
          />
        )}
        {assets.map((a, i) => {
          const v = valueAsset(a, prices, now);
          const main = valuationIn(v, currency);
          const qty = quantityLabel(a, t, lang);
          const gain = gainOf(a, v);
          const gainMain = gain ? tryConvert(gain.amount, a.currency, currency) : null;
          const trailing =
            main === null ? undefined : gainMain !== null && !state.hideBalance ? (
              <View style={styles.assetTrailing}>
                <CurrencyText amount={main} currency={currency} kind="balance" hidden={state.hideBalance} />
                <AppText variant="caption" tone={gainMain > 0 ? 'positive' : gainMain < 0 ? 'negative' : 'muted'} numeric>
                  {formatMoney(gainMain, currency, 'always')}
                </AppText>
              </View>
            ) : (
              <CurrencyText amount={main} currency={currency} kind="balance" hidden={state.hideBalance} />
            );
          return (
            <ListItem
              key={a.id}
              leading={<AssetIcon asset={a} />}
              title={a.name}
              subtitle={[qty, priceLabel(a, v, t, lang, now)].filter(Boolean).join(' · ')}
              subtitleLines={2}
              trailing={trailing}
              onPress={() => router.push(`/aset/${a.id}`)}
              chevron
              divider={i < assets.length - 1}
            />
          );
        })}
      </ListCard>
      {assets.length === 0 && <EmptyState compact title={t('assets.emptyTitle')} message={t('assets.emptyMessage')} />}
      {nw.unvalued > 0 && (
        <AppText variant="caption" tone="secondary">
          {t('assets.unvalued', { count: nw.unvalued })}
        </AppText>
      )}
    </Group>
  );
  const debtsGroup = (
    <Group label={t('assets.sectionDebts')}>
      <ListCard>
        {!hasCredit && activeDebts.length === 0 ? (
          <AppText variant="body" tone="secondary" style={styles.note}>
            {t('assets.noDebts')}
          </AppText>
        ) : (
          <>
            {hasCredit && (
              <ListItem
                leading={<AssetIcon kind="credit" />}
                title={t('assets.credit')}
                trailing={<CurrencyText amount={nw.credit} currency={currency} kind="balance" hidden={state.hideBalance} />}
                onPress={() => router.push('/pengaturan/akun')}
                chevron
                divider={activeDebts.length > 0}
              />
            )}
            {activeDebts.length > 0 && (
              <ListItem
                leading={<AssetIcon kind="debts" />}
                title={t('assets.debts')}
                subtitle={t('assets.debtsMeta', { count: activeDebts.length })}
                trailing={<CurrencyText amount={nw.debts} currency={currency} kind="balance" hidden={state.hideBalance} />}
                onPress={() => router.push('/rencana/utang')}
                chevron
              />
            )}
          </>
        )}
      </ListCard>
    </Group>
  );

  return (
    <Screen
      tabs
      maxWidth={desktop ? DESKTOP_WIDE : undefined}
      onRefresh={status === 'ready' ? refresh : undefined}
      refreshing={storeRefreshing || assetsRefreshing}
    >
      <TabHeader
        title={t('shell.assets.title')}
        subtitle={t('shell.assets.subtitle')}
        right={
          // Tambah aset + pengaturan tampilan aset (menu titik tiga), bukan di tengah layar.
          <View style={styles.headerRight}>
            {status === 'ready' && <AddButton label={t('assets.add')} limited={limits.assets} reason={t('assets.limitReason')} onPress={openForm} />}
            <HeaderMenu>
              {() => (
                <ListItem
                  title={t('settings.includeAssets')}
                  subtitle={t('settings.includeAssetsSub')}
                  subtitleLines={2}
                  trailing={<Toggle value={state.includeAssets} onChange={(value) => dispatch({ type: 'prefs/includeAssets', value })} accessibilityLabel={t('settings.includeAssets')} />}
                />
              )}
            </HeaderMenu>
          </View>
        }
      />
      {status === 'error' ? (
        <EmptyState kind="error" title={t('assets.loadErrorTitle')} message={t('assets.loadErrorMessage')} actionLabel={t('common.retry')} onAction={refresh} />
      ) : status !== 'ready' ? (
        <View style={styles.skeleton} accessibilityLabel={t('assets.loading')} aria-busy>
          <Skeleton height={96} radius={radius.lg} />
          <Skeleton height={160} radius={radius.lg} />
          <Skeleton height={200} radius={radius.lg} />
        </View>
      ) : (
        <>
          {desktop ? (
            // Desktop: kartu tinta + ringkasan di samping grafik kekayaan, lalu aset dan utang berdampingan.
            <>
              <GridRow>
                <GridCell span={5} order={0}>
                  {hero}
                  {tiles}
                </GridCell>
                <GridCell span={7} order={1}>
                  {chart}
                </GridCell>
              </GridRow>
              {banners}
              <GridRow style={styles.top}>
                <GridCell span={7} order={2}>
                  {assetsGroup}
                </GridCell>
                <GridCell span={5} order={3}>
                  {debtsGroup}
                </GridCell>
              </GridRow>
            </>
          ) : (
            <>
              {hero}
              {tiles}
              {chart}
              {banners}
              {assetsGroup}
              {debtsGroup}
            </>
          )}
          <AssetForm key={formKey} visible={form} onClose={() => setForm(false)} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  skeleton: { gap: space.lg },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  hero: { alignItems: 'center', gap: space.xs, borderRadius: radius.card, padding: layout.cardPadding, paddingVertical: space.xl },
  cardBody: { gap: space.md },
  banner: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  flex: { flex: 1, gap: space.xxs },
  // Setinggi baris ListItem supaya kartu kosong sama dengan kartu satu baris.
  note: { paddingVertical: 18 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  top: { alignItems: 'flex-start' },
  fill: { flex: 1 },
  assetTrailing: { alignItems: 'flex-end', gap: 2 },
});

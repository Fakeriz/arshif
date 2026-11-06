import { useRouter } from 'expo-router';
import { TriangleAlert, Wallet } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/shell/Screen';
import { TabHeader } from '@/components/shell/TabHeader';
import { AppText, BalanceText, Card, CurrencyText, EmptyState, Icon, ListItem, Skeleton } from '@/components/ui';
import { AssetForm } from '@/features/assets/AssetForm';
import { NetWorthChart } from '@/features/assets/NetWorthChart';
import { priceLabel, quantityLabel } from '@/features/assets/view';
import { MissingRatesBanner } from '@/features/fx/MissingRatesBanner';
import { AddButton, SectionLabel } from '@/features/planning/kit';
import { useI18n } from '@/i18n';
import { changeSince, livePricesDown, valueAsset } from '@/lib/assets';
import { isCreditType } from '@/lib/credit';
import { shortDate, todayYmd } from '@/lib/dates';
import { tryConvert } from '@/lib/fx';
import { formatMoney } from '@/lib/money';
import { useStore } from '@/state/AppStore';
import { useAssets } from '@/state/assets';
import { useLimits } from '@/state/limits';
import { useNetWorth, useNetWorthSnapshot } from '@/state/netWorth';
import { usePlanning } from '@/state/planning';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

/** Tab Aset: kekayaan bersih dan rinciannya (brief Fase Aset §6). Angka total sama dengan Home. */
export default function AsetScreen() {
  const { t, lang } = useI18n();
  const router = useRouter();
  const { colors } = useTheme();
  const { state } = useStore();
  const limits = useLimits();
  const planning = usePlanning();
  const { assets, prices, snapshots, status, reload } = useAssets();
  const nw = useNetWorth();
  useNetWorthSnapshot(nw);
  const [form, setForm] = useState(false);
  const now = Date.now();
  const currency = nw.currency;
  const change = changeSince(snapshots, nw.total, todayYmd(), currency);
  const activeDebts = planning.debts.filter((d) => d.status === 'active' && d.kind === 'debt');
  const hasCredit = state.accounts.some((a) => isCreditType(a.type));
  const cashCount = state.accounts.filter((a) => !isCreditType(a.type)).length;

  const refresh = () => {
    void reload();
    void planning.reload();
  };

  return (
    <Screen tabs onRefresh={status === 'ready' ? refresh : undefined}>
      <TabHeader title={t('shell.assets.title')} subtitle={t('shell.assets.subtitle')} />
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
          <View style={styles.hero}>
            <AppText variant="caption" tone="secondary">
              {t('assets.netWorth')}
            </AppText>
            <BalanceText amount={nw.total} currency={currency} hidden={state.hideBalance} />
            {change && !state.hideBalance && (
              <AppText variant="caption" tone="muted" align="center">
                {t('assets.change', { amount: formatMoney(change.amount, currency, 'always'), date: shortDate(change.since, lang) })}
              </AppText>
            )}
          </View>

          <Card>
            <View style={styles.cardBody}>
              <AppText variant="h3">{t('assets.chartTitle')}</AppText>
              <NetWorthChart snapshots={snapshots} currency={currency} />
            </View>
          </Card>

          <MissingRatesBanner />
          {livePricesDown(assets, prices, now) && (
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
          )}

          <View style={styles.sectionRow}>
            <SectionLabel>{t('assets.sectionAssets')}</SectionLabel>
            <AddButton label={t('assets.add')} limited={limits.assets} reason={t('assets.limitReason')} onPress={() => setForm(true)} />
          </View>
          <Card padding="md">
            <ListItem
              title={t('assets.cash')}
              subtitle={t('assets.cashMeta', { count: cashCount })}
              leading={<Icon icon={Wallet} color={colors.textSecondary} />}
              trailing={<CurrencyText amount={nw.cash} currency={currency} kind="balance" hidden={state.hideBalance} />}
              divider={assets.length > 0 || nw.receivables > 0}
            />
            {nw.receivables > 0 && (
              <ListItem
                title={t('assets.receivables')}
                trailing={<CurrencyText amount={nw.receivables} currency={currency} kind="balance" hidden={state.hideBalance} />}
                onPress={() => router.push('/rencana/utang')}
                chevron
                divider={assets.length > 0}
              />
            )}
            {assets.map((a, i) => {
              const v = valueAsset(a, prices, now);
              const main = v.value === null ? null : tryConvert(v.value, v.currency, currency);
              const qty = quantityLabel(a, t, lang);
              return (
                <ListItem
                  key={a.id}
                  title={a.name}
                  subtitle={[qty, priceLabel(v, t, lang)].filter(Boolean).join(' · ')}
                  trailing={main === null ? undefined : <CurrencyText amount={main} currency={currency} kind="balance" hidden={state.hideBalance} />}
                  onPress={() => router.push(`/aset/${a.id}`)}
                  chevron
                  divider={i < assets.length - 1}
                />
              );
            })}
          </Card>
          {assets.length === 0 && (
            <EmptyState compact title={t('assets.emptyTitle')} message={t('assets.emptyMessage')} />
          )}
          {nw.unvalued > 0 && (
            <AppText variant="caption" tone="secondary">
              {t('assets.unvalued', { count: nw.unvalued })}
            </AppText>
          )}
          <TotalRow label={t('assets.totalAssets')} amount={nw.assetsTotal} currency={currency} hidden={state.hideBalance} />

          <SectionLabel>{t('assets.sectionDebts')}</SectionLabel>
          <Card padding="md">
            {!hasCredit && activeDebts.length === 0 ? (
              <AppText variant="body" tone="secondary">
                {t('assets.noDebts')}
              </AppText>
            ) : (
              <>
                {hasCredit && (
                  <ListItem
                    title={t('assets.credit')}
                    trailing={<CurrencyText amount={nw.credit} currency={currency} kind="balance" hidden={state.hideBalance} />}
                    divider={activeDebts.length > 0}
                  />
                )}
                {activeDebts.length > 0 && (
                  <ListItem
                    title={t('assets.debts')}
                    subtitle={t('assets.debtsMeta', { count: activeDebts.length })}
                    trailing={<CurrencyText amount={nw.debts} currency={currency} kind="balance" hidden={state.hideBalance} />}
                    onPress={() => router.push('/rencana/utang')}
                    chevron
                  />
                )}
              </>
            )}
          </Card>
          <TotalRow label={t('assets.totalDebts')} amount={nw.liabilitiesTotal} currency={currency} hidden={state.hideBalance} />

          <AssetForm key={form ? 'open' : 'closed'} visible={form} onClose={() => setForm(false)} />
        </>
      )}
    </Screen>
  );
}

function TotalRow({ label, amount, currency, hidden }: { label: string; amount: number; currency: string; hidden: boolean }) {
  return (
    <View style={styles.total}>
      <AppText variant="bodyStrong">{label}</AppText>
      <CurrencyText amount={amount} currency={currency} kind="balance" variant="bodyStrong" hidden={hidden} />
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: { gap: space.lg },
  hero: { alignItems: 'center', gap: space.xs, paddingVertical: space.sm },
  cardBody: { gap: space.md },
  banner: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  flex: { flex: 1, gap: space.xxs },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  total: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: space.xs },
});

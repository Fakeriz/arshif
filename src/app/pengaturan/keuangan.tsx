import { useRouter } from 'expo-router';
import { useState } from 'react';

import { CurrencySheet } from '@/components/shell/CurrencySheet';
import { Card, ListItem, Toggle, useToast } from '@/components/ui';
import { SettingsScreen } from '@/features/settings/kit';
import { PaydaySheet } from '@/features/settings/PaydaySheet';
import { useT } from '@/i18n';
import { rebaseBudget } from '@/lib/budget';
import { currencyMeta } from '@/lib/money';
import { useStore } from '@/state/AppStore';

export default function KeuanganScreen() {
  const t = useT();
  const router = useRouter();
  const { state, dispatch } = useStore();
  const { show } = useToast();
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [paydayOpen, setPaydayOpen] = useState(false);
  return (
    <SettingsScreen title={t('settings.menu.finance')}>
      <Card padding="md">
        <ListItem
          title={t('settings.mainCurrency')}
          subtitle={t('settings.mainCurrencySub')}
          subtitleLines={2}
          trailing={currencyMeta(state.mainCurrency).code}
          chevron
          divider
          onPress={() => setCurrencyOpen(true)}
        />
        <ListItem
          title={t('settings.payday.title')}
          subtitle={t('settings.payday.rowSub')}
          subtitleLines={2}
          trailing={t('settings.payday.value', { day: state.payday })}
          chevron
          divider
          onPress={() => setPaydayOpen(true)}
        />
        <ListItem
          title={t('acct.rates.title')}
          subtitle={t('acct.rates.rowSub')}
          subtitleLines={2}
          trailing={state.userRates.length ? String(state.userRates.length) : undefined}
          chevron
          divider
          onPress={() => router.push('/kurs-saya')}
        />
        <ListItem
          title={t('settings.hideBalance')}
          subtitle={t('settings.hideBalanceSub')}
          subtitleLines={2}
          trailing={<Toggle value={state.hideBalance} onChange={(value) => dispatch({ type: 'prefs/hideBalance', value })} accessibilityLabel={t('settings.hideBalance')} />}
          divider
        />
        <ListItem
          title={t('settings.includeAssets')}
          subtitle={t('settings.includeAssetsSub')}
          subtitleLines={2}
          trailing={<Toggle value={state.includeAssets} onChange={(value) => dispatch({ type: 'prefs/includeAssets', value })} accessibilityLabel={t('settings.includeAssets')} />}
        />
      </Card>
      <PaydaySheet visible={paydayOpen} value={state.payday} onClose={() => setPaydayOpen(false)} onChange={(payday) => dispatch({ type: 'prefs/payday', payday })} />
      <CurrencySheet visible={currencyOpen} value={state.mainCurrency} onClose={() => setCurrencyOpen(false)} onSelect={(code) => {
          const rebased = rebaseBudget(state.income, state.budgets, state.mainCurrency, code);
          if (!rebased) {
            show({ tone: 'error', title: t('settings.mainCurrencyNoRate', { code }) });
            return;
          }
          dispatch({ type: 'prefs/mainCurrency', code, ...rebased });
        }} />
    </SettingsScreen>
  );
}

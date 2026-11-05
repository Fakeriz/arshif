import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/shell/Screen';
import { ScreenHeader } from '@/components/shell/ScreenHeader';
import { AppText, Button, Chip } from '@/components/ui';
import { PeriodPicker } from '@/features/billing/PeriodPicker';
import { PlanCompare } from '@/features/billing/PlanCompare';
import { useT } from '@/i18n';
import { formatMoney } from '@/lib/money';
import { monthsFree, PRICES, type CheckoutCurrency } from '@/lib/pricing';
import { useSession } from '@/state/session';
import { space } from '@/theme/tokens';

const CURRENCIES: CheckoutCurrency[] = ['IDR', 'MYR', 'USD'];

/** Pricing publik (bisa dibuka tanpa login). Harga dari lib/pricing = cermin tabel prices di server. */
export default function PricingScreen() {
  const router = useRouter();
  const t = useT();
  const { session } = useSession();
  const [currency, setCurrency] = useState<CheckoutCurrency>('IDR');
  const p = PRICES[currency];
  return (
    <Screen>
      <ScreenHeader title={t('billing.pricing.title')} />
      <View style={styles.hero}>
        <AppText variant="h1" accessibilityRole="header">
          {t('billing.pricing.heading')}
        </AppText>
        <AppText variant="body" tone="secondary">
          {t('billing.pricing.subheading')}
        </AppText>
      </View>
      <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={t('billing.premium.currency')}>
        {CURRENCIES.map((c) => (
          <Chip key={c} label={c} selected={c === currency} onPress={() => setCurrency(c)} />
        ))}
      </View>
      <PeriodPicker
        label={t('billing.premium.choosePlan')}
        options={[
          { key: 'monthly', price: formatMoney(p.monthly, currency) },
          {
            key: 'yearly',
            price: formatMoney(p.yearly, currency),
            badge: t('billing.monthsFree', { months: monthsFree(currency) }),
            note: t('billing.yearlyEquiv', { amount: formatMoney(Math.round(p.yearly / 12), currency) }),
          },
        ]}
      />
      <Button
        label={session ? t('billing.pricing.seePremium') : t('billing.pricing.signIn')}
        fullWidth
        onPress={() => router.push(session ? '/premium' : '/masuk')}
      />
      <PlanCompare />
      <AppText variant="caption" tone="muted">
        {t('billing.pricing.globalNote')}
      </AppText>
      <AppText variant="caption" tone="muted">
        {t('billing.pricing.appNote')}
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { gap: space.sm, paddingTop: space.md },
  chips: { flexDirection: 'row', gap: space.sm },
});

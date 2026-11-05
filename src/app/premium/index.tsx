import { Crown, RotateCcw } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/shell/Screen';
import { ScreenHeader } from '@/components/shell/ScreenHeader';
import { AppText, Button, Card, Chip, Icon, useToast } from '@/components/ui';
import { FnError } from '@/data/remote/functions';
import { PeriodPicker, type PeriodOption } from '@/features/billing/PeriodPicker';
import { PlanCompare } from '@/features/billing/PlanCompare';
import { useI18n } from '@/i18n';
import { webCheckoutAllowed } from '@/lib/checkout';
import { isoDateLabel } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { openPaddleCheckout } from '@/lib/paddle';
import { checkoutCurrencyFor, monthsFree, PRICES, type CheckoutCurrency } from '@/lib/pricing';
import { buyPackage, loadStorePackages, restorePurchases, storeAvailable, type StorePackages } from '@/lib/purchases';
import { useStore } from '@/state/AppStore';
import { createCheckout, useSyncPlan } from '@/state/billing';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';

import { METHODS_BY_CURRENCY } from '../../../supabase/functions/_shared/billing';

type Period = 'monthly' | 'yearly';
const store = Platform.OS === 'ios' ? 'ios' : 'android';

/**
 * Premium (FR-PAY-1/2). Aplikasi: produk toko lewat RevenueCat + Pulihkan Pembelian.
 * Web (dan aplikasi di wilayah yang diizinkan feature flag): checkout Xendit (IDR/MYR) atau Paddle (USD).
 */
export default function PremiumScreen() {
  const router = useRouter();
  const { alasan } = useLocalSearchParams<{ alasan?: string }>();
  const { state } = useStore();
  const { t, lang } = useI18n();
  const { show } = useToast();
  const syncPlan = useSyncPlan();
  const { colors } = useTheme();

  const native = Platform.OS !== 'web';
  const storeOn = native && storeAvailable();
  const webOn = webCheckoutAllowed();
  // Paddle hanya web; di aplikasi (wilayah yang diizinkan) checkout web terbatas ke Xendit.
  const currencies: CheckoutCurrency[] = native ? ['IDR', 'MYR'] : ['IDR', 'MYR', 'USD'];
  const preferred = checkoutCurrencyFor(state.mainCurrency);

  const [period, setPeriod] = useState<Period>('yearly');
  const [currency, setCurrency] = useState<CheckoutCurrency>(currencies.includes(preferred) ? preferred : currencies[0]!);
  const [method, setMethod] = useState(METHODS_BY_CURRENCY[currency]![0]!);
  const [packages, setPackages] = useState<StorePackages | null>(null);
  const [storeError, setStoreError] = useState(false);
  const [busy, setBusy] = useState<'buy' | 'restore' | 'pay' | null>(null);
  const [payError, setPayError] = useState<string | null>(null);

  useEffect(() => {
    if (!storeOn) return;
    loadStorePackages().then(setPackages).catch(() => setStoreError(true));
  }, [storeOn]);

  const premium = state.plan === 'premium';
  const price = PRICES[currency];
  const webOptions: PeriodOption[] = [
    { key: 'monthly', price: formatMoney(price.monthly, currency) },
    {
      key: 'yearly',
      price: formatMoney(price.yearly, currency),
      badge: t('billing.monthsFree', { months: monthsFree(currency) }),
      note: t('billing.yearlyEquiv', { amount: formatMoney(Math.round(price.yearly / 12), currency) }),
    },
  ];
  const storeOptions: PeriodOption[] = packages
    ? (['monthly', 'yearly'] as const).flatMap((k) => (packages[k] ? [{ key: k, price: packages[k]!.price }] : []))
    : [];

  const afterPurchase = async () => {
    const r = await syncPlan();
    if (r.plan === 'premium') router.replace('/premium/sukses');
  };

  const buy = async () => {
    const pkg = packages?.[period];
    if (!pkg) return;
    setBusy('buy');
    try {
      if ((await buyPackage(pkg.pkg)) === 'purchased') await afterPurchase();
    } catch {
      show({ tone: 'error', title: t('billing.premium.errors.purchase') });
    } finally {
      setBusy(null);
    }
  };

  const restore = async () => {
    setBusy('restore');
    try {
      await restorePurchases();
      const r = await syncPlan();
      show(r.plan === 'premium' ? { tone: 'success', title: t('billing.premium.restored') } : { tone: 'info', title: t('billing.premium.restoreNone') });
    } catch {
      show({ tone: 'error', title: t('billing.premium.errors.network') });
    } finally {
      setBusy(null);
    }
  };

  const pay = async () => {
    setBusy('pay');
    setPayError(null);
    try {
      const r = await createCheckout({ period, currency, method });
      const statusPath = `/premium/order/${r.orderId}`;
      if (r.provider === 'xendit' && r.checkoutUrl) {
        if (Platform.OS === 'web') {
          window.location.assign(r.checkoutUrl);
          return;
        }
        await WebBrowser.openBrowserAsync(r.checkoutUrl);
      } else if (r.provider === 'paddle' && r.transactionId) {
        await openPaddleCheckout(r.transactionId, `${window.location.origin}${statusPath}`);
      }
      router.push({ pathname: '/premium/order/[id]', params: { id: r.orderId } });
    } catch (e) {
      const code = e instanceof FnError ? e.code : 'generic';
      const known = ['not_configured', 'provider_error', 'rate_limited', 'network'] as const;
      setPayError(t(`billing.premium.errors.${(known as readonly string[]).includes(code) ? (code as (typeof known)[number]) : 'generic'}`));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen>
      <ScreenHeader title={t('billing.premium.title')} />
      <View style={styles.hero}>
        <AppText variant="body" tone="secondary" align="center">
          {alasan || t('billing.premium.subtitle')}
        </AppText>
      </View>

      {premium && (
        <Card>
          <View style={styles.activeHead}>
            <Icon icon={Crown} color={colors.accentText} />
            <AppText variant="h3">{t('billing.premium.activeTitle')}</AppText>
          </View>
          <AppText variant="body" tone="secondary">
            {state.premiumUntil ? t('billing.premium.activeUntil', { date: isoDateLabel(state.premiumUntil, lang) }) : t('billing.premium.activeNoEnd')}
          </AppText>
          {state.premiumSource === 'store' && (
            <AppText variant="caption" tone="muted">
              {t('billing.premium.activeStore', { store: t(`billing.store.${store}`) })}
            </AppText>
          )}
        </Card>
      )}

      {storeOn && !(premium && state.premiumSource === 'store') && (
        <View style={styles.section}>
          {storeError ? (
            <AppText variant="body" tone="secondary">
              {t('billing.premium.productsError')}
            </AppText>
          ) : storeOptions.length === 0 ? (
            <AppText variant="body" tone="secondary" accessibilityLiveRegion="polite">
              {packages ? t('billing.premium.storeUnavailable') : t('billing.premium.loadingProducts')}
            </AppText>
          ) : (
            <>
              <PeriodPicker label={t('billing.premium.choosePlan')} options={storeOptions} value={period} onChange={setPeriod} />
              <Button
                label={t('billing.premium.subscribe', { price: packages?.[period]?.price ?? '' })}
                icon={Crown}
                fullWidth
                loading={busy === 'buy'}
                disabled={!!busy || !packages?.[period]}
                onPress={buy}
              />
              <AppText variant="caption" tone="muted">
                {t('billing.premium.storeNote', { store: t(`billing.store.${store}`) })}
              </AppText>
            </>
          )}
        </View>
      )}

      {native && (
        <Button label={t('billing.premium.restore')} icon={RotateCcw} variant="ghost" fullWidth loading={busy === 'restore'} disabled={!!busy || !storeOn} onPress={restore} />
      )}
      {native && !storeOn && !webOn && (
        <AppText variant="body" tone="secondary" align="center">
          {t('billing.premium.noStoreNoWeb')}
        </AppText>
      )}

      {webOn && (
        <View style={styles.section}>
          {premium && <AppText variant="h3">{t('billing.premium.extend')}</AppText>}
          <PeriodPicker label={t('billing.premium.choosePlan')} options={webOptions} value={period} onChange={setPeriod} />
          <View style={styles.block}>
            <AppText variant="caption" tone="secondary">
              {t('billing.premium.currency')}
            </AppText>
            <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={t('billing.premium.currency')}>
              {currencies.map((c) => (
                <Chip
                  key={c}
                  label={c}
                  selected={c === currency}
                  onPress={() => {
                    setCurrency(c);
                    setMethod(METHODS_BY_CURRENCY[c]![0]!);
                    setPayError(null);
                  }}
                />
              ))}
            </View>
          </View>
          <View style={styles.block}>
            <AppText variant="caption" tone="secondary">
              {t('billing.premium.method')}
            </AppText>
            <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={t('billing.premium.method')}>
              {METHODS_BY_CURRENCY[currency]!.map((m) => (
                <Chip key={m} label={t(`billing.premium.methods.${m as 'qris'}`)} selected={m === method} onPress={() => setMethod(m)} />
              ))}
            </View>
          </View>
          {payError && (
            <AppText variant="body" tone="negative" accessibilityRole="alert">
              {payError}
            </AppText>
          )}
          <Button
            label={t('billing.premium.pay', { amount: formatMoney(price[period], currency) })}
            icon={Crown}
            fullWidth
            loading={busy === 'pay'}
            disabled={!!busy}
            onPress={pay}
          />
          <AppText variant="caption" tone="muted">
            {`${t('billing.premium.webNote', { period: t(`billing.premium.periodUnit.${period}`) })} ${t(currency === 'USD' ? 'billing.premium.paddleNote' : 'billing.premium.xenditNote')}`}
          </AppText>
        </View>
      )}

      <PlanCompare />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { gap: space.sm, paddingVertical: space.md },
  activeHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.xs },
  section: { gap: space.lg },
  block: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});

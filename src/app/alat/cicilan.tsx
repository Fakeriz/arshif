import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { CurrencySheet } from '@/components/shell/CurrencySheet';
import { AmountField, AppText, Card, Chip, Input, ListItem, Tabs } from '@/components/ui';
import { ResultRow, ToolScreen } from '@/features/tools/kit';
import { currencyName, useI18n } from '@/i18n';
import { parsePercentBp } from '@/lib/invoice';
import { loanSchedule, type LoanMethod } from '@/lib/loan';
import { formatMoney } from '@/lib/money';
import { useStore } from '@/state/AppStore';
import { space } from '@/theme/tokens';

const TENORS = [12, 24, 36, 60, 120, 180, 240];

/** Kalkulator cicilan / KPR (FR-TAX-1): pinjaman, bunga tahunan, tenor -> cicilan bulanan dan total bunga. */
export default function LoanCalculator() {
  const { t } = useI18n();
  const { state } = useStore();
  const [currency, setCurrency] = useState(state.mainCurrency);
  const [picking, setPicking] = useState(false);
  const [principal, setPrincipal] = useState<number | null>(null);
  const [rateText, setRateText] = useState('');
  const [months, setMonths] = useState('');
  const [method, setMethod] = useState<LoanMethod>('annuity');

  const aprBp = parsePercentBp(rateText);
  const n = /^\d{1,3}$/.test(months.trim()) ? Number(months.trim()) : null;
  const rateError = rateText.trim() && aprBp === null ? t('tools.loan.rateError') : undefined;
  const monthsError = months.trim() && (n === null || n < 1 || n > 480) ? t('tools.loan.monthsError') : undefined;
  const ready = !!principal && principal > 0 && aprBp !== null && rateText.trim() !== '' && n !== null && n >= 1 && n <= 480;
  const r = ready ? loanSchedule(principal, aprBp, n, method) : null;
  const money = (v: number) => formatMoney(v, currency);

  return (
    <ToolScreen title={t('tools.loan.title')}>
      <Card padding="lg">
        <View style={styles.form}>
          <ListItem title={t('tools.loan.currency')} subtitle={`${currency} · ${currencyName(t, currency)}`} chevron onPress={() => setPicking(true)} />
          <AmountField label={t('tools.loan.principal')} value={principal} onChange={setPrincipal} currency={currency} />
          <Input
            label={t('tools.loan.rate')}
            value={rateText}
            onChangeText={setRateText}
            keyboardType="decimal-pad"
            placeholder={t('tools.loan.ratePlaceholder')}
            error={rateError}
            hint={t('tools.loan.rateHint')}
            maxLength={6}
          />
          <Input label={t('tools.loan.months')} value={months} onChangeText={setMonths} keyboardType="number-pad" placeholder={t('tools.loan.monthsPlaceholder')} error={monthsError} maxLength={3} />
          <View style={styles.chips} accessibilityLabel={t('tools.loan.tenorChips')}>
            {TENORS.map((m) => (
              <Chip key={m} label={t('tools.loan.years', { count: m / 12 })} selected={months.trim() === String(m)} onPress={() => setMonths(String(m))} />
            ))}
          </View>
          <Tabs
            accessibilityLabel={t('tools.loan.method')}
            value={method}
            onChange={setMethod}
            items={[{ key: 'annuity', label: t('tools.loan.annuity') }, { key: 'flat', label: t('tools.loan.flat') }]}
          />
          <AppText variant="caption" tone="secondary">
            {method === 'annuity' ? t('tools.loan.annuityHint') : t('tools.loan.flatHint')}
          </AppText>
        </View>
      </Card>

      {r ? (
        <Card padding="lg">
          <AppText variant="caption" tone="secondary">
            {t('tools.loan.monthly')}
          </AppText>
          <AppText variant="amountHero" numeric adjustsFontSizeToFit numberOfLines={1} aria-live="polite">
            {money(r.monthly)}
          </AppText>
          {r.last !== r.monthly && (
            <AppText variant="caption" tone="muted">
              {t('tools.loan.lastPayment', { amount: money(r.last) })}
            </AppText>
          )}
          <View style={styles.results}>
            <ResultRow label={t('tools.loan.totalInterest')} value={money(r.totalInterest)} />
            <ResultRow label={t('tools.loan.totalPaid', { count: r.months })} value={money(r.totalPaid)} strong />
          </View>
        </Card>
      ) : (
        <AppText variant="body" tone="secondary">
          {t('tools.loan.fillIn')}
        </AppText>
      )}
      <AppText variant="caption" tone="muted">
        {t('tools.loan.note')}
      </AppText>
      <CurrencySheet visible={picking} value={currency} onClose={() => setPicking(false)} onSelect={(c) => { setCurrency(c); setPrincipal(null); }} />
    </ToolScreen>
  );
}

const styles = StyleSheet.create({
  form: { gap: space.lg },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  results: { marginTop: space.md },
});

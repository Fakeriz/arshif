import { ArrowUpDown, ChevronDown } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { CurrencySheet } from '@/components/shell/CurrencySheet';
import { AmountField, AppText, Card, EmptyState, Icon, PressableScale } from '@/components/ui';
import { ToolScreen } from '@/features/tools/kit';
import { currencyName, useI18n } from '@/i18n';
import { shortDate } from '@/lib/dates';
import { convert, crossRate, hasRate, usdRatesDate } from '@/lib/fx';
import { formatMoney } from '@/lib/money';
import { useStore } from '@/state/AppStore';
import { useTheme } from '@/theme/ThemeProvider';
import { layout, radius, space } from '@/theme/tokens';

/** Kurs untuk tampilan: 4 angka penting di belakang koma untuk kurs kecil, 2 untuk kurs besar. */
function rateText(rate: string, decimal: string): string {
  const n = Number(rate);
  const digits = n >= 100 ? 2 : n >= 1 ? 4 : 6;
  const [whole, frac = ''] = n.toFixed(digits).split('.');
  const trimmed = frac.replace(/0+$/, '');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, decimal === ',' ? '.' : ',');
  return trimmed ? `${grouped}${decimal}${trimmed}` : grouped;
}

/** Konverter mata uang (FR-TAX-1). Kurs harian Frankfurter/ECB yang sama dengan saldo aplikasi. */
export default function Converter() {
  const { t, lang } = useI18n();
  const { colors } = useTheme();
  const { state, reload } = useStore();
  const [from, setFrom] = useState(state.mainCurrency === 'USD' ? 'IDR' : 'USD');
  const [to, setTo] = useState(state.mainCurrency === 'USD' ? 'MYR' : state.mainCurrency);
  const [amount, setAmount] = useState<number | null>(null);
  const [picking, setPicking] = useState<'from' | 'to' | null>(null);
  const date = usdRatesDate();
  const ready = date !== null && hasRate(from) && hasRate(to);
  const decimal = lang === 'id' || lang === 'tr' ? ',' : '.';

  if (!ready) {
    return (
      <ToolScreen title={t('tools.fx.title')}>
        <EmptyState kind="error" title={t('tools.fx.noRatesTitle')} message={t('tools.fx.noRatesMessage')} actionLabel={t('common.retry')} onAction={() => void reload()} />
      </ToolScreen>
    );
  }

  const result = amount ? convert(amount, from, to) : 0;
  const rate = crossRate(from, to);

  return (
    <ToolScreen title={t('tools.fx.title')}>
      <Card padding="lg">
        <View style={styles.block}>
          <CurrencyButton label={t('tools.fx.from')} code={from} name={currencyName(t, from)} onPress={() => setPicking('from')} />
          <AmountField label={t('tools.fx.amount')} value={amount} onChange={setAmount} currency={from} />
        </View>
        <View style={styles.swapRow}>
          <View style={[styles.rule, { backgroundColor: colors.border }]} />
          <PressableScale
            accessibilityLabel={t('tools.fx.swap')}
            onPress={() => {
              setFrom(to);
              setTo(from);
              if (amount) setAmount(result || null);
            }}
            focusRadius={radius.full}
            style={[styles.swap, { backgroundColor: colors.track, borderColor: colors.glassBorder }]}
          >
            <Icon icon={ArrowUpDown} color={colors.text} size={20} />
          </PressableScale>
          <View style={[styles.rule, { backgroundColor: colors.border }]} />
        </View>
        <View style={styles.block}>
          <CurrencyButton label={t('tools.fx.to')} code={to} name={currencyName(t, to)} onPress={() => setPicking('to')} />
          <AppText variant="amountHero" numeric adjustsFontSizeToFit numberOfLines={1} aria-live="polite" accessibilityLabel={t('tools.fx.resultA11y', { amount: formatMoney(result, to) })}>
            {formatMoney(result, to)}
          </AppText>
        </View>
      </Card>
      <AppText variant="caption" tone="secondary">
        {t('tools.fx.rateLine', { from, to, rate: rateText(rate, decimal), date: shortDate(date, lang) })}
      </AppText>
      <AppText variant="caption" tone="muted">
        {t('tools.fx.source')}
      </AppText>
      <CurrencySheet
        visible={picking !== null}
        value={picking === 'from' ? from : to}
        title={picking === 'from' ? t('tools.fx.from') : t('tools.fx.to')}
        onClose={() => setPicking(null)}
        onSelect={(code) => {
          if (picking === 'from') {
            if (code === to) setTo(from);
            setFrom(code);
            setAmount(null);
          } else {
            if (code === from) setFrom(to);
            setTo(code);
          }
        }}
      />
    </ToolScreen>
  );
}

function CurrencyButton({ label, code, name, onPress }: { label: string; code: string; name: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <PressableScale accessibilityLabel={`${label}: ${code}, ${name}`} accessibilityHint={label} onPress={onPress} focusRadius={radius.md} style={styles.currency}>
      <View style={styles.flex}>
        <AppText variant="caption" tone="secondary">
          {label}
        </AppText>
        <AppText variant="h3" numberOfLines={1}>
          {`${code} · ${name}`}
        </AppText>
      </View>
      <Icon icon={ChevronDown} color={colors.textSecondary} size={layout.iconSize.md} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  block: { gap: space.md },
  currency: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 48 },
  flex: { flex: 1, minWidth: 0 },
  swapRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginVertical: space.lg },
  rule: { flex: 1, height: StyleSheet.hairlineWidth },
  swap: { width: 44, height: 44, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', borderWidth: layout.hairline },
});

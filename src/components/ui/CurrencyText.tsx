import { TriangleAlert } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { useCountUp } from '@/hooks/useCountUp';
import { currencyMeta, formatMoney } from '@/lib/money';
import { useTheme } from '@/theme/ThemeProvider';
import { space, type as typeScale, type TypeVariant } from '@/theme/tokens';

import { AppText, type AppTextProps, type TextTone } from './AppText';
import { Icon } from './Icon';

/**
 * Aturan angka Arshif:
 *  - income   → hijau, prefix "+"
 *  - expense  → warna teks utama, prefix "−"
 *  - over     → merah + ikon peringatan (HANYA over budget). Saat aksen = Merah,
 *                token `negative` berganti rona (tokens.overBudgetForRedAccent).
 *  - balance  → apa adanya (negatif tetap "−")
 */
export type AmountKind = 'income' | 'expense' | 'over' | 'balance';

export type CurrencyTextProps = Omit<AppTextProps, 'children' | 'tone'> & {
  /** Nominal dalam minor units (integer). Untuk expense boleh positif atau negatif. */
  amount: number;
  currency: string;
  kind?: AmountKind;
  variant?: TypeVariant;
  /** Sembunyikan saldo (ikon mata). */
  hidden?: boolean;
  countUp?: boolean;
  tone?: TextTone;
};

const HIDDEN_MASK = '••••••';

export function CurrencyText({
  amount,
  currency,
  kind = 'balance',
  variant = 'amount',
  hidden,
  countUp,
  tone,
  ...rest
}: CurrencyTextProps) {
  const { colors } = useTheme();
  const shown = useCountUp(amount, !!countUp && !hidden);
  const abs = Math.abs(shown);

  let text: string;
  let resolvedTone: TextTone = tone ?? 'primary';
  if (kind === 'income') {
    text = formatMoney(abs, currency, 'always');
    resolvedTone = tone ?? 'positive';
  } else if (kind === 'expense') {
    text = formatMoney(-abs, currency);
  } else if (kind === 'over') {
    text = formatMoney(shown, currency);
    resolvedTone = tone ?? 'negative';
  } else {
    text = formatMoney(shown, currency);
  }

  const finalValue = kind === 'expense' ? -Math.abs(amount) : kind === 'income' ? Math.abs(amount) : amount;
  const label = hidden
    ? 'Saldo disembunyikan'
    : `${kind === 'over' ? 'Melebihi batas, ' : ''}${formatMoney(finalValue, currency, kind === 'income' ? 'always' : 'auto')}`;

  const textEl = (
    <AppText
      variant={variant}
      tone={resolvedTone}
      numeric
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.6}
      accessibilityLabel={label}
      {...rest}
    >
      {hidden ? `${currencyMeta(currency).symbol} ${HIDDEN_MASK}` : text}
    </AppText>
  );
  if (kind !== 'over') return textEl;
  // Over budget tidak hanya dibedakan warna: ikon menyertai agar tidak tertukar dengan aksen Merah.
  const iconSize = Math.round(typeScale[variant].fontSize * 0.85);
  return (
    <View style={styles.overRow}>
      <Icon icon={TriangleAlert} color={colors.negative} size={iconSize} />
      {textEl}
    </View>
  );
}

const styles = StyleSheet.create({
  overRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs, flexShrink: 1 },
});

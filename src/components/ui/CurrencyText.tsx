import { useCountUp } from '@/hooks/useCountUp';
import { currencyMeta, formatMoney } from '@/lib/money';
import type { TypeVariant } from '@/theme/tokens';

import { AppText, type AppTextProps, type TextTone } from './AppText';

/**
 * Aturan angka Arshif:
 *  - income   → hijau, prefix "+"
 *  - expense  → warna teks utama, prefix "−"
 *  - over     → merah (HANYA untuk overbudget / utang lewat batas)
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
    : formatMoney(finalValue, currency, kind === 'income' ? 'always' : 'auto');

  return (
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
}

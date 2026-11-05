import { ChevronDown } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { currencyName, useT } from '@/i18n';
import { currencyMeta, formatNumber, formatTypedAmount, parseAmountInput } from '@/lib/money';
import { useTheme } from '@/theme/ThemeProvider';
import { layout, radius, space, type as typeScale } from '@/theme/tokens';

import { AppText } from './AppText';
import { Icon } from './Icon';
import { PressableScale } from './PressableScale';

/** Perkiraan lebar satu digit tabular pada amountHero (36px). */
const DIGIT_WIDTH = 22;

export type AmountInputProps = {
  /** Nilai dalam minor units, null bila kosong. */
  value: number | null;
  onChange: (minor: number | null) => void;
  currency: string;
  onPressCurrency?: () => void;
  label?: string;
  error?: string;
  autoFocus?: boolean;
};

export function AmountInput({
  value,
  onChange,
  currency,
  onPressCurrency,
  label: labelProp,
  error,
  autoFocus,
}: AmountInputProps) {
  const { colors } = useTheme();
  const t = useT();
  const label = labelProp ?? t('common.amount');
  const m = currencyMeta(currency);
  const name = currencyName(t, currency);
  const [text, setText] = useState(() => (value == null ? '' : formatNumber(value, currency)));

  const handleChange = (raw: string) => {
    const justTypedSeparator = raw.length === text.length + 1 && /[.,]$/.test(raw);
    const display = formatTypedAmount(raw, currency, justTypedSeparator);
    if (display.replace(/\D/g, '').length > 15) return;
    setText(display);
    onChange(display ? parseAmountInput(display, currency) : null);
  };

  return (
    <View style={styles.wrap}>
      <AppText variant="overline" tone="muted" uppercase align="center">
        {label}
      </AppText>
      <View style={styles.row}>
        {onPressCurrency ? (
          <PressableScale
            onPress={onPressCurrency}
            accessibilityLabel={t('common.currencyTap', { name })}
            focusRadius={radius.full}
            style={[styles.currency, { backgroundColor: colors.track, borderColor: colors.glassBorder }]}
          >
            <AppText variant="bodyStrong">{m.code}</AppText>
            <Icon icon={ChevronDown} color={colors.textSecondary} size={layout.iconSize.sm} />
          </PressableScale>
        ) : (
          <View accessibilityLabel={t('common.currency', { name })} style={[styles.currency, { backgroundColor: colors.track, borderColor: colors.glassBorder }]}>
            <AppText variant="bodyStrong">{m.code}</AppText>
          </View>
        )}
      </View>
      <View style={styles.amountRow}>
        <AppText variant="h2" tone="secondary">
          {m.symbol}
        </AppText>
        <TextInput
          accessibilityLabel={t('common.amountIn', { label, name })}
          accessibilityHint={error}
          value={text}
          onChangeText={handleChange}
          placeholder="0"
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.accent}
          keyboardType={m.exponent > 0 ? 'decimal-pad' : 'number-pad'}
          autoFocus={autoFocus}
          maxFontSizeMultiplier={1.2}
          style={[
            typeScale.amountHero,
            styles.input,
            // Lebar mengikuti isi agar simbol + angka tetap satu kelompok di tengah.
            { width: Math.max(1, (text || '0').length) * DIGIT_WIDTH + 8 },
            { color: error ? colors.negative : colors.text, fontVariant: ['tabular-nums'] },
          ]}
        />
      </View>
      {error && (
        <AppText variant="caption" tone="negative" align="center" aria-live="polite">
          {error}
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: space.md },
  row: { flexDirection: 'row' },
  currency: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.md,
    paddingVertical: space.xs + 2,
    borderRadius: radius.full,
    borderWidth: layout.hairline,
  },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, maxWidth: '100%' },
  input: { maxWidth: '85%', textAlign: 'center', outlineStyle: 'none' } as object,
});

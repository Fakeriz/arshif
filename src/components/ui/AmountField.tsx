import { useState } from 'react';

import { currencyMeta, formatNumber, formatTypedAmount, parseAmountInput } from '@/lib/money';

import { Input, type InputProps } from './Input';

export type AmountFieldProps = Omit<InputProps, 'value' | 'onChangeText' | 'keyboardType' | 'onChange'> & {
  /** Minor units, null bila kosong. */
  value: number | null;
  onChange: (minor: number | null) => void;
  currency: string;
};

/** Kolom nominal ringkas untuk baris item dan kartu review (AmountInput untuk nominal utama). */
export function AmountField({ value, onChange, currency, ...rest }: AmountFieldProps) {
  const m = currencyMeta(currency);
  const [text, setText] = useState(() => (value == null ? '' : formatNumber(value, currency)));
  return (
    <Input
      {...rest}
      value={text}
      keyboardType={m.exponent > 0 ? 'decimal-pad' : 'number-pad'}
      placeholder="0"
      trailing={undefined}
      onChangeText={(raw) => {
        const justTypedSeparator = raw.length === text.length + 1 && /[.,]$/.test(raw);
        const display = formatTypedAmount(raw, currency, justTypedSeparator);
        setText(display);
        onChange(display ? parseAmountInput(display, currency) : null);
      }}
    />
  );
}

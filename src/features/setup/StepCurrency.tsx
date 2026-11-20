import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { CurrencySheet } from '@/components/shell/CurrencySheet';
import { Button, RadioList } from '@/components/ui';
import { currencyName, useT } from '@/i18n';
import { PINNED_CURRENCIES, currencyMeta } from '@/lib/money';
import { space } from '@/theme/tokens';

/**
 * Mata uang utama (Motion Kit "Pilihan mata uang"): IDR/MYR/TRY/USD sebagai daftar pilihan (FR-FX-1),
 * mata uang lain lewat lembar pemilih lengkap.
 */
export function StepCurrency({ value, onChange }: { value: string; onChange: (code: string) => void }) {
  const t = useT();
  const [more, setMore] = useState(false);
  const pinned = PINNED_CURRENCIES as readonly string[];
  const items = [...pinned, ...(pinned.includes(value) ? [] : [value])].map((code) => ({
    key: code,
    label: `${code} · ${currencyName(t, code)}`,
    hint: currencyMeta(code).symbol,
  }));
  return (
    <View style={styles.wrap}>
      <RadioList items={items} value={value} onChange={onChange} accessibilityLabel={t('auth.setup.currency.title')} />
      <Button label={t('auth.setup.currency.other')} variant="ghost" onPress={() => setMore(true)} />
      <CurrencySheet visible={more} value={value} onSelect={onChange} onClose={() => setMore(false)} />
    </View>
  );
}

const styles = StyleSheet.create({ wrap: { gap: space.sm } });

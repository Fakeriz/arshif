import { StyleSheet, View } from 'react-native';

import { Card, Chip } from '@/components/ui';
import { currencyName, useT } from '@/i18n';
import { CURRENCIES, PINNED_CURRENCIES } from '@/lib/money';
import { space } from '@/theme/tokens';

/** IDR/MYR/TRY/USD dipin di atas (FR-FX-1). Kurs bisa belum ada di proyek baru, jadi daftarnya tetap. */
const ORDER = [...PINNED_CURRENCIES, ...Object.keys(CURRENCIES).filter((c) => !(PINNED_CURRENCIES as readonly string[]).includes(c))];

export function StepCurrency({ value, onChange }: { value: string; onChange: (code: string) => void }) {
  const t = useT();
  return (
    <Card>
      <View style={styles.grid}>
        {ORDER.map((code) => (
          <Chip key={code} label={`${code} · ${currencyName(t, code)}`} selected={code === value} onPress={() => onChange(code)} />
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({ grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm } });

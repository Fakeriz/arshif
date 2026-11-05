import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { AppText, Badge, PressableScale } from '@/components/ui';
import { useT } from '@/i18n';
import { useTheme } from '@/theme/ThemeProvider';
import { layout, radius, space } from '@/theme/tokens';

export type PeriodOption = {
  key: 'monthly' | 'yearly';
  price: string;
  /** Baris kecil di bawah harga, mis. "Setara Rp 20.833 per bulan". */
  note?: string;
  /** Mis. "2 bulan gratis". Hanya fakta yang bisa dihitung dari harga. */
  badge?: string;
};

/**
 * Pilihan Bulanan/Tahunan sebagai radio. Tanpa onChange = kartu harga statis (halaman Pricing publik).
 * Pilihan aktif ditandai garis aksen + teks, bukan warna saja.
 */
export function PeriodPicker({ options, value, onChange, label }: { options: PeriodOption[]; value?: 'monthly' | 'yearly'; onChange?: (k: 'monthly' | 'yearly') => void; label: string }) {
  const { colors } = useTheme();
  const t = useT();
  // Dua kartu berdampingan: di layar sempit (< 360) harga turun satu ukuran supaya tetap satu baris.
  const narrow = useWindowDimensions().width < 360;
  return (
    <View accessibilityRole={onChange ? 'radiogroup' : undefined} accessibilityLabel={label} style={styles.row}>
      {options.map((o) => {
        const selected = onChange ? o.key === value : false;
        const body = (
          <View
            style={[
              styles.card,
              { borderColor: selected ? colors.accent : colors.border, backgroundColor: selected ? colors.accentSoft : colors.glass },
            ]}
          >
            <View style={styles.head}>
              <AppText variant="bodyStrong">{t(`billing.period.${o.key}`)}</AppText>
              {o.badge && <Badge label={o.badge} tone="positive" />}
            </View>
            <AppText variant={narrow ? 'h3' : 'h2'} numeric numberOfLines={1}>
              {o.price.replace(/ /g, '\u00A0')}
            </AppText>
            <AppText variant="caption" tone="secondary">
              {o.key === 'monthly' ? t('billing.perMonth') : t('billing.perYear')}
            </AppText>
            {o.note && (
              <AppText variant="caption" tone="secondary">
                {o.note}
              </AppText>
            )}
          </View>
        );
        if (!onChange) return <View key={o.key} style={styles.slot}>{body}</View>;
        return (
          <PressableScale
            key={o.key}
            accessibilityRole="radio"
            aria-checked={selected}
            accessibilityLabel={[t(`billing.period.${o.key}`), o.price, o.badge, o.note].filter(Boolean).join(', ')}
            onPress={() => onChange(o.key)}
            focusRadius={radius.lg}
            containerStyle={styles.slot}
            scaleTo={0.98}
          >
            {body}
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.md },
  slot: { flex: 1, minWidth: 0 },
  card: { flex: 1, borderRadius: radius.lg, borderWidth: layout.hairline * 2, padding: space.lg, gap: space.xs, minHeight: 132 },
  head: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: space.xs },
});

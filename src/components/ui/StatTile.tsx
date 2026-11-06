import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { formatMoney } from '@/lib/money';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

import { AppText } from './AppText';
import { Card } from './Card';
import { CurrencyText } from './CurrencyText';
import { Icon } from './Icon';
import { Skeleton } from './Skeleton';
import { Sparkline } from './Sparkline';
import { TrendBadge } from './TrendBadge';

export type StatTileProps = {
  label: string;
  /** Nominal dalam minor units. */
  amount: number;
  currency: string;
  /** Perubahan relatif vs periode sebelumnya (0.08 = +8%). null = belum ada pembanding. */
  change?: number | null;
  /** Teks pembanding di sebelah badge, mis. "vs bulan lalu". */
  changeSuffix?: string;
  /** Deret nilai (minor units) untuk sparkline, terlama → terbaru. */
  series?: number[];
  /** Naik itu buruk (pengeluaran, utang): badge dan sparkline dibalik warnanya. */
  invert?: boolean;
  icon?: LucideIcon;
  hidden?: boolean;
  loading?: boolean;
  /** compact: dua tile berdampingan; wide: satu baris penuh dengan sparkline lebih lebar. */
  layout?: 'compact' | 'wide';
  onPress?: () => void;
};

/** Kartu statistik: label, nominal besar, delta ±%, dan sparkline tren. */
export function StatTile({
  label,
  amount,
  currency,
  change = null,
  changeSuffix,
  series,
  invert,
  icon,
  hidden,
  loading,
  layout = 'compact',
  onPress,
}: StatTileProps) {
  const { colors } = useTheme();
  const wide = layout === 'wide';
  const hasSeries = !!series && series.length > 1;

  if (loading) {
    return (
      <View style={!wide && styles.compact}>
        <Card style={styles.card}>
          <Skeleton width="50%" height={12} />
          <Skeleton width="80%" height={24} radius={radius.xs} />
          <Skeleton width={64} height={18} radius={radius.full} />
        </Card>
      </View>
    );
  }

  return (
    // Pembungkus luar yang menerima ukuran flex: Card dengan onPress membungkus dirinya di Pressable.
    <View style={!wide && styles.compact}>
      <Card style={styles.card} onPress={onPress} accessibilityLabel={onPress ? label : undefined}>
        <View style={styles.head}>
          {icon && (
            <View style={[styles.iconWrap, { backgroundColor: colors.track }]}>
              <Icon icon={icon} color={colors.textSecondary} size={16} />
            </View>
          )}
          <AppText variant="caption" tone="secondary" numberOfLines={1} style={styles.flex}>
            {label}
          </AppText>
        </View>

        <CurrencyText amount={amount} currency={currency} variant={wide ? 'amountHero' : 'h2'} hidden={hidden} />
        <View style={[styles.foot, wide && styles.footWide]}>
          <TrendBadge value={change} invert={invert} suffix={changeSuffix} size={wide ? 'md' : 'sm'} />
          {hasSeries && !hidden && (
            <Sparkline
              values={series}
              invert={invert}
              width={wide ? 112 : 140}
              height={wide ? 40 : 36}
              formatValue={(v) => formatMoney(v, currency)}
            />
          )}
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md },
  /** Dua tile berdampingan di baris flexWrap: berbagi lebar, turun baris bila terlalu sempit. */
  compact: { flexGrow: 1, flexBasis: 0, minWidth: 148 },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  iconWrap: { width: 28, height: 28, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  foot: { gap: space.md },
  footWide: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
});

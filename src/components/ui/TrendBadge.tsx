import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react-native';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay } from 'react-native-reanimated';

import { useI18n, type Lang, type TFunction } from '@/i18n';
import { useMotion } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, motion, radius, space } from '@/theme/tokens';

import { AppText, type TextTone } from './AppText';
import { Icon } from './Icon';

/** Rasio → teks persen sesuai bahasa: 0.124 → "12,4%" (ID), "12.4%" (EN), "%12,4" (TR). */
export function formatPct(t: TFunction, lang: Lang, ratio: number, digits = 1): string {
  const abs = Math.abs(ratio * 100);
  const fixed = abs >= 100 || Number.isInteger(abs) ? String(Math.round(abs)) : abs.toFixed(digits);
  const n = lang === 'id' || lang === 'tr' ? fixed.replace('.', ',') : fixed;
  return t('common.fin.pct', { n });
}

export type TrendBadgeProps = {
  /** Perubahan relatif (0.124 = +12,4%). null = belum ada pembanding. */
  value: number | null;
  /**
   * Naik itu buruk (pengeluaran, utang): warna dibalik, arah panah tetap jujur.
   * Bawaan false: naik = hijau (saldo, pemasukan, aset).
   */
  invert?: boolean;
  /** Teks pendamping setelah persen, mis. "vs bulan lalu". */
  suffix?: string;
  size?: 'sm' | 'md';
};

/** Pill delta ±% bergaya fintech: panah + persen, warna berdasarkan makna (bukan aksen). */
export function TrendBadge({ value, invert, suffix, size = 'md' }: TrendBadgeProps) {
  const { colors } = useTheme();
  const { t, lang } = useI18n();
  const { timing, reduced } = useMotion();

  // Perubahan < 0,05% dibulatkan jadi datar agar tidak muncul "naik 0%".
  const dir = value === null ? 'none' : Math.abs(value) < 0.0005 ? 'flat' : value > 0 ? 'up' : 'down';
  const good = dir === 'up' ? !invert : dir === 'down' ? !!invert : null;
  const look: { bg: string; fg: string; tone: TextTone } =
    good === true
      ? { bg: colors.positiveSoft, fg: colors.positive, tone: 'positive' }
      : good === false
        ? { bg: colors.negativeSoft, fg: colors.negative, tone: 'negative' }
        : { bg: colors.track, fg: colors.textSecondary, tone: 'secondary' };

  const pct = value === null ? '' : formatPct(t, lang, value);
  const label =
    dir === 'none'
      ? t('common.fin.trendNone')
      : dir === 'flat'
        ? t('common.fin.trendFlat')
        : t(dir === 'up' ? 'common.fin.trendUp' : 'common.fin.trendDown', { pct });
  const glyph = dir === 'up' ? ArrowUpRight : dir === 'down' ? ArrowDownRight : Minus;
  const iconSize = size === 'sm' ? 12 : 14;

  // Muncul setelah angka utama: pudar + naik 4px. Diputar ulang bila arah tren berubah.
  const shown = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    shown.value = 0;
    shown.value = withDelay(reduced ? 0 : motion.fast, timing(1, motion.base));
  }, [dir, shown, timing, reduced]);
  const appear = useAnimatedStyle(() => ({ opacity: shown.value, transform: [{ translateY: (1 - shown.value) * 4 }] }));

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={suffix ? `${label} ${suffix}` : label}
      style={styles.row}
    >
      <Animated.View style={[styles.pill, size === 'sm' && styles.pillSm, { backgroundColor: look.bg }, appear]}>
        <Icon icon={glyph} color={look.fg} size={iconSize} />
        {dir !== 'none' && (
          <AppText variant={size === 'sm' ? 'overline' : 'caption'} tone={look.tone} numeric style={styles.strong}>
            {dir === 'flat' ? formatPct(t, lang, 0) : pct}
          </AppText>
        )}
      </Animated.View>
      {suffix && (
        <AppText variant="caption" tone="muted" numberOfLines={1} style={styles.suffix}>
          {suffix}
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexShrink: 1 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xxs,
    paddingLeft: space.xs + 2,
    paddingRight: space.sm,
    paddingVertical: space.xxs + 1,
    borderRadius: radius.full,
  },
  pillSm: { paddingLeft: space.xs, paddingRight: space.xs + 2, paddingVertical: 1 },
  strong: { fontFamily: fonts.semibold },
  suffix: { flexShrink: 1 },
});

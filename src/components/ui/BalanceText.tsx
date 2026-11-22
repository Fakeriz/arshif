import { StyleSheet, Text, View } from 'react-native';

import { useT } from '@/i18n';
import { useCountUp } from '@/hooks/useCountUp';
import { formatMoney, formatMoneyParts } from '@/lib/money';
import { useTheme } from '@/theme/ThemeProvider';
import { type as typeScale } from '@/theme/tokens';

export type BalanceTextProps = {
  /** Minor units (integer). */
  amount: number;
  currency: string;
  hidden?: boolean;
  countUp?: boolean;
  size?: 'hero' | 'large';
  align?: 'center' | 'left';
};

const MASK = '••••••';

/**
 * Saldo besar: bagian bulat penuh, pecahan desimal diredupkan (mis. $2,017.09 → ".09" redup).
 * Simbol mata uang lebih kecil agar angka tetap fokus utama layar.
 */
export function BalanceText({ amount, currency, hidden, countUp, size = 'hero', align = 'center' }: BalanceTextProps) {
  const { colors } = useTheme();
  const t = useT();
  const shown = useCountUp(amount, !!countUp && !hidden);
  const p = formatMoneyParts(shown, currency);
  const raw = size === 'hero' ? typeScale.balanceHero : typeScale.amountHero;
  // Angka panjang (ratusan juta, miliar) mengecil sendiri: adjustsFontSizeToFit tidak jalan di web,
  // jadi ukuran diturunkan dari jumlah karakter (maks. 30% lebih kecil), lalu adjustsFontSizeToFit menyempurnakan di native.
  const chars = (hidden ? MASK : p.whole + p.fraction).length + p.symbol.length / 2;
  const fit = Math.max(0.7, Math.min(1, 13 / chars));
  const base = fit === 1 ? raw : { ...raw, fontSize: Math.round(raw.fontSize * fit), lineHeight: Math.round(raw.lineHeight * fit) };
  const symbolSize = Math.round(base.fontSize * 0.55);

  return (
    <View
      accessible
      accessibilityLabel={hidden ? t('common.balanceHidden') : formatMoney(amount, currency)}
      style={[styles.row, { justifyContent: align === 'center' ? 'center' : 'flex-start' }]}
    >
      <Text
        maxFontSizeMultiplier={1.2}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.5}
        style={[base, styles.num, { color: colors.text }]}
      >
        <Text style={{ fontSize: symbolSize, color: colors.textSecondary }}>
          {p.sign}
          {p.symbol}
          {/* Jarak tetap antara mata uang dan angka (spasi tak terputus, dua kali karena ukuran simbol lebih kecil). */}
          {'\u00A0\u00A0'}
        </Text>
        {hidden ? MASK : p.whole}
        {!hidden && p.fraction ? <Text style={{ color: colors.textMuted }}>{p.fraction}</Text> : null}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'baseline', alignSelf: 'stretch' },
  num: { fontVariant: ['tabular-nums'], flexShrink: 1 },
});

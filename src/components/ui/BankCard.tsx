import { StyleSheet, View } from 'react-native';

import { getBank } from '@/constants/banks';
import { bankName, useT } from '@/i18n';
import { formatMoney } from '@/lib/money';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, layout, radius, space } from '@/theme/tokens';

import { AppText } from './AppText';
import { PressableScale } from './PressableScale';

export type BankCardProps = {
  bank: string;
  /** Mis. "Tabungan", "Kartu Kredit", "E-Wallet". */
  accountType: string;
  last4?: string;
  /** Minor units. */
  balance: number;
  currency: string;
  hidden?: boolean;
  onPress?: () => void;
};

/**
 * Kartu akun per bank (FR-ACC-2): warna khas bank, nama bank sebagai teks (bukan logo).
 * Kaca hanya di tepi (border) agar warna bank tetap jadi identitas kartu.
 */
export function BankCard({ bank, accountType, last4, balance, currency, hidden, onPress }: BankCardProps) {
  const { colors } = useTheme();
  const t = useT();
  const b = getBank(bank);
  const name = bankName(t, bank);
  const amount = hidden ? '••••••' : formatMoney(balance, currency);
  const a11y = t(last4 ? 'common.bankCardA11yLast4' : 'common.bankCardA11y', { bank: name, type: accountType, last4: last4 ?? '', amount: hidden ? t('common.balanceHidden') : amount });
  const cardStyle = [styles.card, { backgroundColor: b.color, borderColor: colors.glassBorder }];
  const content = (
    <>
      <View style={styles.head}>
        <AppText variant="h3" style={[styles.bankName, { color: b.onColor }]} numberOfLines={1}>
          {name}
        </AppText>
        {last4 && (
          <AppText variant="caption" numeric style={{ color: b.onColor }}>
            {`•••• ${last4}`}
          </AppText>
        )}
      </View>
      <View style={styles.foot}>
        <AppText variant="caption" style={{ color: b.onColor }} numberOfLines={1}>
          {accountType}
        </AppText>
        <AppText variant="h2" numeric numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={{ color: b.onColor }}>
          {amount}
        </AppText>
      </View>
    </>
  );
  // Tanpa onPress (mis. pratinjau di pemilih bank) kartu adalah gambar statis, bukan tombol nonaktif yang pudar.
  if (!onPress) {
    return (
      <View accessible accessibilityLabel={a11y} style={cardStyle}>
        {content}
      </View>
    );
  }
  return (
    <PressableScale onPress={onPress} accessibilityLabel={a11y} focusRadius={radius.lg} scaleTo={0.985} style={cardStyle}>
      {content}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 280,
    height: 168,
    borderRadius: radius.lg,
    borderWidth: layout.hairline,
    padding: space.xl,
    justifyContent: 'space-between',
  },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.md },
  bankName: { fontFamily: fonts.extrabold, flexShrink: 1 },
  foot: { gap: space.xxs },
});

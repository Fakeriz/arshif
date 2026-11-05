import { Crown } from 'lucide-react-native';
import { ScrollView, StyleSheet, View } from 'react-native';

import { usePaywall } from '@/components/shell/Paywall';
import { AppText, BankCard, GlassView, Icon, PressableScale } from '@/components/ui';
import type { AccountWithBalance } from '@/state/AppStore';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

import { ACCOUNT_TYPE_LABEL } from './accountLabels';

export type AccountsRailProps = {
  accounts: AccountWithBalance[];
  hidden: boolean;
  limitReached: boolean;
  onPressAccount: (id: string) => void;
};

/** Kartu akun per bank, bisa digeser. Di ujung, kartu batas muncul saat Free sudah 4 akun. */
export function AccountsRail({ accounts, hidden, limitReached, onPressAccount }: AccountsRailProps) {
  const { colors } = useTheme();
  const paywall = usePaywall();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} style={styles.scroll}>
      {accounts.map((a) => (
        <BankCard
          key={a.id}
          bank={a.bank}
          accountType={ACCOUNT_TYPE_LABEL[a.type]}
          last4={a.last4}
          balance={a.balance}
          currency={a.currency}
          hidden={hidden}
          onPress={() => onPressAccount(a.id)}
        />
      ))}
      {limitReached && (
        <PressableScale
          accessibilityLabel="Batas 4 akun tercapai. Buka Premium untuk menambah akun"
          focusRadius={radius.lg}
          onPress={() => paywall('Paket Free dibatasi 4 akun dan dompet. Premium tanpa batas.')}
        >
          <GlassView radius={radius.lg} style={styles.limit}>
            <View style={[styles.limitIcon, { backgroundColor: colors.accentSoft }]}>
              <Icon icon={Crown} color={colors.accentText} />
            </View>
            <AppText variant="bodyStrong" align="center">
              Batas 4 akun tercapai
            </AppText>
            <AppText variant="caption" tone="secondary" align="center">
              Premium untuk menambah akun
            </AppText>
          </GlassView>
        </PressableScale>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { marginHorizontal: -space.lg },
  row: { gap: space.md, paddingHorizontal: space.lg },
  limit: { width: 200, height: 168, alignItems: 'center', justifyContent: 'center', gap: space.sm, padding: space.lg },
  limitIcon: { width: 44, height: 44, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
});

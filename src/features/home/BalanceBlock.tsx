import { Eye, EyeOff } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppText, BalanceText, Badge, Icon, PressableScale } from '@/components/ui';
import { SAMPLE_RATES_AT } from '@/lib/fx';
import { useStore } from '@/state/AppStore';
import { useTheme } from '@/theme/ThemeProvider';
import { layout, radius, space } from '@/theme/tokens';

export function BalanceBlock({ amount, currency, accountCount }: { amount: number; currency: string; accountCount: number }) {
  const { colors } = useTheme();
  const { state, dispatch } = useStore();
  const hidden = state.hideBalance;
  return (
    <View style={styles.wrap}>
      <View style={styles.label}>
        <AppText variant="caption" tone="secondary">
          Total kekayaan bersih
        </AppText>
        <PressableScale
          accessibilityLabel={hidden ? 'Tampilkan saldo' : 'Sembunyikan saldo'}
          focusRadius={radius.full}
          onPress={() => dispatch({ type: 'prefs/hideBalance', value: !hidden })}
          style={styles.eye}
        >
          <Icon icon={hidden ? EyeOff : Eye} color={colors.textSecondary} size={layout.iconSize.sm + 2} />
        </PressableScale>
      </View>
      <BalanceText amount={amount} currency={currency} hidden={hidden} countUp />
      <AppText variant="caption" tone="muted" align="center">
        {`${accountCount} akun · dikonversi ke ${currency} · kurs contoh ${SAMPLE_RATES_AT}`}
      </AppText>
      <View style={styles.badge}>
        <Badge label="Data contoh" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: space.xs + 2, paddingVertical: space.sm },
  label: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  badge: { alignItems: 'center' },
  eye: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginVertical: -space.md },
});

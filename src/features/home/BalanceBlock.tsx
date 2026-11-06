import { Eye, EyeOff } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { useI18n } from '@/i18n';
import { AppText, BalanceText, Icon, PressableScale, TrendBadge } from '@/components/ui';
import { changeSince } from '@/lib/assets';
import { pctChange } from '@/lib/chart';
import { shortDate, todayYmd } from '@/lib/dates';
import { useAssets } from '@/state/assets';
import { useStore } from '@/state/AppStore';
import { useTheme } from '@/theme/ThemeProvider';
import { layout, radius, space } from '@/theme/tokens';

export function BalanceBlock({
  amount,
  currency,
  accountCount,
  complete = true,
}: {
  amount: number;
  currency: string;
  accountCount: number;
  /** Utang dan aset sudah dimuat; sebelum itu delta tidak ditampilkan agar tidak berkedip salah. */
  complete?: boolean;
}) {
  const { colors } = useTheme();
  const { state, dispatch } = useStore();
  const hidden = state.hideBalance;
  const { t, lang } = useI18n();
  // Kurs hanya disebut bila ada akun bermata uang lain (FR-FX-2: "Kurs per [waktu]").
  const { snapshots } = useAssets();
  // Tren 30 hari dari snapshot harian (sama dengan tab Aset). Tanpa snapshot lama: badge tidak tampil.
  const since = complete ? changeSince(snapshots, amount, todayYmd(), currency) : null;
  const change = since ? pctChange(amount - since.amount, amount) : null;
  const converted = state.accounts.some((a) => a.currency !== currency) && state.ratesDate !== null;
  return (
    <View style={styles.wrap}>
      <View style={styles.label}>
        <AppText variant="caption" tone="secondary">
          {t('home.netWorth')}
        </AppText>
        <PressableScale
          accessibilityLabel={hidden ? t('home.showBalance') : t('home.hideBalance')}
          focusRadius={radius.full}
          onPress={() => dispatch({ type: 'prefs/hideBalance', value: !hidden })}
          style={styles.eye}
        >
          <Icon icon={hidden ? EyeOff : Eye} color={colors.textSecondary} size={layout.iconSize.sm + 2} />
        </PressableScale>
      </View>
      <BalanceText amount={amount} currency={currency} hidden={hidden} countUp />
      {change !== null && <TrendBadge value={change} suffix={t('home.netWorthVs')} />}
      <AppText variant="caption" tone="muted" align="center">
        {converted
          ? t('home.balanceMeta', { count: accountCount, currency, date: shortDate(state.ratesDate!, lang) })
          : t('home.balanceMetaSame', { count: accountCount, currency })}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: space.xs + 2, paddingVertical: space.sm },
  label: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  eye: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginVertical: -space.md },
});

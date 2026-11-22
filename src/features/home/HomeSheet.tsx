import { useRouter } from 'expo-router';
import { ArrowDownLeft, ArrowUpRight, Bell, ChevronUp, Eye, EyeOff, Target, type LucideIcon } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { NotificationsSheet } from '@/components/shell/NotificationsSheet';
import { AppText, BalanceText, Icon, PressableScale } from '@/components/ui';
import type { Transaction } from '@/data/types';
import { useBalanceMeta } from '@/features/home/BalanceBlock';
import { ProfileAvatar } from '@/features/settings/ProfileAvatar';
import { useT, type MsgKey } from '@/i18n';
import { periodSeries } from '@/lib/budget';
import { todayYmd } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { useStore } from '@/state/AppStore';
import { easeOut, haptic } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';
import { elevation, fonts, layout, motion, radius, space } from '@/theme/tokens';

export type SheetAction = { key: string; label: string; icon: LucideIcon; onPress: () => void };

const NOTCH_W = 112;
const NOTCH_H = 26;
const MASK = '••••';

/** Sapaan menurut jam perangkat. */
export function greetingKey(hour: number): MsgKey {
  if (hour >= 4 && hour < 11) return 'home.greeting.morning';
  if (hour >= 11 && hour < 15) return 'home.greeting.afternoon';
  if (hour >= 15 && hour < 18) return 'home.greeting.evening';
  return 'home.greeting.night';
}

/**
 * Lembar kertas di puncak Beranda (ponsel), di atas dasar tinta: sapaan, kartu kekayaan bersih
 * (angka, pemasukan/pengeluaran periode berjalan, empat aksi cepat), dan lekukan berpanah untuk melipat kartu.
 * Angka tetap titik fokus layar; tinta pindah dari kartu ke dasar layar.
 */
export function HomeSheet({
  amount,
  currency,
  accountCount,
  transactions,
  actions,
}: {
  amount: number;
  currency: string;
  accountCount: number;
  transactions: Transaction[];
  actions: SheetAction[];
}) {
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const { colors, scheme } = useTheme();
  const { state, dispatch } = useStore();
  const [notifOpen, setNotifOpen] = useState(false);
  const [folded, setFolded] = useState(false);
  const hidden = state.hideBalance;
  const meta = useBalanceMeta(accountCount, currency);
  const unread = state.notifications.filter((n) => !n.read).length;
  const name = state.displayName?.trim() || state.email?.split('@')[0] || '';
  const initial = (name[0] ?? 'A').toUpperCase();

  const period = useMemo(
    () => periodSeries(transactions, todayYmd(), state.payday, currency),
    // ratesVersion: konversi ke mata uang utama ikut berubah saat kurs dimuat.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [transactions, state.payday, currency, state.ratesVersion],
  );
  const income = period.income[period.income.length - 1] ?? 0;
  const expense = period.expense[period.expense.length - 1] ?? 0;

  // Lekukan: panah berputar saat kartu dilipat; isi kartu memudar dan kartu menyusut halus (bukan melompat).
  const turn = useSharedValue(0);
  const chevron = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value * 180}deg` }] }));
  const toggle = () => {
    haptic('selection');
    setFolded((f) => {
      turn.value = reduced ? (f ? 0 : 1) : withTiming(f ? 0 : 1, { duration: motion.base, easing: easeOut });
      return !f;
    });
  };
  const reflow = reduced ? undefined : LinearTransition.duration(motion.base).easing(easeOut);
  const appear = reduced ? undefined : FadeIn.duration(motion.base).easing(easeOut);
  const vanish = reduced ? undefined : FadeOut.duration(motion.fast);

  // Lembar: batu di tema terang; di tema gelap permukaan sedikit terangkat agar terpisah dari dasar tinta.
  const sheetBg = scheme === 'dark' ? colors.surface : colors.bg;
  const money = (v: number) => (hidden ? MASK : formatMoney(v, currency));

  return (
    <View style={styles.wrap}>
      <Animated.View layout={reflow} style={[styles.sheet, { backgroundColor: sheetBg, paddingTop: insets.top + space.md }]}>
        <View style={styles.column}>
          <View style={styles.header}>
            <PressableScale accessibilityLabel={t('home.profileA11y')} focusRadius={radius.full} onPress={() => router.push('/pengaturan')}>
              {state.avatarPath ? (
                <ProfileAvatar size={56} />
              ) : (
                <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
                  <AppText style={[styles.initial, { color: colors.onAccent }]}>{initial}</AppText>
                </View>
              )}
            </PressableScale>
            <View style={styles.hello}>
              <AppText style={[styles.greet, { color: colors.text }]} numberOfLines={1}>
                {t(greetingKey(new Date().getHours()))}
              </AppText>
              {name ? (
                <AppText variant="body" tone="secondary" numberOfLines={1}>
                  {name}
                </AppText>
              ) : null}
            </View>
            <SquareButton icon={Target} label={t('home.goalsA11y')} onPress={() => router.push('/rencana/goals')} />
            <SquareButton
              icon={Bell}
              label={unread ? t('home.notifUnreadA11y', { count: unread }) : t('home.notifA11y')}
              onPress={() => setNotifOpen(true)}
              dot={unread > 0}
            />
          </View>

          <Animated.View layout={reflow} style={[styles.card, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }, elevation[scheme].card]}>
            <View style={styles.labelRow}>
              <AppText variant="body" tone="secondary">
                {t('home.netWorth')}
              </AppText>
              <PressableScale
                accessibilityLabel={hidden ? t('home.showBalance') : t('home.hideBalance')}
                focusRadius={radius.control}
                onPress={() => dispatch({ type: 'prefs/hideBalance', value: !hidden })}
                style={[styles.eye, { backgroundColor: colors.surfaceSunken }]}
              >
                <Icon icon={hidden ? EyeOff : Eye} color={colors.textSecondary} />
              </PressableScale>
            </View>
            <BalanceText amount={amount} currency={currency} hidden={hidden} countUp align="left" />
            <AppText variant="caption" tone="muted" style={styles.meta}>
              {meta}
            </AppText>
            {!folded && (
              <Animated.View entering={appear} exiting={vanish} style={styles.more}>
                <View style={styles.flow}>
                  <Flow icon={ArrowDownLeft} tone="positive" label={`${t('common.income')}: ${money(income)}`} value={money(income)} />
                  <View style={[styles.divider, { backgroundColor: colors.borderStrong }]} />
                  <Flow icon={ArrowUpRight} tone="negative" label={`${t('common.expense')}: ${money(expense)}`} value={money(expense)} />
                </View>
                <View style={styles.actions}>
                  {actions.map((a) => (
                    <PressableScale
                      key={a.key}
                      accessibilityLabel={a.label}
                      onPress={a.onPress}
                      focusRadius={22}
                      containerStyle={styles.actionCell}
                      style={[styles.action, { backgroundColor: colors.accent }]}
                    >
                      <Icon icon={a.icon} color={colors.onAccent} size={layout.iconSize.lg} />
                    </PressableScale>
                  ))}
                </View>
              </Animated.View>
            )}
          </Animated.View>
        </View>
      </Animated.View>

      {/* Lekukan: menyambung lembar ke dasar tinta, panahnya melipat/membuka kartu. */}
      <Animated.View layout={reflow} style={styles.notchWrap}>
        <PressableScale accessibilityLabel={folded ? t('home.unfold') : t('home.fold')} accessibilityState={{ expanded: !folded }} onPress={toggle} focusRadius={radius.full} scaleTo={0.96}>
          <View style={styles.notch}>
            <Svg width={NOTCH_W} height={NOTCH_H} style={StyleSheet.absoluteFill}>
              <Path d={`M0 0 C 22 0, 26 ${NOTCH_H}, 46 ${NOTCH_H} L ${NOTCH_W - 46} ${NOTCH_H} C ${NOTCH_W - 26} ${NOTCH_H}, ${NOTCH_W - 22} 0, ${NOTCH_W} 0 Z`} fill={sheetBg} />
            </Svg>
            <Animated.View style={chevron}>
              <Icon icon={ChevronUp} color={colors.text} size={layout.iconSize.md} />
            </Animated.View>
          </View>
        </PressableScale>
      </Animated.View>

      <NotificationsSheet visible={notifOpen} onClose={() => setNotifOpen(false)} />
    </View>
  );
}

function SquareButton({ icon, label, onPress, dot }: { icon: LucideIcon; label: string; onPress: () => void; dot?: boolean }) {
  const { colors } = useTheme();
  return (
    <PressableScale accessibilityLabel={label} onPress={onPress} focusRadius={18} style={[styles.square, { backgroundColor: colors.accent, borderColor: colors.borderStrong }]}>
      <Icon icon={icon} color={colors.onAccent} />
      {dot && <View style={[styles.dot, { backgroundColor: colors.warning, borderColor: colors.accent }]} />}
    </PressableScale>
  );
}

function Flow({ icon, tone, label, value }: { icon: LucideIcon; tone: 'positive' | 'negative'; label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.flowItem} accessible accessibilityLabel={label}>
      <View style={[styles.flowIcon, { backgroundColor: tone === 'positive' ? colors.positiveSoft : colors.negativeSoft }]}>
        <Icon icon={icon} color={tone === 'positive' ? colors.positive : colors.negative} size={layout.iconSize.sm} />
      </View>
      <AppText variant="bodyStrong" numeric numberOfLines={1} style={styles.flowValue}>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  sheet: { alignSelf: 'stretch', borderBottomLeftRadius: 40, borderBottomRightRadius: 40, paddingHorizontal: space.lg, paddingBottom: space.xl, alignItems: 'center' },
  column: { width: '100%', maxWidth: layout.maxContentWidth, gap: space.xl },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  initial: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 28 },
  hello: { flex: 1, gap: 2 },
  greet: { fontFamily: fonts.bold, fontSize: 24, lineHeight: 30, letterSpacing: -0.6 },
  square: { width: 52, height: 52, borderRadius: 18, borderWidth: layout.hairline, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', top: 10, right: 11, width: 9, height: 9, borderRadius: 5, borderWidth: 1.5 },
  card: { borderRadius: radius.sheet, borderWidth: layout.hairline, padding: space.xl, gap: space.md },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  eye: { width: 44, height: 44, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' },
  meta: { marginTop: -space.sm },
  more: { gap: space.xl, marginTop: space.xs },
  flow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.lg },
  flowItem: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexShrink: 1 },
  flowIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  flowValue: { flexShrink: 1 },
  divider: { width: 2, height: 26, borderRadius: 1 },
  actions: { flexDirection: 'row', gap: space.md },
  actionCell: { flex: 1 },
  action: { aspectRatio: 1, maxHeight: 80, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  notchWrap: { marginTop: -1, alignItems: 'center' },
  notch: { width: NOTCH_W, height: NOTCH_H + 4, alignItems: 'center', paddingTop: 2 },
});

import { useRouter } from 'expo-router';
import { ArrowDownLeft, ArrowUpRight, Bell, Check, ChevronUp, Ellipsis, Eye, EyeOff, Target, type LucideIcon } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { afterSheetClose, HeaderMenu } from '@/components/shell/HeaderActions';
import { NotificationsSheet } from '@/components/shell/NotificationsSheet';
import { AppText, BalanceText, Icon, PressableScale, Toggle } from '@/components/ui';
import type { Transaction } from '@/data/types';
import { useBalanceMeta } from '@/features/home/BalanceBlock';
import { greetingLines } from '@/features/home/greeting';
import { coverValueFor, SHEET_BGS, useSheetBg } from '@/features/home/sheetBg';
import { ProfileAvatar } from '@/features/settings/ProfileAvatar';
import { coverTextColors, ProfileCover } from '@/features/settings/ProfileCover';
import { parseCover } from '@/lib/cover';
import { useT } from '@/i18n';
import { periodSeries } from '@/lib/budget';
import { todayYmd } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { useStore } from '@/state/AppStore';
import { easeOut, haptic } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';
import { elevation, fonts, inkCard, layout, motion, radius, space } from '@/theme/tokens';

export type SheetAction = { key: string; label: string; icon: LucideIcon; onPress: () => void };

const NOTCH_W = 112;
const NOTCH_H = 26;
const MASK = '••••';


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
  const hello = greetingLines(t, new Date(), state.payday, name);

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
  // Latar kustom (menu titik tiga kartu): sampul profil atau preset. Teks & tombol di atasnya ikut warna sampul.
  const [bg, setBg] = useSheetBg();
  const coverVal = coverValueFor(bg, state.coverPath);
  const custom = coverVal !== undefined;
  const ink = custom ? coverTextColors(coverVal ?? null, scheme) : null;
  const head = { text: ink?.text ?? colors.text, muted: ink?.muted ?? colors.textSecondary };
  const lightHead = head.text.toUpperCase() > '#C'; // teks terang (#E0E0E0/#F4F4F4) di atas latar gelap
  const btn = custom ? { bg: lightHead ? 'rgba(255,255,255,0.14)' : 'rgba(8,8,8,0.08)', fg: head.text } : { bg: colors.accent, fg: colors.onAccent };
  const parsed = custom ? parseCover(coverVal ?? null) : null;
  // Lekukan memakai warna dasar latar (foto: redup gelap di atasnya; batu: abu; preset lain: tinta).
  const notchFill = !parsed ? sheetBg : parsed.kind === 'photo' ? '#1E1E1E' : parsed.key === 'batu' ? colors.textSecondary : inkCard[scheme].bg;
  const money = (v: number) => (hidden ? MASK : formatMoney(v, currency));

  return (
    <View style={styles.wrap}>
      <Animated.View layout={reflow} style={[styles.sheet, { backgroundColor: sheetBg, paddingTop: insets.top + space.md }, custom && { borderColor: colors.border, borderWidth: layout.hairline }]}>
        {custom && (
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <ProfileCover value={coverVal} scrim />
          </View>
        )}
        <View style={styles.column}>
          <View style={styles.header}>
            <PressableScale accessibilityLabel={t('home.profileA11y')} focusRadius={radius.full} onPress={() => router.push('/pengaturan')}>
              {state.avatarPath ? (
                <ProfileAvatar size={48} />
              ) : (
                <View style={[styles.avatar, { backgroundColor: btn.bg }]}>
                  <AppText style={[styles.initial, { color: btn.fg }]}>{initial}</AppText>
                </View>
              )}
            </PressableScale>
            <View style={styles.hello}>
              <AppText style={[styles.greet, { color: head.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                {hello.title}
              </AppText>
              <AppText variant="caption" style={{ color: head.muted }} numberOfLines={2}>
                {hello.nudge}
              </AppText>
            </View>
            <SquareButton icon={Target} label={t('home.goalsA11y')} onPress={() => router.push('/rencana/goals')} bg={btn.bg} fg={btn.fg} />
            <SquareButton
              bg={btn.bg}
              fg={btn.fg}
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
                focusRadius={radius.full}
                hitSlop={6}
                onPress={() => dispatch({ type: 'prefs/hideBalance', value: !hidden })}
                style={[styles.eye, { backgroundColor: colors.surfaceSunken }]}
              >
                <Icon icon={hidden ? EyeOff : Eye} color={colors.textSecondary} size={layout.iconSize.sm} />
              </PressableScale>
              <View style={styles.flex} />
              <HeaderMenu
                trigger={(show) => (
                  <PressableScale accessibilityLabel={t('home.cardMenu')} focusRadius={radius.full} hitSlop={6} onPress={show} style={styles.eye}>
                    <Icon icon={Ellipsis} color={colors.text} />
                  </PressableScale>
                )}
              >
                {(close) => (
                  <View>
                    <AppText variant="caption" tone="muted" style={styles.menuTitle}>
                      {t('home.sheetBgTitle')}
                    </AppText>
                    {SHEET_BGS.map((k) => (
                      <PressableScale
                        key={k}
                        accessibilityRole="button"
                        accessibilityLabel={t(`home.sheetBg.${k}`)}
                        accessibilityState={{ selected: bg === k }}
                        focusRadius={radius.sm}
                        scaleTo={0.985}
                        onPress={() => {
                          if (bg !== k) {
                            haptic('selection');
                            setBg(k);
                          }
                          close();
                        }}
                      >
                        <View style={styles.menuRow}>
                          <AppText variant={bg === k ? 'bodyStrong' : 'body'} style={styles.flex}>
                            {t(`home.sheetBg.${k}`)}
                          </AppText>
                          {bg === k && <Icon icon={Check} color={colors.text} />}
                        </View>
                      </PressableScale>
                    ))}
                    <View style={[styles.menuRule, { backgroundColor: colors.border }]} />
                    <View style={styles.menuRow}>
                      <AppText variant="body" style={styles.flex}>
                        {t('settings.includeAssets')}
                      </AppText>
                      <Toggle value={state.includeAssets} onChange={(value) => dispatch({ type: 'prefs/includeAssets', value })} accessibilityLabel={t('settings.includeAssets')} />
                    </View>
                    <PressableScale
                      accessibilityRole="button"
                      accessibilityLabel={t('home.editCover')}
                      focusRadius={radius.sm}
                      scaleTo={0.985}
                      onPress={() => {
                        close();
                        afterSheetClose(() => router.push('/pengaturan/profil'));
                      }}
                    >
                      <View style={styles.menuRow}>
                        <AppText variant="body">{t('home.editCover')}</AppText>
                      </View>
                    </PressableScale>
                  </View>
                )}
              </HeaderMenu>
            </View>
            <BalanceText amount={amount} currency={currency} hidden={hidden} countUp align="left" />
            <AppText variant="caption" tone="muted" style={styles.meta}>
              {meta}
            </AppText>
            {!folded && (
              <Animated.View entering={appear} exiting={vanish} style={styles.more}>
                {/* Dua separuh sama lebar: isi rata kiri, pembatas tepat di tengah kartu. */}
                <View style={styles.flow}>
                  <Flow icon={ArrowDownLeft} tone="positive" label={`${t('common.income')}: ${money(income)}`} value={money(income)} />
                  <View style={[styles.divider, { backgroundColor: colors.borderStrong }]} />
                  <Flow icon={ArrowUpRight} tone="negative" label={`${t('common.expense')}: ${money(expense)}`} value={money(expense)} inset />
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
              <Path d={`M0 0 C 22 0, 26 ${NOTCH_H}, 46 ${NOTCH_H} L ${NOTCH_W - 46} ${NOTCH_H} C ${NOTCH_W - 26} ${NOTCH_H}, ${NOTCH_W - 22} 0, ${NOTCH_W} 0 Z`} fill={notchFill} />
            </Svg>
            <Animated.View style={chevron}>
              <Icon icon={ChevronUp} color={head.text} size={layout.iconSize.md} />
            </Animated.View>
          </View>
        </PressableScale>
      </Animated.View>

      <NotificationsSheet visible={notifOpen} onClose={() => setNotifOpen(false)} />
    </View>
  );
}

function SquareButton({ icon, label, onPress, dot, bg, fg }: { icon: LucideIcon; label: string; onPress: () => void; dot?: boolean; bg: string; fg: string }) {
  const { colors } = useTheme();
  return (
    <PressableScale accessibilityLabel={label} onPress={onPress} focusRadius={18} style={[styles.square, { backgroundColor: bg, borderColor: colors.borderStrong }]}>
      <Icon icon={icon} color={fg} />
      {dot && <View style={[styles.dot, { backgroundColor: colors.warning, borderColor: bg }]} />}
    </PressableScale>
  );
}

function Flow({ icon, tone, label, value, inset }: { icon: LucideIcon; tone: 'positive' | 'negative'; label: string; value: string; inset?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.flowItem, inset && styles.flowInset]} accessible accessibilityLabel={label}>
      <Icon icon={icon} color={tone === 'positive' ? colors.positive : colors.negative} size={14} />
      <AppText variant="caption" numeric numberOfLines={1} style={styles.flowValue}>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  sheet: { alignSelf: 'stretch', overflow: 'hidden', borderBottomLeftRadius: 40, borderBottomRightRadius: 40, paddingHorizontal: space.lg, paddingBottom: space.xl, alignItems: 'center' },
  column: { width: '100%', maxWidth: layout.maxContentWidth, gap: space.xl },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.sm + 2 },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  initial: { fontFamily: fonts.bold, fontSize: 19, lineHeight: 24 },
  hello: { flex: 1, gap: 2 },
  greet: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 26, letterSpacing: -0.5 },
  square: { width: 46, height: 46, borderRadius: 16, borderWidth: layout.hairline, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', top: 9, right: 9, width: 9, height: 9, borderRadius: 5, borderWidth: 1.5 },
  card: { borderRadius: radius.sheet, borderWidth: layout.hairline, padding: space.xl, gap: space.md },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  eye: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  meta: { marginTop: -space.sm },
  more: { gap: space.xl, marginTop: space.xs },
  flow: { flexDirection: 'row', alignItems: 'center' },
  flowItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: space.lg },
  flowInset: { paddingLeft: space.lg, paddingRight: 0 },
  flowValue: { flexShrink: 1, fontFamily: fonts.semibold },
  divider: { width: 1.5, height: 18, borderRadius: 1 },
  flex: { flex: 1 },
  menuTitle: { paddingTop: space.sm, paddingBottom: space.xs },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 48, paddingVertical: space.sm },
  menuRule: { height: layout.hairline, marginVertical: space.xs },
  actions: { flexDirection: 'row', gap: space.md },
  actionCell: { flex: 1 },
  action: { aspectRatio: 1, maxHeight: 80, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  notchWrap: { marginTop: -1, alignItems: 'center' },
  notch: { width: NOTCH_W, height: NOTCH_H + 4, alignItems: 'center', paddingTop: 2 },
});

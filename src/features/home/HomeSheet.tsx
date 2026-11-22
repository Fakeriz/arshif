import { BlurView } from 'expo-blur';
import { useFocusEffect, useRouter } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { ArrowDownLeft, ArrowUpRight, Bell, Check, ChevronUp, Ellipsis, Eye, EyeOff, PiggyBank, type LucideIcon } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, Extrapolation, interpolate, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { ClipPath, Defs, G, Image as SvgImage, Path } from 'react-native-svg';

import { afterSheetClose, HeaderMenu } from '@/components/shell/HeaderActions';
import { NotificationsSheet } from '@/components/shell/NotificationsSheet';
import { AppText, BalanceText, Icon, PressableScale, Toggle } from '@/components/ui';
import type { Transaction } from '@/data/types';
import { greetingLines } from '@/features/home/greeting';
import { coverValueFor, SHEET_BGS, useSheetBg, useWalletStack } from '@/features/home/sheetBg';
import { ProfileAvatar, useSignedUrl } from '@/features/settings/ProfileAvatar';
import { coverTextColors, ProfileCover } from '@/features/settings/ProfileCover';
import { parseCover } from '@/lib/cover';
import { useT } from '@/i18n';
import { periodSeries } from '@/lib/budget';
import { todayYmd } from '@/lib/dates';
import { formatCompact, formatMoney, formatMoneyParts } from '@/lib/money';
import { setWebChrome } from '@/lib/webChrome';
import { useStore } from '@/state/AppStore';
import { haptic } from '@/theme/motion';
import { SchemeScope, useTheme } from '@/theme/ThemeProvider';
import { buildPalette, elevation, fonts, inkCard, layout, radius, space, type ColorScheme } from '@/theme/tokens';

export type SheetAction = { key: string; label: string; icon: LucideIcon; onPress: () => void };

const NOTCH_W = 112;
const FOLD_EASE = Easing.bezier(0.32, 0.72, 0, 1);
const NOTCH_H = 26;
const NOTCH_D = `M0 0 C 22 0, 26 ${NOTCH_H}, 46 ${NOTCH_H} L ${NOTCH_W - 46} ${NOTCH_H} C ${NOTCH_W - 26} ${NOTCH_H}, ${NOTCH_W - 22} 0, ${NOTCH_W} 0 Z`;
const MASK = '••••';


/**
 * Lembar kertas di puncak Beranda (ponsel), di atas dasar tinta: sapaan, kartu kekayaan bersih
 * (angka, pemasukan/pengeluaran periode berjalan, empat aksi cepat), dan lekukan berpanah untuk melipat kartu.
 * Angka tetap titik fokus layar; tinta pindah dari kartu ke dasar layar.
 */
export function HomeSheet({
  amount,
  currency,
  transactions,
  actions,
}: {
  amount: number;
  currency: string;
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
  // 1 = terbuka. Kurva lembar iOS: cepat di awal, mendarat pelan, tanpa pantulan (bukan gestur).
  const open = useSharedValue(1);
  const [moreH, setMoreH] = useState(0);
  const chevron = useAnimatedStyle(() => ({ transform: [{ rotate: `${(1 - open.value) * 180}deg` }] }));
  const foldStyle = useAnimatedStyle(() => (moreH > 0 ? { height: moreH * open.value, opacity: interpolate(open.value, [0.3, 1], [0, 1], Extrapolation.CLAMP) } : {}));
  const innerStyle = useAnimatedStyle(() => ({ transform: [{ translateY: (1 - open.value) * -10 }, { scale: 0.97 + 0.03 * open.value }] }));
  const toggle = () => {
    haptic('selection');
    setFolded((f) => {
      open.value = reduced ? (f ? 1 : 0) : withTiming(f ? 1 : 0, { duration: 340, easing: FOLD_EASE });
      return !f;
    });
  };

  // Lembar: kertas di atas dasar batu (tema terang); di tema gelap permukaan sedikit terangkat dari dasar tergelap.
  const sheetBg = colors.surface;
  // Latar kustom (menu titik tiga kartu): sampul profil atau preset. Teks & tombol di atasnya ikut warna sampul.
  const [bg, setBg] = useSheetBg();
  const [walletStack, setWalletStack] = useWalletStack();
  const coverVal = coverValueFor(bg, state.coverPath);
  const custom = coverVal !== undefined;
  const ink = custom ? coverTextColors(coverVal ?? null, scheme) : null;
  const head = { text: ink?.text ?? colors.text, muted: ink?.muted ?? colors.textSecondary };
  const lightHead = head.text.toUpperCase() > '#C'; // teks terang (#E0E0E0/#F4F4F4) di atas latar gelap
  // Di atas latar kustom tombol jadi kaca (blur + redup + tepi terang): batasnya tetap terlihat di atas foto terang
  // maupun gelap, di tema apa pun. Latar polos: kotak tinta.
  const glass: 'dark' | 'light' | null = custom ? (lightHead ? 'dark' : 'light') : null;
  const btn = glass ? { bg: 'transparent', fg: head.text, glass } : { bg: colors.accent, fg: colors.onAccent, glass: null };
  const parsed = custom ? parseCover(coverVal ?? null) : null;
  const photoUri = useSignedUrl(parsed?.kind === 'photo' ? parsed.path : null);
  const [sheetSize, setSheetSize] = useState({ w: 0, h: 0 });
  // Warna dasar latar (foto: redup gelap; batu: abu; preset lain: tinta). Dipakai juga di bawah foto supaya tepi lengkung tidak bocor terang.
  const baseFill = !parsed ? sheetBg : parsed.kind === 'photo' ? '#141414' : parsed.key === 'batu' ? colors.textSecondary : inkCard[scheme].bg;
  const darkTop = custom ? lightHead : scheme === 'dark';
  // Kartu kaca hanya di atas latar kustom (di latar polos blur tidak terlihat apa-apa). Nadanya mengikuti latar:
  // latar gelap (foto redup, garis, lingkar) → kaca gelap tembus pandang dengan palet gelap; latar terang → kaca terang.
  // Dasar 50%/55%: blur terlihat, teks redup tetap ≥4.5:1 karena latar di belakangnya sudah gelap/terang searah.
  const cardTone: ColorScheme | null = custom ? (lightHead ? 'dark' : 'light') : null;
  const cc = cardTone ? buildPalette(cardTone) : colors;
  const cardGlass = cardTone === 'dark' ? 'rgba(18,18,18,0.5)' : 'rgba(250,250,250,0.55)';
  const cardEdge = cardTone === 'dark' ? 'rgba(255,255,255,0.16)' : 'rgba(8,8,8,0.08)';

  // Status bar ikut puncak lembar selama Beranda tampil: teks terang di atas latar gelap. Web iOS: warna area status bar.
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle(darkTop ? 'light' : 'dark');
      setWebChrome(baseFill);
      return () => {
        setStatusBarStyle(scheme === 'dark' ? 'light' : 'dark');
        setWebChrome(colors.bg);
      };
    }, [darkTop, baseFill, scheme, colors.bg]),
  );
  // Angka panjang (di atas ±13 karakter) diringkas agar separuh kartu tidak terpotong di layar 360 px.
  const money = (v: number) => {
    if (hidden) return MASK;
    const full = formatMoney(v, currency);
    if (full.length <= 13) return full;
    const p = formatMoneyParts(v, currency);
    return `${p.symbol}${p.gap || ' '}${formatCompact(v, currency)}`;
  };

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.sheetShadow, scheme === 'light' && elevation.light.card]}>
      <Animated.View
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          if (width !== sheetSize.w || height !== sheetSize.h) setSheetSize({ w: width, h: height });
        }}
        style={[styles.sheet, { backgroundColor: baseFill, paddingTop: insets.top + space.md }]}
      >
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
                  {btn.glass && <Glass tone={btn.glass} radius={24} />}
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
            <SquareButton icon={PiggyBank} label={t('home.goalsA11y')} onPress={() => router.push('/rencana/goals')} bg={btn.bg} fg={btn.fg} glass={btn.glass} />
            <SquareButton
              bg={btn.bg}
              fg={btn.fg}
              glass={btn.glass}
              icon={Bell}
              label={unread ? t('home.notifUnreadA11y', { count: unread }) : t('home.notifA11y')}
              onPress={() => setNotifOpen(true)}
              dot={unread > 0}
            />
          </View>

          <Animated.View
            style={[styles.card, { backgroundColor: custom ? cardGlass : cc.surfaceRaised, borderColor: custom ? cardEdge : cc.border }, custom && styles.cardGlass, elevation[scheme].card]}
          >
            {cardTone && <BlurView intensity={60} tint={cardTone} style={[StyleSheet.absoluteFill, styles.under]} />}
            <SchemeScope scheme={cardTone ?? scheme}>
            <View style={styles.labelRow}>
              <AppText variant="body" tone="secondary">
                {t('home.netWorth')}
              </AppText>
              <PressableScale
                accessibilityLabel={hidden ? t('home.showBalance') : t('home.hideBalance')}
                focusRadius={radius.full}
                hitSlop={6}
                onPress={() => dispatch({ type: 'prefs/hideBalance', value: !hidden })}
                style={[styles.eye, { backgroundColor: cc.surfaceSunken }]}
              >
                <Icon icon={hidden ? EyeOff : Eye} color={cc.textSecondary} size={layout.iconSize.sm} />
              </PressableScale>
              <View style={styles.flex} />
              <HeaderMenu
                trigger={(show) => (
                  <PressableScale accessibilityLabel={t('home.cardMenu')} focusRadius={radius.full} hitSlop={6} onPress={show} style={styles.eye}>
                    <Icon icon={Ellipsis} color={cc.text} />
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
                          {bg === k && <Icon icon={Check} color={cc.text} />}
                        </View>
                      </PressableScale>
                    ))}
                    <View style={[styles.menuRule, { backgroundColor: cc.border }]} />
                    <View style={styles.menuRow}>
                      <AppText variant="body" style={styles.flex}>
                        {t('home.walletStack')}
                      </AppText>
                      <Toggle value={walletStack} onChange={setWalletStack} accessibilityLabel={t('home.walletStack')} />
                    </View>
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
            {/* Lipat/buka: satu gerak tinggi + pudar (satu kurva), isi di bawahnya ikut bergeser halus. Bukan lepas-pasang
                elemen: dulu isi memudar dulu lalu kartu menyusut, jadi geraknya dua tahap dan bagian bawah melompat. */}
            <Animated.View
              style={[styles.foldOuter, foldStyle]}
              pointerEvents={folded ? 'none' : 'auto'}
              accessibilityElementsHidden={folded}
              importantForAccessibility={folded ? 'no-hide-descendants' : 'auto'}
            >
              <Animated.View
                style={[styles.more, moreH > 0 && styles.moreMeasured, innerStyle]}
                onLayout={(e) => {
                  const h = e.nativeEvent.layout.height;
                  if (Math.abs(h - moreH) > 0.5) setMoreH(h);
                }}
              >
                {/* Dua separuh sama lebar: isi rata kiri, pembatas tepat di tengah kartu. */}
                <View style={styles.flow}>
                  <Flow icon={ArrowDownLeft} tone="positive" label={`${t('common.income')}: ${money(income)}`} value={money(income)} />
                  <View style={[styles.divider, { backgroundColor: cc.borderStrong }]} />
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
                      style={[styles.action, { backgroundColor: cc.accent }]}
                    >
                      <Icon icon={a.icon} color={cc.onAccent} size={layout.iconSize.lg} />
                    </PressableScale>
                  ))}
                </View>
              </Animated.View>
            </Animated.View>
          </SchemeScope>
          </Animated.View>
        </View>
      </Animated.View>
      </Animated.View>

      {/* Lekukan: menyambung lembar ke dasar tinta, panahnya melipat/membuka kartu. */}
      <Animated.View style={styles.notchWrap}>
        <PressableScale accessibilityLabel={folded ? t('home.unfold') : t('home.fold')} accessibilityState={{ expanded: !folded }} onPress={toggle} focusRadius={radius.full} scaleTo={0.96}>
          <View style={styles.notch}>
            <Svg width={NOTCH_W} height={NOTCH_H} style={StyleSheet.absoluteFill}>
              {photoUri && sheetSize.w > 0 ? (
                // Latar foto: lekukan berisi potongan foto yang sama (posisi & skala sama dengan lembar) + redup yang sama,
                // jadi foto menyambung mulus ke lekukan seperti latar lain.
                <>
                  <Defs>
                    <ClipPath id="notchClip">
                      <Path d={NOTCH_D} />
                    </ClipPath>
                  </Defs>
                  <G clipPath="url(#notchClip)">
                    <Path d={NOTCH_D} fill={baseFill} />
                    <SvgImage href={{ uri: photoUri }} x={-(sheetSize.w - NOTCH_W) / 2} y={-sheetSize.h + 1} width={sheetSize.w} height={sheetSize.h} preserveAspectRatio="xMidYMid slice" />
                    <Path d={NOTCH_D} fill="rgba(10, 10, 10, 0.6)" />
                  </G>
                </>
              ) : (
                <Path d={NOTCH_D} fill={baseFill} />
              )}
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

/** Kaca: blur latar + redup + tepi terang/gelap. Dipakai tombol & avatar di atas latar kustom. */
function Glass({ tone, radius: r }: { tone: 'dark' | 'light'; radius: number }) {
  return (
    // zIndex -1 di dalam induk ber-zIndex 0: di web elemen absolut tergambar di atas ikon statis kalau tidak.
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: r, overflow: 'hidden', zIndex: -1 }]}>
      <BlurView intensity={30} tint={tone} style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { borderRadius: r, borderWidth: 1, backgroundColor: tone === 'dark' ? 'rgba(0,0,0,0.32)' : 'rgba(255,255,255,0.45)', borderColor: tone === 'dark' ? 'rgba(255,255,255,0.28)' : 'rgba(8,8,8,0.16)' }]} />
    </View>
  );
}

function SquareButton({ icon, label, onPress, dot, bg, fg, glass }: { icon: LucideIcon; label: string; onPress: () => void; dot?: boolean; bg: string; fg: string; glass: 'dark' | 'light' | null }) {
  const { colors } = useTheme();
  return (
    <PressableScale accessibilityLabel={label} onPress={onPress} focusRadius={16} style={[styles.square, { backgroundColor: bg, borderColor: glass ? 'transparent' : colors.borderStrong }]}>
      {glass && <Glass tone={glass} radius={16} />}
      <Icon icon={icon} color={fg} />
      {dot && <View style={[styles.dot, { backgroundColor: colors.warning, borderColor: glass ? 'transparent' : bg }]} />}
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
  // Bayangan di lapisan luar: overflow hidden pada lembar memotong bayangannya sendiri di iOS.
  sheetShadow: { alignSelf: 'stretch', borderBottomLeftRadius: 40, borderBottomRightRadius: 40 },
  sheet: { alignSelf: 'stretch', overflow: 'hidden', borderBottomLeftRadius: 40, borderBottomRightRadius: 40, paddingHorizontal: space.lg, paddingBottom: space.xl, alignItems: 'center' },
  column: { width: '100%', maxWidth: layout.maxContentWidth, gap: space.xl },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.sm + 2 },
  avatar: { zIndex: 0, width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  initial: { fontFamily: fonts.bold, fontSize: 19, lineHeight: 24 },
  hello: { flex: 1, gap: 2 },
  greet: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 26, letterSpacing: -0.5 },
  square: { zIndex: 0, width: 46, height: 46, borderRadius: 16, borderWidth: layout.hairline, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', top: 9, right: 9, width: 9, height: 9, borderRadius: 5, borderWidth: 1.5 },
  card: { borderRadius: radius.sheet, borderWidth: layout.hairline, padding: space.xl, gap: space.md },
  // Tanpa overflow hidden di kartu: di iOS itu memotong bayangan kartu sendiri. Blur sudah dibulatkan di lapisannya.
  cardGlass: { zIndex: 0 },
  under: { zIndex: -1, borderRadius: radius.sheet, overflow: 'hidden' },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  eye: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  // Bungkus lipat: margin negatif meniadakan jarak antar-isi kartu supaya saat terlipat tidak ada sisa ruang.
  foldOuter: { overflow: 'hidden', marginTop: -space.md },
  more: { gap: space.xl, paddingTop: space.md + space.xs },
  moreMeasured: { position: 'absolute', top: 0, left: 0, right: 0 },
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

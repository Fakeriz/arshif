import { ChevronDown, Crown } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, StyleSheet, useWindowDimensions, View, type FlatListProps } from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { usePaywall } from '@/components/shell/Paywall';
import { AppText, BankCard, GlassView, Icon, PressableScale } from '@/components/ui';
import { BANK_CARD_RATIO } from '@/components/ui/BankCard';
import { useT } from '@/i18n';
import type { AccountWithBalance } from '@/state/AppStore';
import { useCreditUtilization } from '@/state/derived';
import { haptic, useMotion } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';
import { layout, radius, space, stripTint } from '@/theme/tokens';

export type AccountDeckProps = {
  accounts: AccountWithBalance[];
  hidden: boolean;
  limitReached: boolean;
  /** Kartu aktif = akun default untuk pencatatan. */
  activeId: string | null;
  onActiveChange: (id: string) => void;
};

type Item = { kind: 'account'; account: AccountWithBalance } | { kind: 'limit' };
type OnViewable = NonNullable<FlatListProps<Item>['onViewableItemsChanged']>;

const STRIP_H = 52;
const DOT = 6;
/** Lebar kartu maksimum; di layar lebar kartu dipusatkan. */
const CARD_MAX = 420;
const VIEWABILITY = { itemVisiblePercentThreshold: 50 };

/**
 * Akun di Home. Tertutup: strip ramping berisi nama akun aktif. Ketuk strip: deck tumbuh dari posisi
 * strip dengan spring (scale + translate + fade). Deck = FlatList paging, satu halaman per akun;
 * geser digerakkan native scroll (tanpa gesture custom), halaman yang terlihat jadi akun aktif.
 * Ketuk kartu untuk menutup kembali.
 */
export function AccountDeck({ accounts, hidden, limitReached, activeId, onActiveChange }: AccountDeckProps) {

  const { colors, scheme } = useTheme();
  const t = useT();
  const utilization = useCreditUtilization();
  // Kartu kredit/paylater: persen terpakai dari limit kartu, atau dari limit gabungan grupnya (FR-ACC-6).
  const footnote = (id: string) => {
    const u = utilization(id);
    if (!u || hidden) return undefined;
    const pct = Math.round(u.ratio * 100);
    return u.scope === 'group' ? t('acct.limit.cardGroupShort', { pct, name: u.groupName ?? '' }) : t('acct.limit.cardShort', { pct });
  };  const paywall = usePaywall();
  const { spring } = useMotion();
  const { width: windowWidth } = useWindowDimensions();
  const [measured, setMeasured] = useState(0);

  // Halaman selebar kolom konten; kartu dibatasi CARD_MAX dan dipusatkan.
  const itemWidth = measured || Math.min(windowWidth - space.lg * 2, layout.maxContentWidth);
  const itemPadding = Math.max(space.lg, (itemWidth - CARD_MAX) / 2);
  const cardW = itemWidth - itemPadding * 2;
  const cardH = Math.round(cardW / BANK_CARD_RATIO);
  const deckH = cardH + space.md + DOT;

  const items: Item[] = [...accounts.map((account) => ({ kind: 'account' as const, account })), ...(limitReached ? [{ kind: 'limit' as const }] : [])];
  const startIndex = Math.max(0, accounts.findIndex((a) => a.id === activeId));
  const [index, setIndex] = useState(startIndex);
  const current = Math.min(index, Math.max(0, items.length - 1));
  const [expanded, setExpanded] = useState(false);

  const open = useSharedValue(0);
  const deckHeight = useSharedValue(deckH);
  useEffect(() => {
    deckHeight.value = deckH;
  }, [deckH, deckHeight]);

  const setOpen = useCallback(
    (next: boolean) => {
      haptic('tap');
      setExpanded(next);
      open.value = spring(next ? 1 : 0);
    },
    [open, spring],
  );

  // onViewableItemsChanged tidak boleh berganti identitas selama FlatList hidup.
  const live = useRef({ index: current, onActiveChange });
  live.current = { index: current, onActiveChange };
  const onViewable = useRef<OnViewable>(({ viewableItems }) => {
    const first = viewableItems[0];
    if (!first || first.index == null || first.index === live.current.index) return;
    setIndex(first.index);
    haptic('selection');
    if (first.item.kind === 'account') live.current.onActiveChange(first.item.account.id);
  }).current;

  // Tinggi wadah ikut spring yang sama, jadi konten di bawahnya bergeser bersama deck.
  const wrapStyle = useAnimatedStyle(() => ({ height: STRIP_H + open.value * (deckHeight.value - STRIP_H) }));
  const stripStyle = useAnimatedStyle(() => ({
    opacity: interpolate(open.value, [0, 0.45], [1, 0], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(open.value, [0, 1], [1, 1.04]) }],
  }));
  const deckStyle = useAnimatedStyle(() => ({
    opacity: interpolate(open.value, [0.1, 0.6], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: (STRIP_H / 2 - deckHeight.value / 2) * (1 - open.value) }, { scale: 0.5 + 0.5 * open.value }],
  }));

  const renderItem = useCallback(
    ({ item }: { item: Item }) => (
      <View style={[styles.page, { width: itemWidth, paddingHorizontal: itemPadding }]}>
        {item.kind === 'account' ? (
          <BankCard
            bank={item.account.bank}
            accountType={t(`domain.accountType.${item.account.type}`)}
            last4={item.account.last4}
            balance={item.account.balance}
            currency={item.account.currency}
            hidden={hidden}
            width={cardW}
            footnote={footnote(item.account.id)}
            onPress={() => setOpen(false)}
          />
        ) : (
          <PressableScale accessibilityLabel={t('home.accountLimitA11y')} focusRadius={radius.lg} onPress={() => paywall(t('home.accountLimitReason'))}>
            <GlassView radius={radius.lg} style={[styles.limit, { width: cardW, height: cardH }]}>
              <View style={[styles.limitIcon, { backgroundColor: colors.accentSoft }]}>
                <Icon icon={Crown} color={colors.accentText} />
              </View>
              <AppText variant="bodyStrong" align="center">
                {t('home.accountLimitTitle')}
              </AppText>
              <AppText variant="caption" tone="secondary" align="center">
                {t('home.accountLimitSub')}
              </AppText>
            </GlassView>
          </PressableScale>
        )}
      </View>
    ),
    [itemWidth, itemPadding, cardW, cardH, hidden, t, colors.accentSoft, colors.accentText, paywall, setOpen, footnote],
  );

  if (items.length === 0) return null;
  const front = items[current]!;
  const frontName = front.kind === 'account' ? front.account.name : t('home.accountLimitTitle');

  return (
    <Animated.View style={[styles.wrap, wrapStyle]} onLayout={(e) => setMeasured(Math.round(e.nativeEvent.layout.width))}>
      <Animated.View
        style={[styles.layer, stripStyle]}
        pointerEvents={expanded ? 'none' : 'auto'}
        importantForAccessibility={expanded ? 'no-hide-descendants' : 'auto'}
        accessibilityElementsHidden={expanded}
      >
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={t('home.deck.stripA11y', { name: frontName })}
          accessibilityHint={t('home.deck.openHint')}
          accessibilityState={{ expanded: false }}
          focusRadius={radius.lg}
          scaleTo={0.985}
          onPress={() => setOpen(true)}
        >
          <GlassView radius={radius.lg} style={styles.strip}>
            <StripTint color={colors.accent} peak={stripTint[scheme]} />
            <View style={styles.stripName}>
              <AppText variant="bodyStrong" numberOfLines={1} style={styles.shrink}>
                {frontName}
              </AppText>
              <Icon icon={ChevronDown} color={colors.textSecondary} size={layout.iconSize.sm + 2} />
            </View>
            {front.kind === 'account' && front.account.last4 && (
              <AppText variant="caption" tone="secondary" numeric>
                {`•••• ${front.account.last4}`}
              </AppText>
            )}
          </GlassView>
        </PressableScale>
      </Animated.View>

      <Animated.View
        style={[styles.layer, deckStyle]}
        pointerEvents={expanded ? 'auto' : 'none'}
        importantForAccessibility={expanded ? 'auto' : 'no-hide-descendants'}
        accessibilityElementsHidden={!expanded}
      >
        <FlatList
          key={itemWidth}
          data={items}
          horizontal
          showsHorizontalScrollIndicator={false}
          pagingEnabled
          snapToInterval={itemWidth}
          snapToAlignment="center"
          decelerationRate="fast"
          keyExtractor={(item) => (item.kind === 'account' ? item.account.id : 'limit')}
          renderItem={renderItem}
          getItemLayout={(_, i) => ({ length: itemWidth, offset: itemWidth * i, index: i })}
          initialScrollIndex={Math.min(startIndex, items.length - 1)}
          onViewableItemsChanged={onViewable}
          viewabilityConfig={VIEWABILITY}
          style={{ height: cardH }}
        />
        {items.length > 1 && (
          <View style={styles.dots} accessible accessibilityLabel={t('home.cardPosition', { n: current + 1, total: items.length })}>
            {items.map((item, i) => (
              <View
                key={item.kind === 'account' ? item.account.id : 'limit'}
                style={[styles.dot, i === current ? [styles.dotActive, { backgroundColor: colors.accent }] : { backgroundColor: colors.textMuted }]}
              />
            ))}
          </View>
        )}
      </Animated.View>
    </Animated.View>
  );
}

/** Bar aksen ramping: tinta aksen dari kiri yang memudar ke kanan. */
function StripTint({ color, peak }: { color: string; peak: number }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} aria-hidden>
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id="striptint" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={color} stopOpacity={peak} />
            <Stop offset="1" stopColor={color} stopOpacity={peak * 0.2} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#striptint)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%' },
  layer: { position: 'absolute', top: 0, left: 0, right: 0 },
  strip: { height: STRIP_H, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md, paddingHorizontal: space.lg },
  stripName: { flexDirection: 'row', alignItems: 'center', gap: space.xs, flexShrink: 1 },
  shrink: { flexShrink: 1 },
  page: { justifyContent: 'center' },
  limit: { alignItems: 'center', justifyContent: 'center', gap: space.sm, padding: space.lg },
  limitIcon: { width: 44, height: 44, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: space.xs + 2, marginTop: space.md, height: DOT },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2 },
  dotActive: { width: DOT * 3 },
});

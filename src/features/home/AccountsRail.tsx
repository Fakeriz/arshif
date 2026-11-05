import { Crown } from 'lucide-react-native';
import { useCallback, useRef, useState } from 'react';
import { FlatList, StyleSheet, useWindowDimensions, View, type FlatListProps } from 'react-native';

import { useT } from '@/i18n';
import { usePaywall } from '@/components/shell/Paywall';
import { AppText, BankCard, GlassView, Icon, PressableScale } from '@/components/ui';
import type { AccountWithBalance } from '@/state/AppStore';
import { useTheme } from '@/theme/ThemeProvider';
import { layout, radius, space } from '@/theme/tokens';

export type AccountsRailProps = {
  accounts: AccountWithBalance[];
  hidden: boolean;
  limitReached: boolean;
  /** Kartu aktif = akun default untuk pencatatan. */
  activeId: string | null;
  onActiveChange: (id: string) => void;
  onPressAccount: (id: string) => void;
};

type Item = { kind: 'account'; account: AccountWithBalance } | { kind: 'limit' };

const VIEWABILITY = { itemVisiblePercentThreshold: 60 };
type OnViewable = NonNullable<FlatListProps<Item>['onViewableItemsChanged']>;

/**
 * Kartu akun per bank, satu kartu per halaman: geser untuk pindah, snap ke tengah.
 * Kartu yang sedang di tengah jadi akun aktif. Titik di bawah menunjukkan posisi
 * (aktif = aksen dan lebih lebar, supaya tidak hanya dibedakan oleh warna; nonaktif = textMuted,
 * bukan warna border, karena border di bawah 3:1 untuk indikator non-teks).
 */
export function AccountsRail({ accounts, hidden, limitReached, activeId, onActiveChange, onPressAccount }: AccountsRailProps) {
  const { colors } = useTheme();
  const paywall = usePaywall();
  const t = useT();
  const { width: windowWidth } = useWindowDimensions();
  const [measured, setMeasured] = useState(0);
  const pageWidth = measured || Math.min(windowWidth, layout.maxContentWidth + space.lg * 2);

  const items: Item[] = [...accounts.map((account) => ({ kind: 'account' as const, account })), ...(limitReached ? [{ kind: 'limit' as const }] : [])];
  const startIndex = Math.max(0, accounts.findIndex((a) => a.id === activeId));
  const [index, setIndex] = useState(startIndex);

  // onViewableItemsChanged tidak boleh berganti identitas selama FlatList hidup.
  const onActiveRef = useRef(onActiveChange);
  onActiveRef.current = onActiveChange;
  const onViewable = useRef<OnViewable>(({ viewableItems }) => {
    const first = viewableItems[0];
    if (!first || first.index == null) return;
    setIndex(first.index);
    if (first.item.kind === 'account') onActiveRef.current(first.item.account.id);
  }).current;

  const renderItem = useCallback(
    ({ item }: { item: Item }) => (
      <View style={[styles.page, { width: pageWidth }]}>
        {item.kind === 'account' ? (
          <BankCard
            bank={item.account.bank}
            accountType={t(`domain.accountType.${item.account.type}`)}
            last4={item.account.last4}
            balance={item.account.balance}
            currency={item.account.currency}
            hidden={hidden}
            onPress={() => onPressAccount(item.account.id)}
          />
        ) : (
          <PressableScale accessibilityLabel={t('home.accountLimitA11y')} focusRadius={radius.lg} onPress={() => paywall(t('home.accountLimitReason'))}>
            <GlassView radius={radius.lg} style={styles.limit}>
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
    [pageWidth, hidden, t, colors.accentSoft, colors.accentText, onPressAccount, paywall],
  );

  return (
    <View style={styles.wrap} onLayout={(e) => setMeasured(Math.round(e.nativeEvent.layout.width))}>
      <FlatList
        key={pageWidth}
        data={items}
        horizontal
        pagingEnabled
        snapToInterval={pageWidth}
        snapToAlignment="center"
        decelerationRate="fast"
        disableIntervalMomentum
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => (item.kind === 'account' ? item.account.id : 'limit')}
        renderItem={renderItem}
        getItemLayout={(_, i) => ({ length: pageWidth, offset: pageWidth * i, index: i })}
        initialScrollIndex={Math.min(startIndex, items.length - 1)}
        onViewableItemsChanged={onViewable}
        viewabilityConfig={VIEWABILITY}
      />
      {items.length > 1 && (
        <View style={styles.dots} accessible accessibilityLabel={t('home.cardPosition', { n: index + 1, total: items.length })}>
          {items.map((item, i) => (
            <View
              key={item.kind === 'account' ? item.account.id : 'limit'}
              style={[styles.dot, i === index ? [styles.dotActive, { backgroundColor: colors.accent }] : { backgroundColor: colors.textMuted }]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const DOT = 6;

const styles = StyleSheet.create({
  wrap: { marginHorizontal: -space.lg, gap: space.md },
  page: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.lg },
  limit: { width: 280, height: 168, alignItems: 'center', justifyContent: 'center', gap: space.sm, padding: space.lg },
  limitIcon: { width: 44, height: 44, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: space.xs + 2 },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2 },
  dotActive: { width: DOT * 3 },
});

import { Plus, type LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useT } from '@/i18n';
import { useTheme } from '@/theme/ThemeProvider';
import { elevation, fonts, layout, radius, space } from '@/theme/tokens';

import { AppText } from './AppText';
import { GlassView } from './GlassView';
import { Icon } from './Icon';
import { PressableScale } from './PressableScale';

export type TabBarItem<K extends string> = { key: K; label: string; icon: LucideIcon };

export type GlassTabBarProps<K extends string> = {
  /** Empat tab Arshif (Home, Transaksi, Anggaran, Aset); tombol "+ Catat" di tengah. */
  items: [TabBarItem<K>, TabBarItem<K>, TabBarItem<K>, TabBarItem<K>];
  value: K;
  onChange: (key: K) => void;
  onPressAdd: () => void;
  /** false = ikut alur layout (Lembar Desain); true = mengambang di bawah layar. */
  floating?: boolean;
  /** Ruang vertikal yang dipakai pill dari tepi bawah layar (tinggi + jarak), untuk padding konten. */
  onFootprint?: (px: number) => void;
};

/** Bottom nav (Talmo .tabbar): kotak mengambang, tab aktif = blok tinta; tombol Catat di tengah. */
export function GlassTabBar<K extends string>({ items, value, onChange, onPressAdd, floating = true, onFootprint }: GlassTabBarProps<K>) {
  const { colors, scheme } = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  const renderTab = (item: TabBarItem<K>) => {
    const active = item.key === value;
    return (
      <PressableScale
        key={item.key}
        accessibilityRole="tab"
        aria-selected={active}
        accessibilityLabel={item.label}
        onPress={() => onChange(item.key)}
        containerStyle={styles.slot}
        focusRadius={radius.tabItem}
        style={[styles.tab, active && { backgroundColor: colors.accent }]}
      >
        <Icon icon={item.icon} color={active ? colors.onAccent : colors.textMuted} size={layout.iconSize.md} />
        <AppText variant="overline" tone={active ? 'onAccent' : 'muted'} numberOfLines={1} style={styles.label}>
          {item.label}
        </AppText>
      </PressableScale>
    );
  };

  return (
    <View
      pointerEvents="box-none"
      onLayout={floating && onFootprint ? (e) => onFootprint(e.nativeEvent.layout.height + Math.max(insets.bottom, space.md)) : undefined}
      style={floating ? [styles.anchor, { bottom: Math.max(insets.bottom, space.md) }] : styles.inline}
    >
      <GlassView level="floating" radius={radius.tabBar} style={[styles.pill, elevation[scheme].floating]}>
        <View accessibilityRole="tablist" style={styles.row}>
          {items.slice(0, 2).map(renderTab)}
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={t('common.addTransaction')}
            onPress={onPressAdd}
            hapticOnPress
            focusRadius={radius.full}
            style={[styles.add, { backgroundColor: colors.accent }]}
          >
            <Icon icon={Plus} color={colors.onAccent} size={layout.iconSize.lg} />
          </PressableScale>
          {items.slice(2).map(renderTab)}
        </View>
      </GlassView>
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: { position: 'absolute', left: space.md - 2, right: space.md - 2, alignItems: 'center' },
  inline: { alignItems: 'center', alignSelf: 'stretch' },
  pill: { width: '100%', maxWidth: layout.maxContentWidth, padding: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  slot: { flex: 1 },
  tab: { height: 54, borderRadius: radius.tabItem, alignItems: 'center', justifyContent: 'center', gap: 3 },
  label: { fontFamily: fonts.semibold },
  add: { width: 48, height: 48, marginHorizontal: space.xs, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
});

import { Plus, type LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/ThemeProvider';
import { layout, radius, space } from '@/theme/tokens';

import { AppText } from './AppText';
import { GlassView } from './GlassView';
import { Icon } from './Icon';
import { PressableScale } from './PressableScale';

export type TabBarItem<K extends string> = { key: K; label: string; icon: LucideIcon };

export type GlassTabBarProps<K extends string> = {
  /** Empat tab Arshif (Home, Transaksi, Planning, Coach); tombol "+ Catat" di tengah. */
  items: [TabBarItem<K>, TabBarItem<K>, TabBarItem<K>, TabBarItem<K>];
  value: K;
  onChange: (key: K) => void;
  onPressAdd: () => void;
  /** false = ikut alur layout (Lembar Desain); true = mengambang di bawah layar. */
  floating?: boolean;
};

/** Bottom nav: pill kaca mengambang, ikon tab aktif memakai warna aksen. */
export function GlassTabBar<K extends string>({ items, value, onChange, onPressAdd, floating = true }: GlassTabBarProps<K>) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const renderTab = (item: TabBarItem<K>) => {
    const active = item.key === value;
    return (
      <PressableScale
        key={item.key}
        accessibilityRole="tab"
        accessibilityState={{ selected: active }}
        accessibilityLabel={item.label}
        onPress={() => onChange(item.key)}
        containerStyle={styles.slot}
        focusRadius={radius.full}
        style={[styles.tab, active && { backgroundColor: colors.accentSoft }]}
      >
        <Icon icon={item.icon} color={active ? colors.accentText : colors.textSecondary} size={layout.iconSize.md + 2} />
        <AppText variant="overline" tone={active ? 'primary' : 'secondary'} numberOfLines={1}>
          {item.label}
        </AppText>
      </PressableScale>
    );
  };

  return (
    <View
      pointerEvents="box-none"
      style={floating ? [styles.anchor, { bottom: Math.max(insets.bottom, space.md) }] : styles.inline}
    >
      <GlassView level="floating" radius={radius.full} style={styles.pill}>
        <View accessibilityRole="tablist" style={styles.row}>
          {items.slice(0, 2).map(renderTab)}
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Catat transaksi"
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
  anchor: { position: 'absolute', left: space.lg, right: space.lg, alignItems: 'center' },
  inline: { alignItems: 'center', alignSelf: 'stretch' },
  pill: { width: '100%', maxWidth: layout.maxContentWidth, padding: space.xs + 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  slot: { flex: 1 },
  tab: { minHeight: 52, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', gap: space.xxs },
  add: { width: 52, height: 52, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
});

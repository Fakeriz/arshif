import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { layout, radius, space } from '@/theme/tokens';

import { AppText } from './AppText';
import { GlassView } from './GlassView';
import { Icon } from './Icon';
import { PressableScale } from './PressableScale';

export type QuickAction = {
  key: string;
  label: string;
  icon: LucideIcon;
  onPress: () => void;
  /** Satu aksi utama memakai aksen penuh; sisanya lingkaran kaca netral. */
  primary?: boolean;
};

/** Panel kaca berisi tombol aksi bulat (pola aksi cepat). */
export function QuickActions({ actions }: { actions: QuickAction[] }) {
  const { colors } = useTheme();
  return (
    <GlassView radius={radius.lg} style={styles.panel}>
      <View style={styles.row}>
        {actions.map((a) => (
          <PressableScale
            key={a.key}
            onPress={a.onPress}
            hapticOnPress={a.primary}
            accessibilityLabel={a.label}
            containerStyle={styles.slot}
            focusRadius={radius.md}
            style={styles.item}
          >
            <View
              style={[
                styles.circle,
                a.primary
                  ? { backgroundColor: colors.accent }
                  : { backgroundColor: colors.track, borderColor: colors.glassBorder, borderWidth: layout.hairline },
              ]}
            >
              <Icon icon={a.icon} color={a.primary ? colors.onAccent : colors.text} size={layout.iconSize.lg} />
            </View>
            <AppText variant="caption" tone={a.primary ? 'primary' : 'secondary'} align="center" numberOfLines={1}>
              {a.label}
            </AppText>
          </PressableScale>
        ))}
      </View>
    </GlassView>
  );
}

const styles = StyleSheet.create({
  panel: { paddingVertical: space.lg, paddingHorizontal: space.sm },
  row: { flexDirection: 'row' },
  slot: { flex: 1 },
  item: { alignItems: 'center', gap: space.sm, paddingVertical: space.xs },
  circle: { width: 56, height: 56, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
});

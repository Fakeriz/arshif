import { Plus, type LucideIcon } from 'lucide-react-native';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay } from 'react-native-reanimated';

import { useT } from '@/i18n';
import { useMotion } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';
import { layout, radius, space } from '@/theme/tokens';

import { AppText } from './AppText';
import { Icon } from './Icon';
import { PressableScale } from './PressableScale';

export type SpeedDialAction = { key: string; label: string; icon: LucideIcon; onPress: () => void; /** Lencana hitungan, mis. pengingat baru. */ badge?: number };
export type SpeedDialProps = { open: boolean; onToggle: () => void; actions: SpeedDialAction[] };

const SIZE = 48;

/** Tombol aksi cepat: + berputar jadi ×, aksi muncul bergiliran ke samping. */
export function SpeedDial({ open, onToggle, actions }: SpeedDialProps) {
  const { colors } = useTheme();
  const t = useT();
  const { spring } = useMotion();
  const r = useSharedValue(open ? 1 : 0);
  useEffect(() => {
    r.value = spring(open ? 1 : 0);
  }, [open, r, spring]);
  const glyph = useAnimatedStyle(() => ({ transform: [{ rotate: `${r.value * 45}deg` }] }));

  return (
    <View style={styles.row}>
      <PressableScale accessibilityLabel={open ? t('common.ui.closeActions') : t('common.ui.openActions')} aria-expanded={open} onPress={onToggle} hapticOnPress focusRadius={radius.full} style={[styles.button, { backgroundColor: colors.accent }]}>
        <Animated.View style={glyph}>
          <Icon icon={Plus} color={colors.onAccent} />
        </Animated.View>
      </PressableScale>
      {actions.map((a, i) => (
        <Action key={a.key} action={a} index={i} open={open} last={actions.length - 1} />
      ))}
    </View>
  );
}

function Action({ action, index, open, last }: { action: SpeedDialAction; index: number; open: boolean; last: number }) {
  const { colors } = useTheme();
  const { spring } = useMotion();
  const v = useSharedValue(open ? 1 : 0);
  useEffect(() => {
    // Buka: dari yang terdekat. Tutup: dari yang terjauh.
    v.value = withDelay((open ? index : last - index) * 45, spring(open ? 1 : 0));
  }, [open, index, last, v, spring]);
  const style = useAnimatedStyle(() => ({
    opacity: Math.max(0, Math.min(1, v.value)),
    transform: [{ translateX: (1 - v.value) * -(SIZE + space.md) * (index + 1) * 0.5 }, { scale: 0.5 + v.value * 0.5 }],
  }));

  return (
    <Animated.View pointerEvents={open ? 'auto' : 'none'} aria-hidden={!open} style={style}>
      <PressableScale accessibilityLabel={action.badge ? `${action.label}, ${action.badge}` : action.label} onPress={action.onPress} focusRadius={radius.full} style={[styles.button, { backgroundColor: colors.surfaceRaised, borderColor: colors.borderStrong, borderWidth: layout.hairline }]}>
        <Icon icon={action.icon} color={colors.text} />
      </PressableScale>
      {!!action.badge && (
        <View pointerEvents="none" style={[styles.badge, { backgroundColor: colors.negative, borderColor: colors.surface }]}>
          <AppText variant="overline" numeric style={{ color: colors.bg }}>
            {action.badge > 9 ? '9+' : action.badge}
          </AppText>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  button: { width: SIZE, height: SIZE, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -4, right: -4, minWidth: 20, height: 20, paddingHorizontal: 4, borderRadius: radius.full, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});

import { Check, ChevronDown } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { haptic, useEnter, useMotion } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';
import { layout, motion, radius, space } from '@/theme/tokens';

import { AppText } from './AppText';
import { GlassView } from './GlassView';
import { Icon } from './Icon';
import { PopIn } from './PopIn';
import { PressableScale } from './PressableScale';

export type SelectItem<K extends string> = { key: K; label: string };
export type SelectProps<K extends string> = { label: string; items: SelectItem<K>[]; value: K; onChange: (key: K) => void };

/**
 * Pilihan tarik-turun sebaris (menu mendorong konten di bawahnya, bukan melayang): cocok untuk
 * form pendek di dalam kartu/sheet. Menu turun dengan pegas, opsinya masuk bergiliran.
 */
export function Select<K extends string>({ label, items, value, onChange }: SelectProps<K>) {
  const { colors } = useTheme();
  const { spring, timing } = useMotion();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const t = useSharedValue(0);
  const current = items.find((i) => i.key === value);

  useEffect(() => {
    if (open) {
      setMounted(true);
      t.value = spring(1);
      return;
    }
    t.value = timing(0, motion.fast);
    const id = setTimeout(() => setMounted(false), motion.fast);
    return () => clearTimeout(id);
  }, [open, t, spring, timing]);

  const menu = useAnimatedStyle(() => ({
    opacity: Math.max(0, Math.min(1, t.value)),
    transform: [{ translateY: (1 - t.value) * -8 }, { scale: 0.96 + t.value * 0.04 }],
  }));
  const chevron = useAnimatedStyle(() => ({ transform: [{ rotate: `${t.value * 180}deg` }] }));

  return (
    <View style={styles.wrap}>
      <AppText variant="caption" tone="secondary">
        {label}
      </AppText>
      <PressableScale
        accessibilityLabel={`${label}, ${current?.label ?? ''}`}
        aria-expanded={open}
        onPress={() => setOpen((o) => !o)}
        scaleTo={0.985}
        focusRadius={radius.control}
        style={[styles.trigger, { backgroundColor: colors.surfaceSunken, borderColor: open ? colors.accent : colors.border }]}
      >
        <AppText variant="bodyStrong" numberOfLines={1} style={styles.flex}>
          {current?.label}
        </AppText>
        <Animated.View style={chevron}>
          <Icon icon={ChevronDown} color={colors.textMuted} />
        </Animated.View>
      </PressableScale>
      {mounted && (
        <Animated.View style={[styles.menuWrap, menu]}>
          <GlassView level="floating" radius={radius.lg} style={styles.menu}>
            {items.map((item, i) => (
              <Option
                key={item.key}
                label={item.label}
                selected={item.key === value}
                index={i}
                onPress={() => {
                  haptic('selection');
                  onChange(item.key);
                  setOpen(false);
                }}
              />
            ))}
          </GlassView>
        </Animated.View>
      )}
    </View>
  );
}

function Option({ label, selected, index, onPress }: { label: string; selected: boolean; index: number; onPress: () => void }) {
  const { colors } = useTheme();
  const enter = useEnter({ delay: 30 + index * 35, y: -6 });
  return (
    <Animated.View style={enter}>
      <PressableScale accessibilityRole="menuitem" aria-selected={selected} accessibilityLabel={label} onPress={onPress} scaleTo={0.985} focusRadius={radius.inset} style={[styles.option, selected && { backgroundColor: colors.accentSoft }]}>
        <AppText variant="body" tone={selected ? 'accent' : 'secondary'} style={styles.flex}>
          {label}
        </AppText>
        <PopIn visible={selected} from={0.3}>
          <Icon icon={Check} color={colors.accentText} size={layout.iconSize.sm} />
        </PopIn>
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs + 2 },
  flex: { flex: 1 },
  trigger: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: layout.inputHeight, paddingHorizontal: space.lg, borderRadius: radius.control, borderWidth: layout.hairline },
  menuWrap: { transformOrigin: 'top' },
  menu: { padding: space.xs + 2, gap: space.xxs },
  option: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 40, paddingHorizontal: space.md, borderRadius: radius.inset },
});

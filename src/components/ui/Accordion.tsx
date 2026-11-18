import { ChevronDown } from 'lucide-react-native';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { useEnter, useMotion } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';
import { layout, radius, space } from '@/theme/tokens';

import { AppText } from './AppText';
import { Icon } from './Icon';
import { PressableScale } from './PressableScale';

export type AccordionItem<K extends string> = { key: K; title: string; body: string };
export type AccordionProps<K extends string> = { items: AccordionItem<K>[]; value: K | null; onChange: (key: K | null) => void };

/**
 * Tanya-jawab lipat, satu terbuka. Sesuai aturan gerak (hanya transform + opasitas): tinggi berubah
 * langsung, isi masuk dengan geser + pudar, panah berputar.
 */
export function Accordion<K extends string>({ items, value, onChange }: AccordionProps<K>) {
  const { colors } = useTheme();
  return (
    <View>
      {items.map((item, i) => {
        const open = item.key === value;
        return (
          <View key={item.key} style={i > 0 && { borderTopWidth: layout.hairline, borderTopColor: colors.border }}>
            <PressableScale accessibilityLabel={item.title} aria-expanded={open} onPress={() => onChange(open ? null : item.key)} scaleTo={0.99} focusRadius={radius.sm} style={styles.head}>
              <AppText variant="bodyStrong" style={styles.title}>
                {item.title}
              </AppText>
              <Chevron open={open} />
            </PressableScale>
            {open && <Body text={item.body} />}
          </View>
        );
      })}
    </View>
  );
}

function Chevron({ open }: { open: boolean }) {
  const { colors } = useTheme();
  const { spring } = useMotion();
  const r = useSharedValue(open ? 1 : 0);
  useEffect(() => {
    r.value = spring(open ? 1 : 0);
  }, [open, r, spring]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${r.value * 180}deg` }] }));
  return (
    <Animated.View style={style}>
      <Icon icon={ChevronDown} color={colors.textMuted} size={layout.iconSize.md} />
    </Animated.View>
  );
}

function Body({ text }: { text: string }) {
  const enter = useEnter({ y: -8 });
  return (
    <Animated.View style={[styles.body, enter]}>
      <AppText variant="caption" tone="secondary">
        {text}
      </AppText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 48, paddingVertical: space.md },
  title: { flex: 1 },
  body: { paddingBottom: space.md },
});

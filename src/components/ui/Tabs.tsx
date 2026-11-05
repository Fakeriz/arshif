import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { useMotion } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';
import { layout, radius, space } from '@/theme/tokens';

import { AppText } from './AppText';
import { PressableScale } from './PressableScale';

export type TabItem<K extends string> = { key: K; label: string };

export type TabsProps<K extends string> = {
  items: TabItem<K>[];
  value: K;
  onChange: (key: K) => void;
  variant?: 'segmented' | 'underline';
  accessibilityLabel?: string;
};

export function Tabs<K extends string>({
  items,
  value,
  onChange,
  variant = 'segmented',
  accessibilityLabel,
}: TabsProps<K>) {
  const { colors } = useTheme();
  const { spring } = useMotion();
  const [width, setWidth] = useState(0);
  const index = Math.max(0, items.findIndex((i) => i.key === value));
  const segment = items.length > 0 ? width / items.length : 0;
  const x = useSharedValue(0);

  useEffect(() => {
    x.value = spring(index * segment);
  }, [index, segment, spring, x]);

  const indicator = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const segmented = variant === 'segmented';
  const pad = segmented ? space.xs : 0;

  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width - pad * 2)}
      style={[
        styles.wrap,
        segmented
          ? { backgroundColor: colors.track, borderColor: colors.glassBorder, padding: pad, borderRadius: radius.md, borderWidth: layout.hairline }
          : { borderBottomWidth: layout.hairline, borderBottomColor: colors.border },
      ]}
    >
      {width > 0 && (
        <Animated.View
          style={[
            segmented
              ? [styles.pill, { top: pad, bottom: pad, left: pad, backgroundColor: colors.surfaceRaised, borderColor: colors.borderStrong }]
              : [styles.underline, { backgroundColor: colors.accent }],
            { width: segment },
            indicator,
          ]}
        />
      )}
      {items.map((item) => {
        const active = item.key === value;
        return (
          <PressableScale
            key={item.key}
            accessibilityRole="tab"
            aria-selected={active}
            accessibilityLabel={item.label}
            onPress={() => onChange(item.key)}
            focusRadius={radius.sm}
            scaleTo={0.98}
            containerStyle={styles.tabSlot}
            style={styles.tab}
          >
            <AppText variant="caption" tone={active ? (segmented ? 'primary' : 'accent') : 'muted'} numberOfLines={1}>
              {item.label}
            </AppText>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', position: 'relative' },
  tabSlot: { flex: 1 },
  tab: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.sm },
  pill: { position: 'absolute', borderRadius: radius.sm, borderWidth: layout.hairline },
  underline: { position: 'absolute', bottom: -1, left: 0, height: 2, borderRadius: radius.full },
});

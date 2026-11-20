import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { useMotion } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, layout, radius, space } from '@/theme/tokens';

import { AppText } from './AppText';
import { PressableScale } from './PressableScale';

export type TabItem<K extends string> = { key: K; label: string };

export type TabsProps<K extends string> = {
  items: TabItem<K>[];
  value: K;
  onChange: (key: K) => void;
  /** segmented = Talmo .seg (track abu, thumb kertas); underline = Talmo .tabs. */
  variant?: 'segmented' | 'underline';
  /** ink = thumb tinta + teks terbalik (Talmo .seg--ink), untuk pilihan tampilan utama. */
  tone?: 'plain' | 'ink';
  accessibilityLabel?: string;
};

export function Tabs<K extends string>({
  items,
  value,
  onChange,
  variant = 'segmented',
  tone = 'plain',
  accessibilityLabel,
}: TabsProps<K>) {
  const { colors, scheme } = useTheme();
  const { spring } = useMotion();
  const [width, setWidth] = useState(0);
  const index = Math.max(0, items.findIndex((i) => i.key === value));
  const segmented = variant === 'segmented';
  const pad = segmented ? layout.segPad : 0;
  const segment = items.length > 0 ? width / items.length : 0;
  const x = useSharedValue(0);

  useEffect(() => {
    x.value = spring(index * segment);
  }, [index, segment, spring, x]);

  const indicator = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const ink = segmented && tone === 'ink';
  // Talmo: thumb = warna kartu (gelap: solid-2) dengan bayangan tipis; ink = isi aksen tanpa bayangan.
  const thumb = ink ? colors.accent : scheme === 'dark' ? colors.surfaceRaised : colors.surface;

  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width - pad * 2)}
      style={[
        styles.wrap,
        segmented
          ? { backgroundColor: colors.surfaceAlt, borderColor: colors.border, padding: pad, borderRadius: radius.seg, borderWidth: layout.hairline }
          : { borderBottomWidth: layout.hairline, borderBottomColor: colors.border, gap: space.xs },
      ]}
    >
      {width > 0 && (
        <Animated.View
          style={[
            segmented
              ? [styles.thumb, { top: pad, bottom: pad, left: pad, backgroundColor: thumb }, !ink && styles.thumbShadow]
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
            focusRadius={segmented ? radius.segItem : radius.sm}
            scaleTo={0.98}
            containerStyle={styles.tabSlot}
            style={segmented ? styles.segItem : styles.tab}
          >
            <AppText
              variant={segmented ? 'caption' : 'bodyStrong'}
              tone={active ? (ink ? 'onAccent' : 'primary') : 'muted'}
              numberOfLines={1}
              style={styles.label}
            >
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
  segItem: { flex: 1, height: layout.segItemHeight, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 11, borderRadius: radius.segItem },
  tab: { flex: 1, height: 42, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.md },
  label: { fontFamily: fonts.semibold },
  thumb: { position: 'absolute', borderRadius: radius.segItem },
  thumbShadow: { shadowColor: '#000000', shadowOpacity: 0.12, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  underline: { position: 'absolute', bottom: -1, left: 0, height: 2 },
});

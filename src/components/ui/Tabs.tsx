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
  /** segmented = Motion Kit .am-seg (track cekung pill, thumb kertas); underline = Talmo .tabs. */
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
  // Thumb kertas terangkat di atas track cekung; ink = isi aksen tanpa bayangan.
  // Gelap: kartu lebih gelap dari track agar thumb tetap terbaca.
  const thumb = ink ? colors.accent : scheme === 'dark' ? colors.surface : colors.surfaceRaised;

  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width - pad * 2)}
      style={[
        styles.wrap,
        segmented
          ? { backgroundColor: colors.surfaceSunken, padding: pad, borderRadius: radius.seg }
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
              variant="bodyStrong"
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
  // Lebar dari slot; isi tidak memakai flex agar tinggi tetap (flex: 1 di web menimpa height).
  tabSlot: { flex: 1 },
  segItem: { height: layout.segItemHeight, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.md, borderRadius: radius.segItem },
  tab: { height: 42, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.md },
  label: { fontFamily: fonts.semibold },
  thumb: { position: 'absolute', borderRadius: radius.segItem },
  thumbShadow: { shadowColor: '#000000', shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  underline: { position: 'absolute', bottom: -1, left: 0, height: 2 },
});

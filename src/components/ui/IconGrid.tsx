import type { LucideIcon } from 'lucide-react-native';
import { useRef, useState, type ComponentRef } from 'react';
import { ScrollView, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

import { useT } from '@/i18n';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

import { hexWithAlpha } from './CategoryIcon';
import { Icon } from './Icon';
import { PressableScale } from './PressableScale';

/** tint = warna ikon (warna kategori); tanpa tint = warna teks biasa. label = nama untuk pembaca layar. */
export type IconGridItem = { key: string; icon: LucideIcon; label: string; tint?: string };

const ROWS = 2;
const MIN_CELL = 60;
const DOT_HIT = 24;

/**
 * Grid ikon yang digeser per halaman (2 baris). Kolom dihitung dari lebar: 4 sampai 7, sel minimal 60 px, lingkaran 48 px
 * (target ketuk). Titik halaman bisa diketuk supaya web/keyboard tidak bergantung pada geser.
 */
export function IconGrid({ items, value, onChange, accessibilityLabel }: { items: IconGridItem[]; value: string | null; onChange: (key: string) => void; accessibilityLabel: string }) {
  const { colors } = useTheme();
  const t = useT();
  const [width, setWidth] = useState(0);
  const [page, setPage] = useState(0);
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);
  const cols = Math.max(4, Math.min(7, Math.floor(width / MIN_CELL) || 4));
  const per = cols * ROWS;
  const pages = Array.from({ length: Math.max(1, Math.ceil(items.length / per)) }, (_, i) => items.slice(i * per, (i + 1) * per));
  const cell = width ? width / cols : MIN_CELL;

  const goTo = (p: number, animated = true) => {
    setPage(p);
    scroller.current?.scrollTo({ x: p * width, animated });
  };
  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => width && setPage(Math.round(e.nativeEvent.contentOffset.x / width));

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      onLayout={(e) => {
        const w = Math.round(e.nativeEvent.layout.width);
        if (w === width) return;
        setWidth(w);
        // Buka di halaman yang berisi pilihan sekarang.
        const idx = items.findIndex((i) => i.key === value);
        const p = idx < 0 ? 0 : Math.floor(idx / (Math.max(4, Math.min(7, Math.floor(w / MIN_CELL))) * ROWS));
        setPage(p);
        requestAnimationFrame(() => scroller.current?.scrollTo({ x: p * w, animated: false }));
      }}
    >
      {width > 0 && (
        <ScrollView ref={scroller} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={onScrollEnd} onScrollEndDrag={onScrollEnd} scrollEventThrottle={16}>
          {pages.map((list, p) => (
            <View key={p} style={[styles.page, { width }]}>
              {list.map((it) => {
                const selected = it.key === value;
                const tint = it.tint ?? colors.text;
                return (
                  <View key={it.key} style={[styles.cell, { width: cell }]}>
                    <PressableScale
                      accessibilityRole="radio"
                      accessibilityLabel={it.label}
                      accessibilityState={{ selected }}
                      focusRadius={radius.full}
                      onPress={() => onChange(it.key)}
                      style={[
                        styles.circle,
                        { backgroundColor: it.tint ? hexWithAlpha(it.tint, selected ? 0.28 : 0.13) : selected ? colors.accentSoft : colors.surfaceAlt, borderColor: selected ? colors.text : 'transparent' },
                      ]}
                    >
                      <Icon icon={it.icon} color={tint} size={22} />
                    </PressableScale>
                  </View>
                );
              })}
            </View>
          ))}
        </ScrollView>
      )}
      {pages.length > 1 && (
        <View style={styles.dots}>
          {pages.map((_, p) => (
            <PressableScale key={p} accessibilityRole="button" accessibilityLabel={t('common.page', { n: p + 1, total: pages.length })} accessibilityState={{ selected: p === page }} focusRadius={radius.full} onPress={() => goTo(p)} style={styles.dotHit}>
              <View style={[styles.dot, { backgroundColor: p === page ? colors.text : colors.borderStrong, width: p === page ? 16 : 6 }]} />
            </PressableScale>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flexDirection: 'row', flexWrap: 'wrap', alignContent: 'flex-start' },
  cell: { alignItems: 'center', paddingVertical: space.xs },
  circle: { width: 48, height: 48, borderRadius: radius.full, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', justifyContent: 'center', marginTop: space.xxs },
  dotHit: { height: DOT_HIT, minWidth: DOT_HIT, alignItems: 'center', justifyContent: 'center' },
  dot: { height: 6, borderRadius: radius.full },
});

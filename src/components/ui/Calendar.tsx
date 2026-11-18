import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { CALENDARS, useI18n } from '@/i18n';
import { haptic, useEnter, useMotion } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';
import { motion, radius, space } from '@/theme/tokens';

import { AppText } from './AppText';
import { Icon } from './Icon';
import { PressableScale } from './PressableScale';

const ROW = 40;
const DOT = 34;

/** Kunci tanggal lokal "YYYY-MM-DD" (tanpa pergeseran zona waktu). */
export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export type CalendarProps = {
  value: Date | null;
  onChange: (date: Date) => void;
  /** Tanggal bertanda titik (jatuh tempo, gajian), kunci dari `dateKey`. */
  marked?: string[];
  today?: Date;
  minDate?: Date;
  maxDate?: Date;
};

/**
 * Kalender bulanan. Lingkaran pilihan satu elemen yang meluncur dengan pegas ke tanggal baru;
 * ganti bulan = kisi baru masuk dari arah navigasi.
 */
export function Calendar({ value, onChange, marked = [], today = new Date(), minDate, maxDate }: CalendarProps) {
  const { colors } = useTheme();
  const { lang, t } = useI18n();
  const { spring, timing } = useMotion();
  const cal = CALENDARS[lang];
  const anchor = value ?? today;
  const [view, setView] = useState({ y: anchor.getFullYear(), m: anchor.getMonth(), dir: 1 as 1 | -1 });
  const [width, setWidth] = useState(0);

  const first = new Date(view.y, view.m, 1).getDay();
  const count = new Date(view.y, view.m + 1, 0).getDate();
  const cell = width / 7;
  const inView = !!value && value.getFullYear() === view.y && value.getMonth() === view.m;
  const index = inView ? first + value.getDate() - 1 : 0;

  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const shown = useSharedValue(0);
  useEffect(() => {
    if (inView) {
      x.value = spring((index % 7) * cell + (cell - DOT) / 2);
      y.value = spring(Math.floor(index / 7) * ROW + (ROW - DOT) / 2);
    }
    shown.value = timing(inView ? 1 : 0, motion.fast);
  }, [inView, index, cell, x, y, shown, spring, timing]);
  const dot = useAnimatedStyle(() => ({ opacity: shown.value, transform: [{ translateX: x.value }, { translateY: y.value }] }));

  const go = (dir: 1 | -1) => {
    const d = new Date(view.y, view.m + dir, 1);
    setView({ y: d.getFullYear(), m: d.getMonth(), dir });
  };
  const todayKey = dateKey(today);
  const min = minDate ? dateKey(minDate) : null;
  const max = maxDate ? dateKey(maxDate) : null;

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Slide key={`${view.y}-${view.m}`} dir={view.dir} style={styles.title}>
          <AppText variant="h3" accessibilityRole="header" aria-live="polite">
            {cal.months[view.m]} {view.y}
          </AppText>
        </Slide>
        <PressableScale accessibilityLabel={t('common.ui.prevMonth')} onPress={() => go(-1)} focusRadius={radius.full} hitSlop={6} style={[styles.nav, { backgroundColor: colors.track }]}>
          <Icon icon={ChevronLeft} color={colors.text} size={18} />
        </PressableScale>
        <PressableScale accessibilityLabel={t('common.ui.nextMonth')} onPress={() => go(1)} focusRadius={radius.full} hitSlop={6} style={[styles.nav, { backgroundColor: colors.track }]}>
          <Icon icon={ChevronRight} color={colors.text} size={18} />
        </PressableScale>
      </View>

      <View style={styles.week} aria-hidden>
        {cal.daysShort.map((d) => (
          <AppText key={d} variant="overline" tone="muted" align="center" style={styles.weekCell}>
            {d}
          </AppText>
        ))}
      </View>

      <View style={styles.body} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 && <Animated.View pointerEvents="none" style={[styles.dot, { backgroundColor: colors.accent }, dot]} />}
        <Slide key={`${view.y}-${view.m}`} dir={view.dir} style={styles.grid}>
          {Array.from({ length: first }, (_, i) => (
            <View key={`pad-${i}`} style={styles.cell} />
          ))}
          {Array.from({ length: count }, (_, i) => {
            const date = new Date(view.y, view.m, i + 1);
            const key = dateKey(date);
            const selected = inView && value.getDate() === i + 1;
            const disabled = (min !== null && key < min) || (max !== null && key > max);
            return (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityLabel={`${cal.days[date.getDay()]}, ${i + 1} ${cal.months[view.m]} ${view.y}`}
                aria-selected={selected}
                aria-disabled={disabled}
                disabled={disabled}
                onPress={() => {
                  haptic('selection');
                  onChange(date);
                }}
                style={styles.cell}
              >
                {key === todayKey && !selected && <View style={[styles.today, { borderColor: colors.borderStrong }]} />}
                <AppText variant="bodyStrong" numeric tone={selected ? 'onAccent' : disabled ? 'muted' : 'primary'} style={disabled && styles.dim}>
                  {i + 1}
                </AppText>
                {marked.includes(key) && <View style={[styles.mark, { backgroundColor: selected ? colors.onAccent : colors.textMuted }]} />}
              </Pressable>
            );
          })}
        </Slide>
      </View>
    </View>
  );
}

function Slide({ dir, style, children }: { dir: 1 | -1; style?: object; children: ReactNode }) {
  const enter = useEnter({ x: 24 * dir });
  return <Animated.View style={[style, enter]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  title: { flex: 1 },
  nav: { width: 32, height: 32, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  week: { flexDirection: 'row' },
  weekCell: { flex: 1 },
  // Enam baris tetap: tinggi kartu tidak melompat antara bulan 5 dan 6 minggu.
  body: { height: ROW * 6, overflow: 'hidden' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, height: ROW, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', left: 0, top: 0, width: DOT, height: DOT, borderRadius: radius.full },
  today: { position: 'absolute', width: DOT, height: DOT, borderRadius: radius.full, borderWidth: 1.5 },
  mark: { position: 'absolute', bottom: 3, width: 4, height: 4, borderRadius: radius.full },
  dim: { opacity: 0.5 },
});

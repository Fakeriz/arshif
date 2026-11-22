import {
  Banknote,
  CalendarClock,
  ChartPie,
  Coffee,
  Coins,
  CreditCard,
  FileText,
  Gift,
  House,
  Landmark,
  Mic,
  PiggyBank,
  Plane,
  Receipt,
  ShoppingBag,
  Target,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from 'lucide-react-native';
import { memo, useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
  Extrapolation,
  type SharedValue,
} from 'react-native-reanimated';

import { Icon } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';
import { elevation, layout } from '@/theme/tokens';

/**
 * Gelembung yang menyembur dari tombol "+" di layar Sambut (adaptasi referensi Wabi ke Monokrom):
 * bulatan kertas & tinta berisi ikon keuangan, tanpa gradasi atau warna dekoratif.
 * Hanya transform + opasitas; reduce motion: langsung di posisi akhir tanpa melayang.
 */

const ICONS: LucideIcon[] = [
  Wallet,
  Receipt,
  CreditCard,
  PiggyBank,
  Coins,
  ChartPie,
  Landmark,
  Banknote,
  Mic,
  FileText,
  Target,
  TrendingUp,
  Plane,
  ShoppingBag,
  Coffee,
  House,
  Gift,
  CalendarClock,
];

type Kind = 'ink' | 'paper' | 'dot';

/** Semburan: sedikit melewati posisi lalu menetap (sekali pantul, bukan goyang). */
const BURST_SPRING = { duration: 820, dampingRatio: 0.74 };

export type Bubble = {
  /** Posisi akhir relatif ke titik asal (pusat tombol "+"). */
  x: number;
  y: number;
  size: number;
  kind: Kind;
  icon?: LucideIcon;
  /** Jeda semburan (ms). */
  delay: number;
  /** Amplitudo & durasi melayang. */
  amp: number;
  period: number;
  /** 0..1: urutan keluar saat transisi (yang dekat asal keluar belakangan). */
  rank: number;
};

/** PRNG kecil yang deterministik: susunan gelembung sama setiap kali dibuka. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Awan gelembung di atas titik asal: sempit di dekat tombol, melebar ke atas (seperti air mancur).
 * `room` = jarak dari titik asal ke tepi atas area; `width` = lebar area.
 */
export function layoutBubbles(width: number, room: number, count = 30): Bubble[] {
  const rand = mulberry32(7);
  const half = width / 2;
  const out: Bubble[] = [];
  for (let i = 0; i < count; i++) {
    const dot = rand() < 0.28;
    const t = Math.pow(rand(), 0.8); // 0 = dekat tombol, 1 = paling atas
    const spread = 26 + t * (half - 24);
    const size = dot ? 5 + rand() * 6 : Math.round(24 + rand() * (t < 0.25 ? 22 : 40));
    out.push({
      x: (rand() * 2 - 1) * spread,
      y: -(46 + t * (room - 40)),
      size,
      kind: dot ? 'dot' : rand() < 0.42 ? 'ink' : 'paper',
      icon: dot || size < 28 ? undefined : ICONS[i % ICONS.length],
      delay: 0,
      amp: 3 + rand() * 6,
      period: 2200 + rand() * 2200,
      rank: 0,
    });
  }
  // Renggangkan supaya bulatan tidak saling tumpuk terlalu banyak (cukup beberapa putaran).
  for (let it = 0; it < 40; it++) {
    for (let a = 0; a < out.length; a++) {
      for (let b = a + 1; b < out.length; b++) {
        const A = out[a];
        const B = out[b];
        const dx = B.x - A.x;
        const dy = B.y - A.y;
        const min = (A.size + B.size) / 2 + 4;
        const d = Math.hypot(dx, dy) || 0.01;
        if (d < min) {
          const push = (min - d) / 2;
          A.x -= (dx / d) * push;
          A.y -= (dy / d) * push;
          B.x += (dx / d) * push;
          B.y += (dy / d) * push;
        }
      }
    }
    for (const B of out) {
      const r = B.size / 2;
      B.x = Math.max(-half + r + 6, Math.min(half - r - 6, B.x));
      B.y = Math.max(-room + r + 4, Math.min(-40, B.y));
    }
  }
  // Yang dekat tombol menyembur duluan, yang jauh menyusul.
  const far = Math.max(...out.map((b) => Math.hypot(b.x, b.y)));
  for (const b of out) {
    const k = Math.hypot(b.x, b.y) / far;
    b.delay = Math.round(80 + k * 520);
    b.rank = 1 - k;
  }
  return out;
}

type FieldProps = {
  width: number;
  /** Pusat tombol "+" dalam koordinat area. */
  originX: number;
  originY: number;
  /** 0 → 1 saat transisi keluar: gelembung terbang ke atas dan memudar. */
  leave: SharedValue<number>;
  reduced: boolean;
  /** Naikkan untuk memutar ulang semburan. */
  playKey?: number;
  /** Ruang di atas yang tidak boleh dimasuki gelembung (baris atas: nama + tombol bahasa/tema). */
  top?: number;
};

export const BubbleField = memo(function BubbleField({ width, originX, originY, leave, reduced, playKey = 0, top = 0 }: FieldProps) {
  const bubbles = useMemo(() => layoutBubbles(width, originY - top), [width, originY, top]);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {bubbles.map((b, i) => (
        <BubbleView key={`${playKey}-${i}`} b={b} originX={originX} originY={originY} leave={leave} reduced={reduced} />
      ))}
    </View>
  );
});

type BubbleProps = { b: Bubble; originX: number; originY: number; leave: SharedValue<number>; reduced: boolean };

function BubbleView({ b, originX, originY, leave, reduced }: BubbleProps) {
  const { colors, scheme } = useTheme();
  const burst = useSharedValue(reduced ? 1 : 0);
  const float = useSharedValue(0.5);

  useEffect(() => {
    if (reduced) return;
    burst.value = withDelay(b.delay, withSpring(1, BURST_SPRING));
    float.value = withDelay(
      b.delay + 600,
      withRepeat(withTiming(1, { duration: b.period, easing: Easing.inOut(Easing.sin) }), -1, true),
    );
    return () => {
      cancelAnimation(burst);
      cancelAnimation(float);
    };
  }, [b, reduced, burst, float]);

  const style = useAnimatedStyle(() => {
    // Keluar bergiliran: yang jauh dari tombol berangkat duluan.
    const start = b.rank * 0.35;
    const l = interpolate(leave.value, [start, start + 0.65], [0, 1], Extrapolation.CLAMP);
    const p = burst.value;
    const drift = (float.value - 0.5) * b.amp;
    return {
      opacity: Math.min(1, Math.max(0, p * 2.5)) * (1 - l),
      transform: [
        { translateX: b.x * p + drift * 0.45 + b.x * l * 0.5 },
        // Lengkung semburan: sedikit "naik lebih jauh" di tengah jalan lalu turun ke posisinya (pegas).
        { translateY: b.y * p + drift - l * (260 + (1 - b.rank) * 220) },
        { scale: (0.4 + 0.6 * Math.min(1.2, Math.max(0, p))) * (1 - l * 0.35) },
      ],
    };
  });

  const ink = b.kind === 'ink';
  const dot = b.kind === 'dot';
  const fill = dot ? colors.textMuted : ink ? colors.accent : colors.surfaceRaised;
  const glyph = ink ? colors.onAccent : colors.text;
  // Kilau kecil di kiri atas: bulatan terasa seperti kelereng tanpa gradasi.
  const shine = ink ? (scheme === 'dark' ? 'rgba(10,10,10,0.10)' : 'rgba(255,255,255,0.13)') : scheme === 'dark' ? 'rgba(255,255,255,0.10)' : '#FFFFFF';

  return (
    <Animated.View
      style={[
        styles.bubble,
        {
          left: originX - b.size / 2,
          top: originY - b.size / 2,
          width: b.size,
          height: b.size,
          borderRadius: b.size / 2,
          backgroundColor: fill,
          borderColor: dot ? 'transparent' : colors.border,
        },
        !dot && !ink && elevation[scheme].card,
        style,
      ]}
    >
      {!dot && (
        <View
          style={[
            styles.shine,
            { width: b.size * 0.4, height: b.size * 0.2, borderRadius: b.size, top: b.size * 0.13, left: b.size * 0.17, backgroundColor: shine },
          ]}
        />
      )}
      {b.icon && <Icon icon={b.icon} color={glyph} size={Math.round(b.size * 0.42)} />}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bubble: { position: 'absolute', alignItems: 'center', justifyContent: 'center', borderWidth: layout.hairline },
  shine: { position: 'absolute', transform: [{ rotate: '-28deg' }] },
});

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
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { Icon } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';
import { elevation, layout } from '@/theme/tokens';

/**
 * Air mancur gelembung dari tombol "+" (gerak mengikuti referensi onboarding Wabi, rupa mengikuti Monokrom Arshif):
 * gelembung lahir kecil di "+", meluncur cepat lalu melambat sambil melebar ke atas, membesar, dan keluar di tepi atas.
 * Semburan terus-menerus: tiap gelembung berulang dengan jeda bergeser, jadi awalnya jarang lalu makin rapat.
 * Hanya transform + opasitas di UI thread. Reduce motion: susunan diam di atas "+".
 */

const ICONS: LucideIcon[] = [Wallet, Receipt, CreditCard, PiggyBank, Coins, ChartPie, Landmark, Banknote, Mic, FileText, Target, TrendingUp, Plane, ShoppingBag, Coffee, House, Gift, CalendarClock];

type Kind = 'ink' | 'paper' | 'dot';

export type Particle = {
  size: number;
  kind: Kind;
  icon?: LucideIcon;
  /** Titik akhir relatif ke "+" (y negatif = ke atas, melewati tepi atas). */
  endX: number;
  endY: number;
  life: number;
  delay: number;
  sway: number;
  swayTurns: number;
  /** Kelembaman di "air": gelembung besar lebih berat (lebih lambat menyusul), semua sedikit memantul lewat. */
  drift: { duration: number; dampingRatio: number };
};

/** PRNG kecil yang deterministik: semburan sama setiap kali dibuka. */
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

/** `width` = lebar area, `rise` = jarak dari "+" ke tepi atas layar. */
export function makeParticles(width: number, rise: number, count = 80): Particle[] {
  const rand = mulberry32(11);
  const half = width / 2;
  const out: Particle[] = [];
  const avgLife = 5200;
  for (let i = 0; i < count; i++) {
    const dot = rand() < 0.22;
    // Referensi: gelembung besar dan rapat (13-90 px pada lebar 390), beberapa titik kecil di sela.
    const size = dot ? Math.round(4 + rand() * 6) : Math.round(26 + Math.pow(rand(), 0.8) * 58);
    // Sudut menyebar seperti kipas: sebagian besar di tengah, sedikit melebar ke tepi.
    const spread = (rand() * 2 - 1) * (0.35 + 0.65 * Math.pow(rand(), 0.7));
    out.push({
      size,
      kind: dot ? 'dot' : rand() < 0.4 ? 'ink' : 'paper',
      icon: dot || size < 28 ? undefined : ICONS[i % ICONS.length],
      endX: spread * (half + 40),
      endY: -(rise + size + 40 + rand() * 80),
      life: Math.round(4400 + rand() * 1800),
      // Jeda bergeser rata sepanjang satu umur: aliran kontinu, bukan semburan sekali.
      delay: Math.round((i / count) * avgLife * 0.9 + rand() * 260),
      sway: 4 + rand() * 10,
      swayTurns: 0.6 + rand() * 0.9,
      drift: { duration: Math.round(650 + size * 9 + rand() * 250), dampingRatio: 0.5 + rand() * 0.18 },
    });
  }
  return out;
}

type StreamProps = {
  width: number;
  /** Jarak "+" ke tepi atas layar. */
  rise: number;
  /** Pusat "+" (titik lahir), ikut bergeser saat "+" diseret. */
  originX: SharedValue<number>;
  originY: SharedValue<number>;
  /** false = berhenti menyembur: yang dekat "+" memudar, yang sudah tinggi terus melayang keluar. */
  running: boolean;
  reduced: boolean;
};

export const BubbleStream = memo(function BubbleStream({ width, rise, originX, originY, running, reduced }: StreamProps) {
  const particles = useMemo(() => makeParticles(width, rise), [width, rise]);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {particles.map((p, i) => (
        <BubbleView key={i} p={p} originX={originX} originY={originY} running={running} reduced={reduced} />
      ))}
    </View>
  );
});

type BubbleProps = { p: Particle; originX: SharedValue<number>; originY: SharedValue<number>; running: boolean; reduced: boolean };

function BubbleView({ p, originX, originY, running, reduced }: BubbleProps) {
  const { colors, scheme } = useTheme();
  // Reduce motion: diam di sepertiga perjalanan (di atas "+", belum keluar layar).
  const t = useSharedValue(reduced ? 0.32 : 0);
  const gone = useSharedValue(0);
  // Titik lahir siklus ini: gelembung meneruskan lintasannya dari tempat ia lahir, tidak ikut digeser kaku bersama "+".
  const spawnX = useSharedValue(originX.value);
  const spawnY = useSharedValue(originY.value);
  // Simpangan "arus": menyusul "+" yang diseret dengan pegas milik gelembung itu sendiri.
  const ox = useSharedValue(0);
  const oy = useSharedValue(0);

  // Lahir lagi (t berputar 1 → 0): ambil posisi "+" sekarang sebagai titik lahir baru.
  useAnimatedReaction(
    () => t.value,
    (cur, prev) => {
      if (prev !== null && cur < prev - 0.5) {
        spawnX.value = originX.value;
        spawnY.value = originY.value;
        ox.value = 0;
        oy.value = 0;
      }
    },
  );

  // "+" bergerak: tiap gelembung terseret ke arahnya. Yang muda (dekat "+") ikut kuat, yang tua tertinggal,
  // dan masing-masing menyusul dengan pegasnya sendiri → awan mengalir dan bergoyang seperti di air, bukan kaku.
  useAnimatedReaction(
    () => [originX.value, originY.value] as const,
    ([x, y], prev) => {
      if (prev === null) return;
      const pull = 0.95 - 0.7 * Math.min(1, t.value);
      ox.value = withSpring((x - spawnX.value) * pull, p.drift);
      oy.value = withSpring((y - spawnY.value) * pull, p.drift);
    },
  );

  useEffect(() => {
    if (reduced) {
      gone.value = withTiming(running ? 0 : 1, { duration: 200 });
      return;
    }
    if (running) {
      gone.value = 0;
      t.value = 0;
      t.value = withDelay(p.delay, withRepeat(withTiming(1, { duration: p.life, easing: Easing.linear }), -1, false));
      return () => cancelAnimation(t);
    }
    // Berhenti: selesaikan perjalanan ke atas tanpa lahir lagi. Yang masih dekat "+" memudar cepat.
    const now = t.value;
    cancelAnimation(t);
    if (now < 0.45) gone.value = withTiming(1, { duration: 320, easing: Easing.out(Easing.quad) });
    t.value = withTiming(1, { duration: Math.max(400, (1 - now) * p.life * 0.6), easing: Easing.linear });
  }, [running, reduced, p, t, gone]);

  const style = useAnimatedStyle(() => {
    const k = t.value;
    // Meluncur cepat dari "+" lalu melambat dan melayang, tetap bergerak sampai keluar tepi atas.
    // Keluar dari "+" lebih pelan supaya ujung kerucut rapat menempel di atas "+" seperti referensi.
    const launch = 1 - Math.pow(1 - k, 1.5);
    const up = 0.7 * launch + 0.3 * k;
    const y = p.endY * up;
    // Kerucut: makin tinggi makin lebar (sempit di dekat "+", melebar ke tepi atas), seperti air mancur referensi.
    // Sudah selebar layar sebelum mencapai tepi atas (referensi: penuh di seperempat atas).
    const x = p.endX * Math.min(1, up * 1.8) + Math.sin(k * Math.PI * 2 * p.swayTurns) * p.sway * k;
    // Lahir 8% lalu tumbuh penuh di sepertiga awal.
    const grow = Math.min(1, k / 0.45);
    const scale = 0.08 + 0.92 * (1 - Math.pow(1 - grow, 3));
    const fadeIn = Math.min(1, k / 0.04);
    return {
      opacity: fadeIn * (1 - gone.value),
      transform: [{ translateX: spawnX.value + ox.value + x - p.size / 2 }, { translateY: spawnY.value + oy.value + y - p.size / 2 }, { scale }],
    };
  });

  const ink = p.kind === 'ink';
  const dot = p.kind === 'dot';
  const fill = dot ? colors.textMuted : ink ? colors.accent : colors.surfaceRaised;
  const glyph = ink ? colors.onAccent : colors.text;
  // Kilau kecil di kiri atas: terasa seperti kelereng kaca tanpa gradasi warna.
  const shine = ink ? (scheme === 'dark' ? 'rgba(10,10,10,0.10)' : 'rgba(255,255,255,0.14)') : scheme === 'dark' ? 'rgba(255,255,255,0.10)' : '#FFFFFF';

  return (
    <Animated.View
      style={[
        styles.bubble,
        { width: p.size, height: p.size, borderRadius: p.size / 2, backgroundColor: fill, borderColor: dot ? 'transparent' : colors.border },
        !dot && !ink && elevation[scheme].card,
        style,
      ]}
    >
      {!dot && <View style={[styles.shine, { width: p.size * 0.4, height: p.size * 0.2, borderRadius: p.size, top: p.size * 0.13, left: p.size * 0.17, backgroundColor: shine }]} />}
      {p.icon && <Icon icon={p.icon} color={glyph} size={Math.round(p.size * 0.42)} />}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bubble: { position: 'absolute', left: 0, top: 0, alignItems: 'center', justifyContent: 'center', borderWidth: layout.hairline },
  shine: { position: 'absolute', transform: [{ rotate: '-28deg' }] },
});

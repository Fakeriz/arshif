import { Check, Coffee, FileText, Mic, ShoppingBag, TramFront, Zap, type LucideIcon } from 'lucide-react-native';
import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
  Extrapolation,
  type SharedValue,
} from 'react-native-reanimated';

import { AppText, Icon, ProgressBar, RollingNumber } from '@/components/ui';
import { useT } from '@/i18n';
import { useEnter } from '@/theme/motion';
import { InkCard, useTheme } from '@/theme/ThemeProvider';
import { chartRamp, elevation, layout, radius, space } from '@/theme/tokens';

/**
 * Ilustrasi hidup untuk tur perkenalan: dibangun dari komponen & token Monokrom (bukan gambar),
 * jadi otomatis benar di tema terang/gelap. Animasi berulang hanya berjalan di halaman yang aktif
 * dan diam saat reduce motion.
 */

export const ART_SIZE = 280;

/** Pegas ilustrasi: mendarat dengan sedikit pantulan, tanpa goyang berulang. */
const ART_SPRING = { duration: 650, dampingRatio: 0.82 };

/** Nilai 0→1 berulang selama `active`. Saat tidak aktif hanya dibekukan (tidak dilompatkan ke 0) supaya halaman yang sedang digeser keluar tidak tersentak. */
function useLoop(active: boolean, duration: number, opts: { reverse?: boolean; delay?: number } = {}): SharedValue<number> {
  const reduced = useReducedMotion();
  const v = useSharedValue(0);
  useEffect(() => {
    if (!active || reduced) {
      cancelAnimation(v);
      return;
    }
    v.value = 0;
    v.value = withDelay(opts.delay ?? 0, withRepeat(withTiming(1, { duration, easing: Easing.inOut(Easing.quad) }), -1, !!opts.reverse));
    return () => cancelAnimation(v);
  }, [active, reduced, duration, opts.reverse, opts.delay, v]);
  return v;
}

/** Elemen yang masuk bergiliran setiap kali halaman jadi aktif (dipasang ulang lewat `key` di induk). */
function Enter({ children, delay = 0, y = 12, x = 0, scale = 1, style }: { children: ReactNode; delay?: number; y?: number; x?: number; scale?: number; style?: object }) {
  const anim = useEnter({ delay, y, x, scale });
  return <Animated.View style={[style, anim]}>{children}</Animated.View>;
}

function useSurface() {
  const { colors, scheme } = useTheme();
  return {
    colors,
    scheme,
    card: { backgroundColor: colors.surfaceRaised, borderColor: colors.border, borderWidth: layout.hairline, ...elevation[scheme].card },
  };
}

/** Baris palsu: label kiri + nominal kanan. */
function Line({ label, amount, strong }: { label: string; amount: string; strong?: boolean }) {
  return (
    <View style={styles.line}>
      <AppText variant={strong ? 'bodyStrong' : 'caption'} tone={strong ? 'primary' : 'secondary'} numberOfLines={1}>
        {label}
      </AppText>
      <AppText variant={strong ? 'bodyStrong' : 'caption'} tone={strong ? 'primary' : 'secondary'} numeric>
        {amount}
      </AppText>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* 1. Foto struk                                                       */
/* ------------------------------------------------------------------ */

/** Isi struk contoh: nama toko & barang fiktif, sengaja tidak diterjemahkan (seperti struk sungguhan). */
const STORE = 'Toko Sinar';
const PDF = 'PDF';
const RECEIPT = [
  ['Susu UHT 1L', '18.900'],
  ['Roti tawar', '16.500'],
  ['Telur 10 btr', '27.000'],
  ['Kopi bubuk', '24.100'],
] as const;

export function ScanArt({ active }: { active: boolean }) {
  const t = useT();
  const { colors, card } = useSurface();
  const scan = useLoop(active, 1700, { reverse: true });
  const corners = useLoop(active, 1100, { reverse: true });
  const H = 214;
  const lineStyle = useAnimatedStyle(() => ({ transform: [{ translateY: 14 + scan.value * (H - 28) }] }));
  const bandStyle = useAnimatedStyle(() => ({ opacity: 0.05 + scan.value * 0.03, transform: [{ translateY: scan.value * (H - 28) - 14 }] }));
  const cornerStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + corners.value * 0.03 }] }));

  return (
    <View style={styles.art}>
      <Animated.View style={[styles.finder, cornerStyle]}>
        {(['tl', 'tr', 'bl', 'br'] as const).map((c) => (
          <View key={c} style={[styles.corner, cornerPos[c], { borderColor: colors.text }]} />
        ))}
      </Animated.View>

      <Enter y={18} scale={0.94}>
        <View style={[styles.receipt, card, { height: H }]}>
          <AppText variant="h3" align="center">
            {STORE}
          </AppText>
          <View style={[styles.rule, { borderColor: colors.borderStrong }]} />
          {RECEIPT.map(([label, amount], i) => (
            <Enter key={label} delay={260 + i * 120} x={-10} y={0}>
              <Line label={label} amount={amount} />
            </Enter>
          ))}
          <View style={[styles.rule, { borderColor: colors.borderStrong }]} />
          <Enter delay={260 + RECEIPT.length * 120} y={0} x={-10}>
            <Line label={t('auth.tour.scan.total')} amount="86.500" strong />
          </Enter>

          {/* Pita sorot pemindai: dua lapis opasitas, bukan gradasi. */}
          <Animated.View pointerEvents="none" style={[styles.scanBand, { backgroundColor: colors.text }, bandStyle]} />
          <Animated.View pointerEvents="none" style={[styles.scanLine, { backgroundColor: colors.text }, lineStyle]} />
        </View>
      </Enter>

      <Enter delay={900} scale={0.6} y={0} style={styles.scanBadgeWrap}>
        <View style={[styles.badgeDot, { backgroundColor: colors.accent }]}>
          <Icon icon={Check} color={colors.onAccent} size={16} />
        </View>
      </Enter>

      <Enter delay={1040} y={16} style={styles.chipWrap}>
        <View style={[styles.chip, card]}>
          <View style={[styles.chipIcon, { backgroundColor: colors.surfaceSunken }]}>
            <Icon icon={ShoppingBag} color={colors.text} size={14} />
          </View>
          <AppText variant="caption" tone="secondary">
            {t('auth.tour.scan.chip')}
          </AppText>
          <AppText variant="bodyStrong" numeric>
            −86.500
          </AppText>
        </View>
      </Enter>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* 2. Suara                                                            */
/* ------------------------------------------------------------------ */

const BARS = [0.35, 0.7, 0.5, 1, 0.6, 0.85, 0.4, 0.75, 0.3];

function Pulse({ loop, offset }: { loop: SharedValue<number>; offset: number }) {
  const { colors } = useTheme();
  const style = useAnimatedStyle(() => {
    const p = (loop.value + offset) % 1;
    return { opacity: (1 - p) * 0.28, transform: [{ scale: 1 + p * 1.1 }] };
  });
  return <Animated.View pointerEvents="none" style={[styles.pulse, { borderColor: colors.text }, style]} />;
}

function Bar({ loop, h, i }: { loop: SharedValue<number>; h: number; i: number }) {
  const { colors } = useTheme();
  const style = useAnimatedStyle(() => {
    const w = Math.sin((loop.value * 2 + i * 0.13) * Math.PI * 2);
    return { transform: [{ scaleY: 0.35 + h * (0.55 + 0.45 * Math.abs(w)) }] };
  });
  return <Animated.View style={[styles.bar, { backgroundColor: colors.text }, style]} />;
}

export function VoiceArt({ active }: { active: boolean }) {
  const t = useT();
  const { colors, scheme, card } = useSurface();
  const ring = useLoop(active, 2400);
  const wave = useLoop(active, 2600);

  return (
    <View style={styles.art}>
      <Enter delay={120} y={10} style={styles.sayWrap}>
        <View style={[styles.say, { backgroundColor: colors.accent }]}>
          <AppText variant="body" tone="onAccent">
            “{t('auth.tour.voice.say')}”
          </AppText>
        </View>
      </Enter>

      <View style={styles.micWrap}>
        <Pulse loop={ring} offset={0} />
        <Pulse loop={ring} offset={0.33} />
        <Pulse loop={ring} offset={0.66} />
        <Enter scale={0.6} y={0}>
          <View style={[styles.mic, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }, elevation[scheme].floating]}>
            <Icon icon={Mic} color={colors.text} size={28} />
          </View>
        </Enter>
      </View>

      <View style={styles.wave}>
        {BARS.map((h, i) => (
          <Bar key={i} loop={wave} h={h} i={i} />
        ))}
      </View>

      <Enter delay={560} y={18} style={styles.rowWrap}>
        <View style={[styles.txRow, card]}>
          <View style={[styles.txIcon, { backgroundColor: colors.surfaceSunken }]}>
            <Icon icon={Coffee} color={colors.text} size={18} />
          </View>
          <View style={styles.txText}>
            <AppText variant="bodyStrong" numberOfLines={1}>
              {t('auth.tour.voice.item')}
            </AppText>
            <AppText variant="caption" tone="muted" numberOfLines={1}>
              {t('auth.tour.voice.meta')}
            </AppText>
          </View>
          <AppText variant="amount" numeric>
            −25.000
          </AppText>
        </View>
      </Enter>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* 3. Rekening koran PDF                                               */
/* ------------------------------------------------------------------ */

type Sorted = { icon: LucideIcon; key: 'shop' | 'transport' | 'bills'; amount: string };
const SORTED: Sorted[] = [
  { icon: ShoppingBag, key: 'shop', amount: '1.240.000' },
  { icon: TramFront, key: 'transport', amount: '386.000' },
  { icon: Zap, key: 'bills', amount: '712.500' },
];

/** Baris yang "terbang" dari dokumen ke slot kategorinya. */
function FlyRow({ item, i }: { item: Sorted; i: number }) {
  const t = useT();
  const { colors, card } = useSurface();
  const reduced = useReducedMotion();
  const p = useSharedValue(reduced ? 1 : 0);
  // Dipasang saat halamannya pertama kali aktif (lihat Kenali), jadi cukup sekali saat mount.
  useEffect(() => {
    if (!reduced) p.value = withDelay(360 + i * 140, withSpring(1, ART_SPRING));
  }, [reduced, i, p]);
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0, 0.25], [0, 1], Extrapolation.CLAMP),
    transform: [
      { translateX: (1 - p.value) * -96 },
      { translateY: (1 - p.value) * (-30 - i * 22) },
      { scale: 0.7 + 0.3 * p.value },
    ],
  }));
  return (
    <Animated.View style={[styles.sortRow, card, style]}>
      <View style={[styles.txIconSm, { backgroundColor: colors.surfaceSunken }]}>
        <Icon icon={item.icon} color={colors.text} size={14} />
      </View>
      <AppText variant="caption" style={styles.flex} numberOfLines={1}>
        {t(`auth.tour.statement.${item.key}`)}
      </AppText>
      <AppText variant="caption" numeric>
        {item.amount}
      </AppText>
    </Animated.View>
  );
}

export function StatementArt({ active }: { active: boolean }) {
  const { colors, card } = useSurface();
  const bob = useLoop(active, 2600, { reverse: true });
  const docStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -bob.value * 6 }, { rotate: '-8deg' }] }));

  return (
    <View style={styles.art}>
      <Enter x={-20} y={0} style={styles.docWrap}>
        <Animated.View style={[styles.doc, card, docStyle]}>
          <View style={styles.docHead}>
            <Icon icon={FileText} color={colors.text} size={16} />
            <View style={[styles.pdf, { backgroundColor: colors.accent }]}>
              <AppText variant="overline" tone="onAccent">
                {PDF}
              </AppText>
            </View>
          </View>
          {[0.9, 0.7, 0.82, 0.6, 0.76, 0.5, 0.68].map((w, i) => (
            <View key={i} style={[styles.docLine, { width: `${w * 100}%`, backgroundColor: colors.track }]} />
          ))}
        </Animated.View>
      </Enter>
      <View style={styles.sortList}>
        {SORTED.map((item, i) => (
          <FlyRow key={item.key} item={item} i={i} />
        ))}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* 4. Ringkasan                                                         */
/* ------------------------------------------------------------------ */

const MONTHS = [0.42, 0.58, 0.5, 0.72, 0.64, 0.9];

function GrowBar({ h, i, last }: { h: number; i: number; last: boolean }) {
  const { scheme } = useTheme();
  const reduced = useReducedMotion();
  const p = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (!reduced) p.value = withDelay(300 + i * 60, withSpring(1, ART_SPRING));
  }, [reduced, i, p]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: (1 - p.value) * 30 * h }, { scaleY: Math.max(0.02, p.value) }] }));
  // Di dalam kartu tinta nada latarnya terbalik, jadi ramp-nya juga dibalik agar sorotan tetap paling kontras.
  const ramp = chartRamp[scheme === 'light' ? 'dark' : 'light'];
  return <Animated.View style={[styles.gBar, { height: 60 * h, backgroundColor: last ? ramp[4] : ramp[Math.min(3, 1 + (i % 3))] }, style]} />;
}

export function OverviewArt({ active }: { active: boolean }) {
  const t = useT();
  const reduced = useReducedMotion();
  const { card } = useSurface();
  const [worth, setWorth] = useState(reduced ? 'Rp 48.250.000' : 'Rp 0');
  const [goal, setGoal] = useState(reduced ? 0.72 : 0);

  useEffect(() => {
    if (reduced) {
      setWorth('Rp 48.250.000');
      setGoal(0.72);
      return;
    }
    if (!active) return;
    const a = setTimeout(() => setWorth('Rp 48.250.000'), 300);
    const b = setTimeout(() => setGoal(0.72), 520);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [active, reduced]);

  return (
    <View style={styles.art}>
      <Enter scale={0.94} y={14}>
        <InkCard style={styles.ink}>
          <AppText variant="overline" tone="muted">
            {t('auth.tour.overview.worth')}
          </AppText>
          <RollingNumber value={worth} variant="amountHero" />
          <View style={styles.bars}>
            {MONTHS.map((h, i) => (
              <GrowBar key={i} h={h} i={i} last={i === MONTHS.length - 1} />
            ))}
          </View>
        </InkCard>
      </Enter>
      <Enter delay={420} y={16}>
        <View style={[styles.goal, card]}>
          <View style={styles.line}>
            <AppText variant="caption" tone="secondary">
              {t('auth.tour.overview.goal')}
            </AppText>
            <AppText variant="caption" numeric>
              {Math.round(goal * 100)}%
            </AppText>
          </View>
          <ProgressBar value={goal} tone="accent" />
        </View>
      </Enter>
    </View>
  );
}

const cornerPos = StyleSheet.create({
  tl: { top: 0, left: 0, borderTopWidth: 2.5, borderLeftWidth: 2.5, borderTopLeftRadius: 14 },
  tr: { top: 0, right: 0, borderTopWidth: 2.5, borderRightWidth: 2.5, borderTopRightRadius: 14 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 2.5, borderLeftWidth: 2.5, borderBottomLeftRadius: 14 },
  br: { bottom: 0, right: 0, borderBottomWidth: 2.5, borderRightWidth: 2.5, borderBottomRightRadius: 14 },
});

const styles = StyleSheet.create({
  art: { width: ART_SIZE, height: ART_SIZE, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  line: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.md },
  rule: { borderTopWidth: 1, borderStyle: 'dashed', marginVertical: space.xs },

  finder: { position: 'absolute', width: 222, height: 252 },
  corner: { position: 'absolute', width: 30, height: 30 },
  receipt: { width: 186, borderRadius: radius.inset, padding: space.md, gap: 7, overflow: 'hidden' },
  scanLine: { position: 'absolute', left: 0, right: 0, top: 0, height: 2, borderRadius: 2 },
  scanBand: { position: 'absolute', left: 0, right: 0, top: 0, height: 28 },
  scanBadgeWrap: { position: 'absolute', top: 6, right: 26 },
  badgeDot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  chipWrap: { position: 'absolute', bottom: -4 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderRadius: radius.full, paddingVertical: space.sm, paddingLeft: space.sm, paddingRight: space.lg },
  chipIcon: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },

  sayWrap: { position: 'absolute', top: 6 },
  say: { borderRadius: 20, borderBottomRightRadius: 6, paddingHorizontal: space.lg, paddingVertical: space.md, maxWidth: 260 },
  micWrap: { width: 84, height: 84, alignItems: 'center', justifyContent: 'center', marginTop: space.lg },
  mic: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center', borderWidth: layout.hairline },
  pulse: { position: 'absolute', width: 84, height: 84, borderRadius: 42, borderWidth: 1.5 },
  wave: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 36, marginTop: space.lg },
  bar: { width: 4, height: 32, borderRadius: 2 },
  rowWrap: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  txRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderRadius: radius.card, padding: space.md },
  txIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  txIconSm: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  txText: { flex: 1, gap: 2 },

  docWrap: { position: 'absolute', left: -4, top: 30 },
  doc: { width: 118, height: 150, borderRadius: radius.inset, padding: space.md, gap: 8 },
  docHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.xs },
  pdf: { borderRadius: radius.badge, paddingHorizontal: 6, paddingVertical: 2 },
  docLine: { height: 6, borderRadius: 3 },
  sortList: { position: 'absolute', right: -8, bottom: 18, width: 204, gap: space.sm },
  sortRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderRadius: radius.inset, padding: space.sm, paddingRight: space.md },

  ink: { width: 252, borderRadius: radius.card, padding: space.lg, gap: space.xs },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 60, marginTop: space.md },
  gBar: { flex: 1, borderTopLeftRadius: radius.bar, borderTopRightRadius: radius.bar, transformOrigin: 'bottom' },
  goal: { width: 252, borderRadius: radius.inset, padding: space.md, gap: space.sm, marginTop: space.md },
});

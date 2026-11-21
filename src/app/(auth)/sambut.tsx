import { useFocusEffect, useRouter } from 'expo-router';
import { ChevronUp, Plus } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { GestureDetector, GestureHandlerRootView, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  Extrapolation,
  cancelAnimation,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { AppText, Button, Icon } from '@/components/ui';
import { BubbleField } from '@/features/intro/BubbleField';
import { markIntroSeen } from '@/features/intro/introSeen';
import { useT } from '@/i18n';
import { easeOut, haptic, useEnter } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';
import { elevation, fonts, layout, motion, space } from '@/theme/tokens';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Tombol "+" (diameter) dan orb besar setelah transisi. */
const SEED = 60;
type Phase = 'idle' | 'leaving' | 'explore';

/** Geser ke atas: komit bila melewati jarak ATAU dilempar cukup cepat (jentikan pendek pun cukup). */
const COMMIT_DY = -72;
const COMMIT_VY = -650;
/** Orb mengikuti jari dengan sedikit tahanan; ke bawah ditahan karet. */
const DRAG_FOLLOW = 0.7;
const SNAP_BACK = { duration: 400, dampingRatio: 0.8 };
/** "+" tumbuh jadi orb: mendarat dengan pantulan kecil. */
const GROW_SPRING = { duration: 700, dampingRatio: 0.8 };

/**
 * Layar Sambut (pengguna baru, sebelum masuk). Adaptasi referensi Wabi ke Monokrom Arshif:
 * 1. Gelembung ikon keuangan menyembur dari tombol "+", lalu melayang pelan.
 * 2. Ketuk "+" / "Mulai sekarang": gelembung terbang keluar, tombol tumbuh jadi orb kertas besar
 *    dengan cincin tinta yang menyapu, lalu muncul "Geser ke atas untuk menjelajah".
 * 3. Geser ke atas (atau ketuk orb) → tur perkenalan.
 */
export default function SambutScreen() {
  const t = useT();
  const router = useRouter();
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const win = useWindowDimensions();
  const [size, setSize] = useState({ w: win.width, h: win.height });
  const [phase, setPhase] = useState<Phase>('idle');
  const phaseRef = useRef<Phase>('idle');
  phaseRef.current = phase;
  // Ketuk orb + geser bersamaan tidak boleh membuka tur dua kali.
  const going = useRef(false);

  // Kolom isi tetap nyaman di tablet/web lebar; area gelembung ikut lebar kolom.
  const colW = Math.min(size.w, layout.maxContentWidth);
  const originX = size.w / 2;
  const originY = Math.round(size.h * 0.44);
  const big = Math.max(SEED * 2, Math.round(Math.min(colW * 0.66, 280)));
  const bigY = Math.round(size.h * 0.66);

  const leave = useSharedValue(0); // gelembung keluar
  const ui = useSharedValue(0); // tagline + tombol memudar
  const grow = useSharedValue(0); // "+" → orb besar
  const ring = useSharedValue(0); // cincin tinta menyapu
  const explore = useSharedValue(0); // teks fase jelajah
  const exit = useSharedValue(0); // menuju tur
  const drag = useSharedValue(0); // geser ke atas, mengikuti jari (px, negatif = ke atas)
  const exploring = useSharedValue(false); // cermin `phase === 'explore'` untuk worklet gestur
  const breathe = useSharedValue(0);
  const pulse = useSharedValue(0);

  // Napas "+" dan denyut cincin: isyarat bahwa tombol bisa diketuk.
  useEffect(() => {
    if (reduced) return;
    breathe.value = withRepeat(withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.sin) }), -1, true);
    pulse.value = withDelay(900, withRepeat(withSequence(withTiming(1, { duration: 1800, easing: easeOut }), withTiming(0, { duration: 0 }), withTiming(0, { duration: 900 })), -1));
    return () => {
      cancelAnimation(breathe);
      cancelAnimation(pulse);
    };
  }, [reduced, breathe, pulse]);

  // Kembali dari tur (gesek balik): pulihkan fase jelajah, bukan layar kosong.
  useFocusEffect(
    useCallback(() => {
      exit.value = reduced ? 0 : withTiming(0, { duration: motion.slow, easing: easeOut });
      drag.value = reduced ? 0 : withSpring(0, SNAP_BACK);
      going.current = false;
    }, [exit, drag, reduced]),
  );

  const start = useCallback(() => {
    if (phaseRef.current !== 'idle') return;
    haptic('tap');
    setPhase('leaving');
    if (reduced) {
      leave.value = 1;
      ui.value = 1;
      grow.value = 1;
      explore.value = 1;
      setPhase('explore');
      return;
    }
    // Satu gerak berlapis (~1 dtk): gelembung & teks pergi → "+" tumbuh → cincin menyapu → teks jelajah.
    leave.value = withTiming(1, { duration: 640, easing: easeOut });
    ui.value = withTiming(1, { duration: motion.base, easing: easeOut });
    grow.value = withDelay(120, withSpring(1, GROW_SPRING));
    ring.value = withDelay(260, withTiming(1, { duration: 1200, easing: Easing.bezier(0.3, 0, 0.2, 1) }));
    explore.value = withDelay(
      600,
      withTiming(1, { duration: 420, easing: easeOut }, (done) => {
        if (done) scheduleOnRN(setPhase, 'explore');
      }),
    );
  }, [reduced, leave, ui, grow, ring, explore]);

  const go = useCallback(() => {
    if (phaseRef.current !== 'explore' || going.current) return;
    going.current = true;
    haptic('selection');
    const push = () => router.push('/kenali');
    if (reduced) return push();
    exit.value = withTiming(1, { duration: motion.slow, easing: easeOut });
    setTimeout(push, 140);
  }, [reduced, exit, router]);

  const signIn = useCallback(() => {
    markIntroSeen();
    router.push('/masuk');
  }, [router]);

  useEffect(() => {
    exploring.value = phase === 'explore';
  }, [phase, exploring]);

  // Geser ke atas di fase jelajah: orb + teks ikut jari di UI thread, lepas → komit atau pegas kembali membawa kecepatan.
  const pan = usePanGesture({
    activeOffsetY: [-10, 10],
    failOffsetX: [-24, 24],
    onUpdate: (e) => {
      if (!exploring.value) return;
      const dy = e.translationY;
      // Ke bawah: karet (makin jauh makin berat).
      drag.value = dy < 0 ? dy * DRAG_FOLLOW : Math.sqrt(dy) * 3;
    },
    onDeactivate: (e) => {
      if (!exploring.value) return;
      if (e.translationY < COMMIT_DY || e.velocityY < COMMIT_VY) scheduleOnRN(go);
      else drag.value = withSpring(0, { ...SNAP_BACK, velocity: e.velocityY });
    },
  });

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== size.w || height !== size.h) setSize({ w: width, h: height });
  };

  // --- gaya animasi ---
  const seedScale = SEED / big;
  const orbStyle = useAnimatedStyle(() => {
    const g = grow.value;
    const e = exit.value;
    const s = seedScale + (1 - seedScale) * g;
    const b = reduced ? 0 : (breathe.value - 0.5) * (g > 0.5 ? 0.02 : 0.06);
    return {
      transform: [
        { translateY: (bigY - originY) * g + drag.value - e * 120 },
        { scale: (s + b) * (1 - e * 0.25) },
      ],
      opacity: 1 - e,
    };
  });
  const plusStyle = useAnimatedStyle(() => {
    const g = grow.value;
    const s = seedScale + (1 - seedScale) * g;
    return { opacity: interpolate(g, [0, 0.35], [1, 0], Extrapolation.CLAMP), transform: [{ scale: 1 / s }] };
  });
  const pulseStyle = useAnimatedStyle(() => ({
    opacity: (1 - pulse.value) * 0.22 * (1 - Math.min(1, grow.value * 3)),
    transform: [{ scale: 1 + pulse.value * 0.9 }],
  }));
  const uiStyle = useAnimatedStyle(() => ({ opacity: 1 - ui.value, transform: [{ translateY: ui.value * 18 }] }));
  const exploreStyle = useAnimatedStyle(() => ({
    // Teks bergerak lebih sedikit dari orb (paralaks) dan memudar seiring tarikan.
    opacity: explore.value * (1 - exit.value) * interpolate(drag.value, [-160, 0], [0.35, 1], Extrapolation.CLAMP),
    transform: [{ translateY: (1 - explore.value) * 16 + drag.value * 0.35 - exit.value * 40 }],
  }));

  // Cincin tinta: busur yang berputar mengelilingi orb lalu memudar (pengganti kilau iridescent referensi).
  const ringSize = big + 28;
  const r = ringSize / 2 - 4;
  const circ = 2 * Math.PI * r;
  const ringWrap = useAnimatedStyle(() => ({
    opacity: interpolate(ring.value, [0, 0.12, 0.7, 1], [0, 1, 0.9, 0], Extrapolation.CLAMP) * (1 - exit.value),
    transform: [{ translateY: bigY - originY + drag.value - exit.value * 120 }, { rotate: `${-90 + ring.value * 540}deg` }],
  }));
  const arcProps = useAnimatedProps(() => ({ strokeDashoffset: circ * (1 - interpolate(ring.value, [0, 0.45, 1], [0.05, 0.42, 0.08])) }));
  const arc2Props = useAnimatedProps(() => ({ strokeDashoffset: circ * (1 - interpolate(ring.value, [0, 0.5, 1], [0.02, 0.22, 0.02])) }));

  const hintBob = useSharedValue(0);
  useEffect(() => {
    if (phase !== 'explore' || reduced) return;
    hintBob.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(hintBob);
  }, [phase, reduced, hintBob]);
  const hintStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -hintBob.value * 6 }] }));

  const taglineEnter = useEnter({ delay: 520, y: 14 });
  const actionsEnter = useEnter({ delay: 640, y: 20 });

  const orbShadow = scheme === 'dark' ? elevation.dark.floating : elevation.light.floating;

  return (
    <GestureHandlerRootView style={styles.root}>
    <GestureDetector gesture={pan}>
    <View style={[styles.root, { backgroundColor: colors.bg }]} onLayout={onLayout}>
      <BubbleField width={colW} originX={originX} originY={originY} leave={leave} reduced={reduced} />

      {/* Denyut + cincin + orb, semuanya berpusat di titik asal. */}
      <Animated.View pointerEvents="none" style={[styles.center, { left: originX - SEED / 2, top: originY - SEED / 2, width: SEED, height: SEED }]}>
        <Animated.View style={[StyleSheet.absoluteFill, { borderRadius: SEED, borderWidth: 1.5, borderColor: colors.text }, pulseStyle]} />
      </Animated.View>

      <Animated.View pointerEvents="none" style={[styles.center, { left: originX - ringSize / 2, top: originY - ringSize / 2, width: ringSize, height: ringSize }, ringWrap]}>
        <Svg width={ringSize} height={ringSize}>
          <AnimatedCircle cx={ringSize / 2} cy={ringSize / 2} r={r} stroke={colors.text} strokeWidth={5} strokeLinecap="round" fill="none" strokeDasharray={`${circ} ${circ}`} animatedProps={arcProps} />
          <AnimatedCircle cx={ringSize / 2} cy={ringSize / 2} r={r - 12} stroke={colors.textMuted} strokeOpacity={0.5} strokeWidth={2} strokeLinecap="round" fill="none" strokeDasharray={`${circ} ${circ}`} animatedProps={arc2Props} />
        </Svg>
      </Animated.View>

      <Animated.View style={[styles.center, { left: originX - big / 2, top: originY - big / 2, width: big, height: big }, orbStyle]}>
        <Pressable
          onPress={phase === 'idle' ? start : go}
          accessibilityRole="button"
          accessibilityLabel={phase === 'idle' ? t('auth.welcome.open') : t('auth.welcome.swipe')}
          style={[styles.orb, { width: big, height: big, borderRadius: big / 2, backgroundColor: colors.surfaceRaised, borderColor: colors.border }, orbShadow]}
        >
          {/* Kilau lembut di kiri atas orb. */}
          <View pointerEvents="none" style={[styles.orbShine, { width: big * 0.42, height: big * 0.2, borderRadius: big, top: big * 0.12, left: big * 0.16, backgroundColor: scheme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.75)' }]} />
          <Animated.View style={plusStyle}>
            <Icon icon={Plus} color={colors.text} size={24} />
          </Animated.View>
        </Pressable>
      </Animated.View>

      {/* Fase awal: tagline di bawah "+", tombol di dasar. */}
      <Animated.View pointerEvents={phase === 'idle' ? 'box-none' : 'none'} style={[StyleSheet.absoluteFill, uiStyle]}>
        <Animated.View style={[styles.tagline, { top: originY + SEED / 2 + space.lg }, taglineEnter]}>
          <AppText style={[styles.taglineText, { color: colors.text }]} accessibilityRole="header">
            {t('auth.welcome.tagline')}
          </AppText>
        </Animated.View>
        <Animated.View style={[styles.actionsWrap, { paddingBottom: insets.bottom + space.lg }, actionsEnter]}>
          <View style={styles.actions}>
            <Button label={t('auth.welcome.start')} onPress={start} fullWidth />
            <Button label={t('auth.welcome.haveAccount')} variant="secondary" onPress={signIn} fullWidth />
            <AppText variant="caption" tone="muted" align="center" style={styles.note}>
              {t('auth.welcome.note')}
            </AppText>
          </View>
        </Animated.View>
      </Animated.View>

      {/* Fase jelajah: tagline besar di tengah atas, isyarat geser di dasar. */}
      <Animated.View pointerEvents={phase === 'explore' ? 'box-none' : 'none'} style={[StyleSheet.absoluteFill, exploreStyle]}>
        <View style={[styles.exploreHead, { top: Math.round(size.h * 0.26) }]}>
          <AppText style={[styles.exploreTitle, { color: colors.text }]}>{t('auth.welcome.tagline')}</AppText>
        </View>
        <Pressable onPress={go} accessibilityRole="button" style={[styles.hint, { bottom: insets.bottom + space.x3 }]} hitSlop={16}>
          <Animated.View style={hintStyle}>
            <Icon icon={ChevronUp} color={colors.textMuted} size={layout.iconSize.md} />
          </Animated.View>
          <AppText variant="caption" tone="muted">
            {t('auth.welcome.swipe')}
          </AppText>
        </Pressable>
      </Animated.View>
    </View>
    </GestureDetector>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  center: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  orb: { alignItems: 'center', justifyContent: 'center', borderWidth: layout.hairline },
  orbShine: { position: 'absolute', transform: [{ rotate: '-28deg' }] },
  tagline: { position: 'absolute', left: space.x3, right: space.x3, alignItems: 'center' },
  taglineText: { fontFamily: fonts.semibold, fontSize: 22, lineHeight: 28, letterSpacing: -0.4, textAlign: 'center', maxWidth: 300 },
  actionsWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', paddingHorizontal: space.lg },
  actions: { width: '100%', maxWidth: layout.maxContentWidth, gap: space.sm },
  note: { marginTop: space.xs },
  exploreHead: { position: 'absolute', left: space.x4, right: space.x4, alignItems: 'center' },
  exploreTitle: { fontFamily: fonts.semibold, fontSize: 28, lineHeight: 34, letterSpacing: -0.7, textAlign: 'center', maxWidth: 300 },
  hint: { position: 'absolute', left: 0, right: 0, alignItems: 'center', gap: space.xs },
});

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
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { AppText, Button, Icon, useToast } from '@/components/ui';
import { signInWithGoogle } from '@/features/auth/google';
import { AuthPrefs } from '@/features/intro/AuthPrefs';
import { BubbleStream } from '@/features/intro/BubbleStream';
import { markIntroSeen } from '@/features/intro/introSeen';
import { useT } from '@/i18n';
import { easeOut, haptic } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';
import { elevation, fonts, layout, motion, space } from '@/theme/tokens';

/** Tombol "+" (diameter). Posisi & proporsi diukur dari referensi: "+" di 47% tinggi, tombol masuk tepat di bawah tagline. */
const SEED = 56;
const SEED_Y = 0.47;
type Phase = 'idle' | 'leaving' | 'explore';

/** Seret "+": lepas lebih jauh dari ini = buka perkenalan; kurang = pegas kembali. */
const DRAG_COMMIT = 56;
/** Geser ke atas di fase jelajah: komit lewat jarak ATAU jentikan. */
const COMMIT_DY = -72;
const COMMIT_VY = -650;
const SNAP_BACK = { duration: 450, dampingRatio: 0.72 };
/** Orb naik dari bawah layar dan mendarat dengan pantulan kecil. */
const ORB_SPRING = { duration: 900, dampingRatio: 0.78 };

/** Logo "G" berwarna resmi (pedoman merek Google Sign-In). */
function GoogleMark() {
  return (
    <Svg width={18} height={18} viewBox="0 0 48 48" accessibilityElementsHidden importantForAccessibility="no">
      <Path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <Path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <Path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <Path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </Svg>
  );
}

/**
 * Layar Sambut (pengguna baru, sebelum masuk). Gerak mengikuti referensi onboarding Wabi, rupa Monokrom Arshif:
 * 1. Gelembung menyembur terus dari "+"; tagline dan tombol masuk tepat di bawahnya.
 * 2. "+" bisa diseret (gelembung ikut). Ketuk, atau lepas setelah diseret → konten memudar, orb kaca naik dari bawah,
 *    tagline pindah ke tengah, "Geser ke atas untuk menjelajah".
 * 3. Geser ke atas → orb naik ke tengah dan mengecil → tur perkenalan.
 */
export default function SambutScreen() {
  const t = useT();
  const router = useRouter();
  const { show } = useToast();
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const win = useWindowDimensions();
  const [size, setSize] = useState({ w: win.width, h: win.height });
  const [phase, setPhase] = useState<Phase>('idle');
  const [googleBusy, setGoogleBusy] = useState(false);
  const phaseRef = useRef<Phase>('idle');
  // Ketuk orb + geser bersamaan tidak boleh membuka tur dua kali.
  const going = useRef(false);
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  useEffect(() => {
    return () => {
      if (pushTimer.current) clearTimeout(pushTimer.current);
    };
  }, []);

  const colW = Math.min(size.w, layout.maxContentWidth);
  const cx = size.w / 2;
  const seedY = Math.round(size.h * SEED_Y);
  const orbD = Math.round(Math.min(colW * 0.86, 380));
  // Orb diam: puncaknya di 70% tinggi layar, separuh bawahnya keluar layar (seperti referensi).
  const orbRestY = Math.round(size.h * 0.7 + orbD / 2);
  const orbStartY = size.h + orbD / 2 + 40;
  // Jarak "+"→tagline dan tagline→tombol diukur dari referensi; layar pendek (<760) dirapatkan supaya catatan bawah tidak tertimpa.
  const roomy = size.h >= 760;
  const gapSeed = roomy ? 36 : space.lg;
  const gapActions = roomy ? 56 : space.xl;

  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const birthX = useSharedValue(cx);
  const birthY = useSharedValue(seedY);
  const idle = useSharedValue(true);
  const exploring = useSharedValue(false);

  const leave = useSharedValue(0); // konten awal memudar
  const orb = useSharedValue(0); // 0 = di bawah layar, 1 = diam di dasar
  const rim = useSharedValue(0); // kilau tepi orb menyapu sekali
  const explore = useSharedValue(0); // teks fase jelajah
  const lift = useSharedValue(0); // geser ke atas (px, negatif)
  const exit = useSharedValue(0); // orb naik ke tengah & mengecil → tur
  const hint = useSharedValue(0);

  useEffect(() => {
    birthX.value = cx + dragX.value;
    birthY.value = seedY + dragY.value;
  }, [cx, seedY, birthX, birthY, dragX, dragY]);

  useEffect(() => {
    idle.value = phase === 'idle';
    exploring.value = phase === 'explore';
    if (phase !== 'explore' || reduced) return;
    hint.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(hint);
  }, [phase, reduced, idle, exploring, hint]);

  // Kembali dari tur: orb turun lagi ke dasar, siap digeser.
  useFocusEffect(
    useCallback(() => {
      going.current = false;
      exit.value = reduced ? 0 : withTiming(0, { duration: motion.slow, easing: easeOut });
      lift.value = reduced ? 0 : withSpring(0, SNAP_BACK);
    }, [exit, lift, reduced]),
  );

  const start = useCallback(() => {
    if (phaseRef.current !== 'idle') return;
    haptic('tap');
    setPhase('leaving');
    if (reduced) {
      leave.value = 1;
      orb.value = 1;
      explore.value = 1;
      setPhase('explore');
      return;
    }
    leave.value = withTiming(1, { duration: 420, easing: easeOut });
    orb.value = withDelay(160, withSpring(1, ORB_SPRING));
    rim.value = withDelay(260, withTiming(1, { duration: 1300, easing: Easing.bezier(0.3, 0, 0.2, 1) }));
    explore.value = withDelay(
      520,
      withTiming(1, { duration: 480, easing: easeOut }, (done) => {
        if (done) scheduleOnRN(setPhase, 'explore');
      }),
    );
  }, [reduced, leave, orb, rim, explore]);

  const go = useCallback(() => {
    if (phaseRef.current !== 'explore' || going.current) return;
    going.current = true;
    haptic('selection');
    const push = () => router.push('/kenali');
    if (reduced) return push();
    exit.value = withTiming(1, { duration: 560, easing: Easing.bezier(0.3, 0, 0.1, 1) });
    if (pushTimer.current) clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(push, 320);
  }, [reduced, exit, router]);

  const toEmail = useCallback(() => {
    markIntroSeen();
    router.push('/masuk');
  }, [router]);

  const google = useCallback(async () => {
    markIntroSeen();
    setGoogleBusy(true);
    const res = await signInWithGoogle();
    // ok: gerbang rute pindah; redirect (web): halaman sedang berpindah ke Google.
    if (res === 'cancel' || res === 'error') setGoogleBusy(false);
    if (res === 'error') show({ tone: 'error', title: t('auth.signIn.errorGoogle') });
  }, [show, t]);

  // Seret "+" (fase awal): ikut jari, gelembung lahir dari posisi barunya.
  const seedPan = usePanGesture({
    minDistance: 6,
    onUpdate: (e) => {
      if (!idle.value) return;
      dragX.value = e.translationX;
      dragY.value = e.translationY;
      // Titik lahir langsung di jari; kelembaman tiap gelembung yang membuat awan mengalir di belakangnya.
      birthX.value = cx + e.translationX;
      birthY.value = seedY + e.translationY;
    },
    onDeactivate: (e) => {
      if (!idle.value) return;
      if (Math.hypot(e.translationX, e.translationY) > DRAG_COMMIT) {
        scheduleOnRN(start);
        return;
      }
      dragX.value = withSpring(0, { ...SNAP_BACK, velocity: e.velocityX });
      dragY.value = withSpring(0, { ...SNAP_BACK, velocity: e.velocityY });
      birthX.value = withSpring(cx, SNAP_BACK);
      birthY.value = withSpring(seedY, SNAP_BACK);
    },
  });

  // Geser ke atas (fase jelajah): orb + teks ikut jari, lepas → komit atau pegas kembali membawa kecepatan.
  const screenPan = usePanGesture({
    activeOffsetY: [-10, 10],
    failOffsetX: [-24, 24],
    onUpdate: (e) => {
      if (!exploring.value) return;
      const dy = e.translationY;
      // Ke bawah: karet (makin jauh makin berat).
      lift.value = dy < 0 ? dy * 0.8 : Math.sqrt(dy) * 3;
    },
    onDeactivate: (e) => {
      if (!exploring.value) return;
      if (e.translationY < COMMIT_DY || e.velocityY < COMMIT_VY) scheduleOnRN(go);
      else lift.value = withSpring(0, { ...SNAP_BACK, velocity: e.velocityY });
    },
  });

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== size.w || height !== size.h) setSize({ w: width, h: height });
  };

  // --- gaya animasi ---
  const seedStyle = useAnimatedStyle(() => ({
    opacity: 1 - leave.value,
    transform: [{ translateX: dragX.value }, { translateY: dragY.value }, { scale: 1 - leave.value * 0.4 }],
  }));
  // Konten ikut naik sedikit saat "+" diseret ke atas (referensi: ±15px), lalu memudar saat transisi.
  const contentStyle = useAnimatedStyle(() => ({
    opacity: 1 - leave.value,
    transform: [{ translateY: interpolate(dragY.value, [-200, 0, 200], [-18, 0, 6], Extrapolation.CLAMP) + leave.value * 10 }],
  }));
  const orbStyle = useAnimatedStyle(() => {
    const restY = orbStartY + (orbRestY - orbStartY) * orb.value + lift.value * 1.1;
    // Keluar: naik ke tengah layar sambil mengecil seukuran "+" lalu memudar.
    const midY = size.h * 0.45;
    const y = restY + (midY - restY) * exit.value;
    const s = 1 + (SEED / orbD - 1) * Math.max(0, (exit.value - 0.35) / 0.65);
    return {
      opacity: interpolate(exit.value, [0.75, 1], [1, 0], Extrapolation.CLAMP),
      transform: [{ translateY: y - orbD / 2 }, { scale: s }],
    };
  });
  const rimStyle = useAnimatedStyle(() => ({
    // Kilau tepi: terang saat orb naik (dan saat ditarik ke atas), lalu tinggal samar.
    opacity: Math.min(1, interpolate(rim.value, [0, 0.15, 0.8, 1], [0, 1, 0.6, 0.18], Extrapolation.CLAMP) + Math.min(0.8, -lift.value / 120)),
    transform: [{ rotate: `${-120 + rim.value * 300 - lift.value * 0.6}deg` }],
  }));
  const exploreStyle = useAnimatedStyle(() => ({
    opacity: explore.value * (1 - exit.value) * interpolate(lift.value, [-160, 0], [0.2, 1], Extrapolation.CLAMP),
    transform: [{ translateY: (1 - explore.value) * 14 + lift.value * 0.3 }],
  }));
  const hintStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -hint.value * 6 }] }));

  const orbShadow = elevation[scheme].floating;
  const shineHi = scheme === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.95)';

  return (
    <GestureHandlerRootView style={styles.root}>
      <GestureDetector gesture={screenPan}>
        <View style={[styles.root, { backgroundColor: colors.bg }]} onLayout={onLayout}>
          <BubbleStream width={colW} rise={seedY} originX={birthX} originY={birthY} running={phase === 'idle'} reduced={reduced} />

          {/* Fase awal: tagline + tombol masuk tepat di bawah "+" (posisi diukur dari referensi). */}
          <Animated.View pointerEvents={phase === 'idle' ? 'box-none' : 'none'} style={[styles.content, { top: seedY + SEED / 2 + gapSeed }, contentStyle]}>
            <AppText style={[styles.tagline, { color: colors.text }]} accessibilityRole="header">
              {t('auth.welcome.tagline')}
            </AppText>
            <View style={[styles.actions, { marginTop: gapActions }]}>
              <Button label={t('auth.signIn.google')} variant="secondary" leading={<GoogleMark />} onPress={google} loading={googleBusy} disabled={googleBusy} fullWidth />
              <Button label={t('auth.welcome.email')} onPress={toEmail} disabled={googleBusy} fullWidth />
              <Button label={t('auth.welcome.tour')} variant="secondary" onPress={start} disabled={googleBusy} fullWidth />
            </View>
          </Animated.View>
          <Animated.View pointerEvents="none" style={[styles.note, { bottom: insets.bottom + space.md }, contentStyle]}>
            <AppText variant="caption" tone="muted" align="center">
              {t('auth.welcome.note')}
            </AppText>
          </Animated.View>

          {/* "+": diketuk atau diseret. */}
          <GestureDetector gesture={seedPan}>
            <Animated.View style={[styles.abs, { left: cx - SEED / 2, top: seedY - SEED / 2 }, seedStyle]} pointerEvents={phase === 'idle' ? 'auto' : 'none'}>
              <Pressable
                onPress={start}
                accessibilityRole="button"
                accessibilityLabel={t('auth.welcome.open')}
                hitSlop={8}
                style={[styles.seed, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }, orbShadow]}
              >
                <View pointerEvents="none" style={[styles.seedShine, { backgroundColor: shineHi }]} />
                <Icon icon={Plus} color={colors.text} size={22} />
              </Pressable>
            </Animated.View>
          </GestureDetector>

          {/* Orb kaca: naik dari bawah layar, separuhnya keluar layar. Diketuk = sama dengan geser ke atas. */}
          <Animated.View pointerEvents={phase === 'explore' ? 'auto' : 'none'} style={[styles.abs, { left: cx - orbD / 2, top: 0, width: orbD, height: orbD }, orbStyle]}>
            <Pressable onPress={go} accessibilityRole="button" accessibilityLabel={t('auth.welcome.swipe')} style={[styles.fill, { borderRadius: orbD / 2, backgroundColor: colors.surfaceRaised }, orbShadow]}>
              <Svg width={orbD} height={orbD} pointerEvents="none">
                <Defs>
                  <RadialGradient id="orbHi" cx="38%" cy="30%" r="60%">
                    <Stop offset="0" stopColor={shineHi} stopOpacity={1} />
                    <Stop offset="1" stopColor={shineHi} stopOpacity={0} />
                  </RadialGradient>
                </Defs>
                <Circle cx={orbD / 2} cy={orbD / 2} r={orbD / 2} fill="url(#orbHi)" />
              </Svg>
            </Pressable>
            <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, rimStyle]}>
              <Svg width={orbD} height={orbD}>
                <Defs>
                  {/* Kilau tepi satu warna (tinta), pengganti pelangi referensi: Monokrom memakai warna hanya untuk makna. */}
                  <LinearGradient id="rim" x1="0" y1="0" x2="1" y2="1">
                    <Stop offset="0" stopColor={colors.text} stopOpacity={0.55} />
                    <Stop offset="0.5" stopColor={colors.text} stopOpacity={0.08} />
                    <Stop offset="1" stopColor={colors.text} stopOpacity={0} />
                  </LinearGradient>
                </Defs>
                <Circle cx={orbD / 2} cy={orbD / 2} r={Math.max(0, orbD / 2 - 2)} stroke="url(#rim)" strokeWidth={4} fill="none" />
              </Svg>
            </Animated.View>
          </Animated.View>

          {/* Fase jelajah: tagline di tengah (3 baris, lebih besar), isyarat geser di atas orb. */}
          <Animated.View pointerEvents={phase === 'explore' ? 'box-none' : 'none'} style={[StyleSheet.absoluteFill, exploreStyle]}>
            <View style={[styles.exploreHead, { top: Math.round(size.h * 0.565) - 48 }]}>
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

          {/* Bahasa + tema bisa dipilih sebelum apa pun; paling atas supaya selalu bisa diketuk. */}
          <View pointerEvents="box-none" style={[styles.top, { top: insets.top + space.sm }]}>
            <AppText style={[styles.wordmark, { color: colors.text }]}>Arshif</AppText>
            <AuthPrefs />
          </View>
        </View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  abs: { position: 'absolute' },
  fill: { flex: 1, overflow: 'hidden' },
  seed: { width: SEED, height: SEED, borderRadius: SEED / 2, borderWidth: layout.hairline, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  seedShine: { position: 'absolute', top: SEED * 0.12, left: SEED * 0.18, width: SEED * 0.42, height: SEED * 0.2, borderRadius: SEED, transform: [{ rotate: '-28deg' }] },
  content: { position: 'absolute', left: 0, right: 0, alignItems: 'center', paddingHorizontal: space.xl },
  tagline: { fontFamily: fonts.medium, fontSize: 21, lineHeight: 27, letterSpacing: -0.3, textAlign: 'center', maxWidth: 320 },
  actions: { width: '100%', maxWidth: layout.maxContentWidth, gap: space.sm },
  note: { position: 'absolute', left: space.xl, right: space.xl },
  exploreHead: { position: 'absolute', left: space.x4, right: space.x4, alignItems: 'center' },
  exploreTitle: { fontFamily: fonts.semibold, fontSize: 24, lineHeight: 31, letterSpacing: -0.5, textAlign: 'center', maxWidth: 230 },
  hint: { position: 'absolute', left: 0, right: 0, alignItems: 'center', gap: space.xs },
  top: { position: 'absolute', left: space.lg, right: space.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wordmark: { fontFamily: fonts.extrabold, fontSize: 20, lineHeight: 24, letterSpacing: -0.6 },
});

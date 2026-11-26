import { useCallback, useContext, useEffect, useId, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import Svg, { ClipPath, Defs, G, LinearGradient, Path, Stop } from 'react-native-svg';

import { AppText } from '@/components/ui';
import { useT } from '@/i18n';
import { easeOut } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';
import { palettes, type ColorScheme } from '@/theme/tokens';

const AnimatedPath = Animated.createAnimatedComponent(Path);

export const SPLASH_LOCKUP_WIDTH = 236;
export const SPLASH_LOCKUP_HEIGHT = 68;
export const SPLASH_MIN_HOLD_MS = 260;
export const SPLASH_REDUCED_HOLD_MS = 180;
export const SPLASH_UNRAVEL_MS = 540;
export const SPLASH_MICRO_BEAT_MS = 30;
export const SPLASH_VEIL_FADE_MS = 160;
export const SPLASH_REDUCED_FADE_MS = 180;
export const SPLASH_SLOW_BOOT_MS = 800;

const UNRAVEL_EASING = Easing.bezier(0.32, 0.08, 0.24, 1);
const VEIL_EASING = Easing.bezier(0.23, 1, 0.32, 1);

/**
 * Kontur tepat PlusJakartaSans_700Bold (fontSize 38, letterSpacing -1.1, baseline y=38)
 * dan ikon kartu berlapis resmi Arshif pada viewBox 0 0 166 48 (celah optis 11.9px).
 * Kontur r & h dibersihkan dari self-overlap variabel-font; A dipecah 3 poligon konveks
 * agar identik di iOS, Android, dan Web tanpa ketergantungan evenodd.
 */
export const SPLASH_CLIPS = {
  frontCardTop: 'M17.6 24.1V23.3A5.3 5.3 0 0 1 22.9 18H41.2A5.3 5.3 0 0 1 46.5 23.3V24.1Z',
  frontCardBottom: 'M17.6 27.9H46.5V35.5A5.3 5.3 0 0 1 41.2 40.8H22.9A5.3 5.3 0 0 1 17.6 35.5Z',
  aLeft: 'M58.42 38L68.18 9.69L74.87 9.69L72.25 13.26L70.81 13.26L64 38Z',
  aRight: 'M68.18 9.69L74.87 9.69L84.64 38L79.01 38L72.25 13.26L70.81 13.26Z',
  aBar: 'M66.54 27.36L76.52 27.36L78 31.92L65.06 31.92Z',
  rStem: 'M86.27 38L86.27 17.33L90.95 17.33L90.95 20.4L91.25 20.4L91.25 38Z',
  rFull:
    'M86.27 38L86.27 17.33L90.95 17.33L90.95 20.4Q91.6 18.7 92.95 17.9Q94.37 17.1 96.53 17.1L97.75 17.1L97.75 21.51L95.96 21.51Q93.84 21.51 92.54 22.82Q91.25 24.13 91.25 26.49L91.25 38Z',
  s: 'M107.25 38.46Q103.95 38.46 101.5 36.88Q99.04 35.3 98.13 32.6L101.86 30.82Q102.65 32.57 104.08 33.55Q105.5 34.54 107.25 34.54Q108.62 34.54 109.42 33.93Q110.22 33.33 110.22 32.34Q110.22 31.73 109.89 31.33Q109.57 30.93 109.02 30.65Q108.47 30.36 107.82 30.17L104.44 29.22Q101.82 28.46 100.47 26.9Q99.12 25.35 99.12 23.22Q99.12 21.32 100.09 19.89Q101.06 18.47 102.79 17.67Q104.52 16.87 106.76 16.87Q109.68 16.87 111.93 18.28Q114.17 19.68 115.12 22.23L111.32 24.02Q110.79 22.61 109.53 21.77Q108.28 20.94 106.72 20.94Q105.47 20.94 104.74 21.51Q104.02 22.08 104.02 22.99Q104.02 23.56 104.33 23.98Q104.63 24.4 105.18 24.66Q105.73 24.93 106.45 25.16L109.76 26.14Q112.31 26.9 113.69 28.42Q115.08 29.94 115.08 32.15Q115.08 34.01 114.09 35.44Q113.1 36.86 111.36 37.66Q109.61 38.46 107.25 38.46Z',
  h: 'M117.82 38L117.82 9.23L122.8 9.23L122.8 19.8Q123.4 18.45 124.65 17.72Q126.14 16.87 128.34 16.87Q130.62 16.87 132.39 17.86Q134.16 18.85 135.15 20.62Q136.13 22.38 136.13 24.7L136.13 38L131.16 38L131.16 25.88Q131.16 24.51 130.62 23.52Q130.09 22.53 129.16 21.98Q128.23 21.43 126.98 21.43Q125.76 21.43 124.81 21.98Q123.86 22.53 123.33 23.52Q122.8 24.51 122.8 25.88L122.8 38Z',
  iStem: 'M139.25 38L139.25 17.33L144.23 17.33L144.23 38Z',
  iDot: 'M139.25 15.01L139.25 9.69L144.23 9.69L144.23 15.01Z',
  fBar: 'M146.47 17.33L159.7 17.33L159.7 21.77L146.47 21.77Z',
  fStem:
    'M150.12 38L150.12 16.64Q150.12 14.29 151.09 12.64Q152.06 10.98 153.81 10.11Q155.56 9.23 157.95 9.23Q158.41 9.23 158.96 9.29Q159.51 9.35 159.89 9.42L159.89 13.72Q159.51 13.64 159.19 13.62Q158.86 13.6 158.6 13.6Q156.92 13.6 156.01 14.34Q155.1 15.09 155.1 16.64L155.1 38Z',
} as const;

type ClipKey = keyof typeof SPLASH_CLIPS;

type StrokeSpec = {
  id: string;
  clip: ClipKey | null;
  d: string;
  strokeWidth: number;
  length: number;
  gradient?: boolean;
  t0: number;
  t1: number;
};

/**
 * Garis tengah setiap goresan (M = titik yang hilang TERAKHIR; ujung akhir = titik awal terhapus)
 * dengan jendela tumpang tindih kanan → kiri (f → i → h → s → r → A → kartu depan → kartu belakang).
 */
const STROKES: readonly StrokeSpec[] = [
  {
    id: 'backCard',
    clip: null,
    d: 'M 35.9 15.0 L 35.9 12.6 A 5.3 5.3 0 0 0 30.6 7.3 L 12.3 7.3 A 5.3 5.3 0 0 0 7.0 12.6 L 7.0 24.8 A 5.3 5.3 0 0 0 12.3 30.1 L 14.8 30.1',
    strokeWidth: 2.7,
    length: 60.4,
    gradient: true,
    t0: 0.75,
    t1: 1.0,
  },
  {
    id: 'frontTop',
    clip: 'frontCardTop',
    d: 'M 16.0 21.0 L 48.0 21.0',
    strokeWidth: 8.0,
    length: 32.0,
    gradient: true,
    t0: 0.62,
    t1: 0.78,
  },
  {
    id: 'frontBot',
    clip: 'frontCardBottom',
    d: 'M 16.0 34.3 L 48.0 34.3',
    strokeWidth: 15.0,
    length: 32.0,
    gradient: true,
    t0: 0.65,
    t1: 0.83,
  },
  { id: 'aLeft', clip: 'aLeft', d: 'M 70.8 9.2 L 61.2 39.0', strokeWidth: 7.8, length: 31.4, t0: 0.6, t1: 0.77 },
  { id: 'aRight', clip: 'aRight', d: 'M 72.2 9.2 L 81.8 39.0', strokeWidth: 7.8, length: 31.4, t0: 0.53, t1: 0.7 },
  { id: 'aBar', clip: 'aBar', d: 'M 65.5 29.64 L 77.5 29.64', strokeWidth: 5.4, length: 12.0, t0: 0.5, t1: 0.63 },
  { id: 'rStem', clip: 'rStem', d: 'M 88.76 16.8 L 88.76 39.0', strokeWidth: 5.6, length: 22.2, t0: 0.46, t1: 0.61 },
  { id: 'rArch', clip: 'rFull', d: 'M 89.5 24.8 Q 92.0 19.3 98.4 19.3', strokeWidth: 6.2, length: 11.2, t0: 0.41, t1: 0.55 },
  {
    id: 's',
    clip: 's',
    d: 'M 113.8 23.3 C 112.5 18.8 108.5 18.6 105.5 19.0 C 102.0 19.5 101.2 21.8 101.6 23.5 C 102.2 25.8 105.5 26.6 108.8 27.6 C 112.4 28.7 113.2 30.8 112.7 33.0 C 112.1 35.5 109.2 36.6 105.8 36.4 C 102.5 36.2 100.4 34.4 99.4 31.4',
    strokeWidth: 6.0,
    length: 50.4,
    t0: 0.31,
    t1: 0.51,
  },
  { id: 'hStem', clip: 'h', d: 'M 120.31 8.5 L 120.31 39.0', strokeWidth: 5.1, length: 30.5, t0: 0.25, t1: 0.43 },
  {
    id: 'hArch',
    clip: 'h',
    d: 'M 121.2 23.8 C 122.5 19.2 126.2 19.1 128.5 19.1 C 132.2 19.1 133.65 21.8 133.65 25.4 L 133.65 39.0',
    strokeWidth: 5.6,
    length: 32.4,
    t0: 0.17,
    t1: 0.35,
  },
  { id: 'iStem', clip: 'iStem', d: 'M 141.74 16.5 L 141.74 39.0', strokeWidth: 5.6, length: 22.5, t0: 0.11, t1: 0.27 },
  { id: 'iDot', clip: 'iDot', d: 'M 141.74 9.0 L 141.74 15.6', strokeWidth: 5.6, length: 6.6, t0: 0.18, t1: 0.3 },
  { id: 'fBar', clip: 'fBar', d: 'M 145.8 19.55 L 160.4 19.55', strokeWidth: 5.2, length: 14.6, t0: 0.0, t1: 0.14 },
  {
    id: 'fStem',
    clip: 'fStem',
    d: 'M 160.4 11.5 C 155.8 11.2 152.61 12.2 152.61 16.8 L 152.61 39.0',
    strokeWidth: 5.6,
    length: 33.2,
    t0: 0.04,
    t1: 0.22,
  },
];

const MARK_GRADIENT: Record<ColorScheme, readonly [string, string]> = {
  dark: ['#FFFFFF', '#9A9A9A'],
  light: ['#575655', '#0A0A0A'],
};

function UnravelStroke({
  d,
  length,
  strokeWidth,
  stroke,
  t0,
  t1,
  progress,
}: {
  d: string;
  length: number;
  strokeWidth: number;
  stroke: string;
  t0: number;
  t1: number;
  progress: SharedValue<number>;
}) {
  const dashGap = length + strokeWidth * 2;
  const maxOffset = length + strokeWidth;
  const animatedProps = useAnimatedProps(() => {
    const local = interpolate(progress.value, [t0, t1], [0, 1], Extrapolation.CLAMP);
    return {
      strokeDashoffset: local * maxOffset,
      strokeOpacity: local >= 0.995 ? 0 : 1,
    };
  });

  return (
    <AnimatedPath
      d={d}
      fill="none"
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray={`${length} ${dashGap}`}
      animatedProps={animatedProps}
    />
  );
}

export type ArshifSplashLockupProps = {
  progress: SharedValue<number>;
  scheme: ColorScheme;
  width?: number;
  height?: number;
};

/** Lockup horizontal Arshif ([kartu berlapis] Arshif) dengan animasi goresan terurai kanan → kiri di UI thread. */
export function ArshifSplashLockup({
  progress,
  scheme,
  width = SPLASH_LOCKUP_WIDTH,
  height = SPLASH_LOCKUP_HEIGHT,
}: ArshifSplashLockupProps) {
  const uid = `arshif-splash-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const gradId = `${uid}-grad`;
  const [gradStart, gradEnd] = MARK_GRADIENT[scheme];
  const wordmarkColor = palettes[scheme].text;

  return (
    <Svg width={width} height={height} viewBox="0 0 166 48">
      <Defs>
        <LinearGradient id={gradId} gradientUnits="userSpaceOnUse" x1="7" y1="7.3" x2="46.5" y2="40.8">
          <Stop offset="0" stopColor={gradStart} />
          <Stop offset="1" stopColor={gradEnd} />
        </LinearGradient>
        {(Object.keys(SPLASH_CLIPS) as ClipKey[]).map((key) => (
          <ClipPath key={key} id={`${uid}-${key}`}>
            <Path d={SPLASH_CLIPS[key]} />
          </ClipPath>
        ))}
      </Defs>
      {STROKES.map((s) => {
        const strokeColor = s.gradient ? `url(#${gradId})` : wordmarkColor;
        const pathEl = (
          <UnravelStroke
            key={s.id}
            d={s.d}
            length={s.length}
            strokeWidth={s.strokeWidth}
            stroke={strokeColor}
            t0={s.t0}
            t1={s.t1}
            progress={progress}
          />
        );
        return s.clip ? (
          <G key={s.id} clipPath={`url(#${uid}-${s.clip})`}>
            {pathEl}
          </G>
        ) : (
          pathEl
        );
      })}
    </Svg>
  );
}

export type ArshifSplashProps = {
  /** Masih menunggu sesi / data awal aplikasi. */
  booting: boolean;
  /** Dipanggil sekali saat bingkai 0 siap tampil, untuk menutup splash bawaan native tanpa lompatan. */
  onReady?: () => void;
  /** Dipanggil setelah seluruh koreografi selesai agar overlay dapat dilepas (unmount). */
  onFinish: () => void;
};

/**
 * Splash cold-start bergaya Threads iOS: menahan lockup tajam, mengurai goresan huruf & kartu
 * dari kanan ke kiri, lalu melarutkan layar menuju aplikasi aktif di bawahnya.
 */
export function ArshifSplash({ booting, onReady, onFinish }: ArshifSplashProps) {
  const { colors, scheme } = useTheme();
  const t = useT();
  const reduced = useReducedMotion();
  const insets = useContext(SafeAreaInsetsContext);

  const [minHoldDone, setMinHoldDone] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [showCaption, setShowCaption] = useState(false);

  const readySent = useRef(false);
  const exitStarted = useRef(false);
  const onReadyRef = useRef(onReady);
  const onFinishRef = useRef(onFinish);

  useEffect(() => {
    onReadyRef.current = onReady;
    onFinishRef.current = onFinish;
  }, [onReady, onFinish]);

  const unravel = useSharedValue(0);
  const veilOpacity = useSharedValue(1);
  const captionOpacity = useSharedValue(0);

  const fireReady = useCallback(() => {
    if (readySent.current) return;
    readySent.current = true;
    onReadyRef.current?.();
  }, []);

  useEffect(() => {
    const id = setTimeout(fireReady, 0);
    return () => clearTimeout(id);
  }, [fireReady]);

  useEffect(() => {
    const ms = reduced ? SPLASH_REDUCED_HOLD_MS : SPLASH_MIN_HOLD_MS;
    const id = setTimeout(() => setMinHoldDone(true), ms);
    return () => clearTimeout(id);
  }, [reduced]);

  useEffect(() => {
    if (!booting || exiting) return;
    const id = setTimeout(() => {
      setShowCaption(true);
      captionOpacity.value = withTiming(1, { duration: reduced ? 0 : 220, easing: easeOut });
    }, SPLASH_SLOW_BOOT_MS);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booting, exiting, reduced]);

  useEffect(() => {
    if (booting || !minHoldDone || exitStarted.current) return;
    exitStarted.current = true;
    setExiting(true);

    if (reduced) {
      unravel.value = 0;
      captionOpacity.value = withTiming(0, { duration: 120, easing: easeOut });
      veilOpacity.value = withTiming(0, { duration: SPLASH_REDUCED_FADE_MS, easing: easeOut });
    } else {
      unravel.value = withTiming(1, { duration: SPLASH_UNRAVEL_MS, easing: UNRAVEL_EASING });
      captionOpacity.value = withTiming(0, { duration: Math.round(SPLASH_UNRAVEL_MS * 0.35), easing: easeOut });
      veilOpacity.value = withDelay(
        SPLASH_UNRAVEL_MS + SPLASH_MICRO_BEAT_MS,
        withTiming(0, { duration: SPLASH_VEIL_FADE_MS, easing: VEIL_EASING }),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booting, minHoldDone, reduced]);

  useEffect(() => {
    if (!exiting) return;
    const totalMs = reduced
      ? SPLASH_REDUCED_FADE_MS
      : SPLASH_UNRAVEL_MS + SPLASH_MICRO_BEAT_MS + SPLASH_VEIL_FADE_MS;
    const id = setTimeout(() => onFinishRef.current(), totalMs);
    return () => clearTimeout(id);
  }, [exiting, reduced]);

  const veilStyle = useAnimatedStyle(() => ({
    opacity: veilOpacity.value,
  }));

  const captionStyle = useAnimatedStyle(() => ({
    opacity: captionOpacity.value,
  }));

  return (
    <Animated.View
      testID="arshif-splash"
      pointerEvents={exiting ? 'none' : 'auto'}
      onLayout={fireReady}
      accessible={!exiting}
      accessibilityRole="progressbar"
      accessibilityLabel={t('common.bootLoading')}
      style={[StyleSheet.absoluteFill, styles.overlay, { backgroundColor: colors.bg }, veilStyle]}
    >
      <View style={styles.center}>
        <ArshifSplashLockup progress={unravel} scheme={scheme} />
      </View>
      {showCaption && (
        <Animated.View
          style={[styles.captionWrap, { bottom: (insets?.bottom ?? 28) + 28 }, captionStyle]}
          pointerEvents="none"
        >
          <AppText variant="caption" tone="muted">
            {t('common.bootLoading')}
          </AppText>
        </Animated.View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    zIndex: 1000,
    elevation: 1000,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  captionWrap: {
    position: 'absolute',
    bottom: 56,
    left: 24,
    right: 24,
    alignItems: 'center',
  },
});

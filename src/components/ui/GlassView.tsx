import { BlurTargetView, BlurView } from 'expo-blur';
import { createContext, useContext, useEffect, useRef, useState, type ComponentRef, type ReactNode, type RefObject } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { useTheme } from '@/theme/ThemeProvider';
import { layout, radius as radii } from '@/theme/tokens';

/**
 * Lapisan kaca:
 *  panel    — kartu & panel konten (lebih bening)
 *  floating — nav pill, sheet, dialog, toast (lebih pekat agar tetap di depan)
 * Hierarki dijaga lewat beda opasitas antar lapisan (override pemilik atas R-10, PRD Bab 11).
 */
export type GlassLevel = 'panel' | 'floating';

/**
 * Android: blur (dimezis, API 31+) butuh BlurTargetView = konten di belakang kaca.
 * Hanya lapisan `floating` (nav pill, sheet, dialog, toast) yang memakai target, dan hanya bila elemen
 * itu TIDAK berada di dalam target yang sama (sibling atau Modal). Panel konten selalu di dalam target,
 * jadi di Android panel memakai latar translusen solid.
 */
type TargetRef = RefObject<ComponentRef<typeof View> | null>;
/** Target terdekat yang boleh di-blur. */
const BlurTargetContext = createContext<TargetRef | null>(null);
/** Target yang secara native MEMUAT elemen ini (jangan di-blur: umpan balik ke diri sendiri). */
const InsideTargetContext = createContext<TargetRef | null>(null);
export const BlurTargetProvider = BlurTargetContext.Provider;

const ANDROID_BLUR_MIN_API = 31;
const androidBlurSupported = Platform.OS === 'android' && Number(Platform.Version) >= ANDROID_BLUR_MIN_API;

/** Membuat ref target. Pasang di atas elemen mengambang yang ada di luar area (mis. ToastProvider). */
export function BlurTargetScope({ children }: { children: ReactNode }) {
  const ref = useRef<ComponentRef<typeof View>>(null);
  return <BlurTargetProvider value={ref}>{children}</BlurTargetProvider>;
}

/** Area konten yang di-blur oleh kaca mengambang di luarnya. */
export function BlurTargetArea({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const ref = useContext(BlurTargetContext);
  const Target = androidBlurSupported ? BlurTargetView : View;
  return (
    <InsideTargetContext.Provider value={ref}>
      <Target ref={ref ?? undefined} style={style}>
        {children}
      </Target>
    </InsideTargetContext.Provider>
  );
}

/** Scope + area sekaligus; `floating` dirender di luar area (mis. nav pill). */
export function BlurTarget({ children, floating, style }: { children: ReactNode; floating?: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <BlurTargetScope>
      <BlurTargetArea style={style}>{children}</BlurTargetArea>
      {floating}
    </BlurTargetScope>
  );
}

/** Isi Modal berada di jendela native terpisah, jadi tidak lagi "di dalam" target mana pun. */
export function ModalGlassBoundary({ children }: { children: ReactNode }) {
  return <InsideTargetContext.Provider value={null}>{children}</InsideTargetContext.Provider>;
}

/** true = pakai blur; false = latar translusen solid (low-end, reduced motion, reduce transparency). */
export function useGlassEnabled(): boolean {
  const reducedMotion = useReducedMotion();
  const [reduceTransparency, setReduceTransparency] = useState(false);
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    AccessibilityInfo.isReduceTransparencyEnabled().then(setReduceTransparency).catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener('reduceTransparencyChanged', setReduceTransparency);
    return () => sub.remove();
  }, []);
  return !reducedMotion && !reduceTransparency;
}

export type GlassViewProps = {
  children?: ReactNode;
  level?: GlassLevel;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

export function GlassView({ children, level = 'panel', radius = radii.lg, style, accessibilityLabel }: GlassViewProps) {
  const { colors, scheme } = useTheme();
  const blurTarget = useContext(BlurTargetContext);
  const inside = useContext(InsideTargetContext);
  const enabled = useGlassEnabled();
  const floating = level === 'floating';
  // Android: hanya lapisan mengambang dengan target, di API 31+. Selain itu fallback translusen solid.
  const androidBlur = androidBlurSupported && floating && !!blurTarget && blurTarget !== inside;
  const blur = enabled && (Platform.OS !== 'android' || androidBlur);

  const shell: ViewStyle = {
    borderRadius: radius,
    borderWidth: layout.hairline,
    borderColor: colors.glassBorder,
    overflow: 'hidden',
    // Stacking context sendiri: lapisan blur (zIndex -1) selalu di belakang konten,
    // termasuk <svg> yang di web bukan elemen positioned.
    zIndex: 0,
    backgroundColor: blur
      ? floating ? colors.glassStrong : colors.glass
      : floating ? colors.glassStrongFallback : colors.glassFallback,
  };

  return (
    <View accessibilityLabel={accessibilityLabel} style={[shell, style]}>
      {blur && (
        <BlurView
          intensity={floating ? layout.blur.floating : layout.blur.panel}
          tint={scheme === 'dark' ? 'dark' : 'light'}
          blurMethod="dimezisBlurViewSdk31Plus"
          blurTarget={androidBlur ? (blurTarget ?? undefined) : undefined}
          style={styles.blur}
        />
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  blur: { ...StyleSheet.absoluteFill, zIndex: -1 },
});

import { BlurView } from 'expo-blur';
import { createContext, useContext, useEffect, useState, type ComponentRef, type ReactNode, type RefObject } from 'react';
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

/** Android: blur butuh BlurTargetView (konten di belakang kaca). Disediakan layar di Fase 1. */
const BlurTargetContext = createContext<RefObject<ComponentRef<typeof View> | null> | null>(null);
export const BlurTargetProvider = BlurTargetContext.Provider;

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
  const enabled = useGlassEnabled();
  const floating = level === 'floating';
  const androidWithoutTarget = Platform.OS === 'android' && !blurTarget;
  const blur = enabled && !androidWithoutTarget;

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
          blurTarget={blurTarget ?? undefined}
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

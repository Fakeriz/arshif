import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { easeOut } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';
import { radius } from '@/theme/tokens';

const ARM = 28;
const W = 3;

/** Bingkai panduan struk: empat sudut dan garis pindai yang bergerak (statis saat reduced motion). */
export function ScanFrame({ active }: { active: boolean }) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const y = useSharedValue(0);

  useEffect(() => {
    if (!active || reduced) {
      cancelAnimation(y);
      y.value = 0.5;
      return;
    }
    y.value = 0;
    y.value = withRepeat(withTiming(1, { duration: 1800, easing: easeOut }), -1, true);
    return () => cancelAnimation(y);
  }, [active, reduced, y]);

  const line = useAnimatedStyle(() => ({ transform: [{ translateY: y.value * 260 }] }));
  const c = { borderColor: colors.accentText };

  return (
    <View style={styles.frame} aria-hidden>
      <View style={[styles.corner, styles.tl, c]} />
      <View style={[styles.corner, styles.tr, c]} />
      <View style={[styles.corner, styles.bl, c]} />
      <View style={[styles.corner, styles.br, c]} />
      {active && <Animated.View style={[styles.line, { backgroundColor: colors.accent }, line]} />}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: '100%', maxWidth: 320, height: 300, alignSelf: 'center' },
  corner: { position: 'absolute', width: ARM, height: ARM },
  tl: { top: 0, left: 0, borderTopWidth: W, borderLeftWidth: W, borderTopLeftRadius: radius.md },
  tr: { top: 0, right: 0, borderTopWidth: W, borderRightWidth: W, borderTopRightRadius: radius.md },
  bl: { bottom: 0, left: 0, borderBottomWidth: W, borderLeftWidth: W, borderBottomLeftRadius: radius.md },
  br: { bottom: 0, right: 0, borderBottomWidth: W, borderRightWidth: W, borderBottomRightRadius: radius.md },
  line: { position: 'absolute', left: 12, right: 12, top: 12, height: 2, borderRadius: 1, opacity: 0.9 },
});

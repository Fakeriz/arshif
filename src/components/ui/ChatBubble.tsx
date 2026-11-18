import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withTiming } from 'react-native-reanimated';

import { useT } from '@/i18n';
import { easeOut, useEnter, useMotion } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

import { AppText } from './AppText';

export type ChatBubbleProps = { from: 'me' | 'assistant'; text: string };

/** Gelembung pesan. Masuk dari bawah dengan pegas; pesan pengguna memakai primary terbalik. */
export function ChatBubble({ from, text }: ChatBubbleProps) {
  const { colors } = useTheme();
  const enter = useEnter({ y: 14, scale: 0.94 });
  const mine = from === 'me';
  return (
    <Animated.View style={[styles.bubble, mine ? styles.mine : styles.theirs, { backgroundColor: mine ? colors.accent : colors.surfaceSunken }, enter]}>
      <AppText variant="body" tone={mine ? 'onAccent' : 'primary'}>
        {text}
      </AppText>
    </Animated.View>
  );
}

/** Tiga titik "sedang mengetik" untuk balasan asisten. Diam saat reduced motion. */
export function TypingDots() {
  const { colors } = useTheme();
  const t = useT();
  const enter = useEnter({ y: 10, scale: 0.8 });
  return (
    <Animated.View accessible accessibilityLabel={t('common.ui.typing')} aria-busy style={[styles.bubble, styles.theirs, styles.dots, { backgroundColor: colors.surfaceSunken }, enter]}>
      {[0, 1, 2].map((i) => (
        <Dot key={i} index={i} />
      ))}
    </Animated.View>
  );
}

function Dot({ index }: { index: number }) {
  const { colors } = useTheme();
  const { reduced } = useMotion();
  const v = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    v.value = withDelay(index * 140, withRepeat(withTiming(1, { duration: 420, easing: easeOut }), -1, true));
    return () => cancelAnimation(v);
  }, [index, reduced, v]);
  const style = useAnimatedStyle(() => ({ opacity: 0.35 + v.value * 0.65, transform: [{ translateY: v.value * -3 }] }));
  return <Animated.View style={[styles.dot, { backgroundColor: colors.textSecondary }, style]} />;
}

const styles = StyleSheet.create({
  bubble: { maxWidth: '85%', paddingHorizontal: space.lg, paddingVertical: space.sm + 2, borderRadius: radius.lg },
  mine: { alignSelf: 'flex-end', borderBottomRightRadius: radius.xs },
  theirs: { alignSelf: 'flex-start', borderBottomLeftRadius: radius.xs },
  dots: { flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: 42 },
  dot: { width: 6, height: 6, borderRadius: radius.full },
});

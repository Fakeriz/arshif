import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Modal, PanResponder, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useMotion } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';
import { layout, motion, radius, space } from '@/theme/tokens';

import { AppText } from './AppText';
import { GlassView } from './GlassView';

export type BottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
};

const DISMISS_DISTANCE = 96;

export function BottomSheet({ visible, onClose, title, subtitle, children }: BottomSheetProps) {
  const { colors } = useTheme();
  const { timing, spring } = useMotion();
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(visible);
  const sheetHeight = useRef(720);
  const y = useSharedValue(sheetHeight.current);
  const fade = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      return;
    }
    fade.value = timing(0, motion.fast);
    y.value = timing(sheetHeight.current, motion.base);
    const t = setTimeout(() => setMounted(false), motion.base);
    return () => clearTimeout(t);
  }, [visible, fade, y, timing]);

  const onShow = () => {
    fade.value = timing(1, motion.base);
    y.value = spring(0);
  };

  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => {
        y.value = Math.max(0, g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > DISMISS_DISTANCE || g.vy > 1.2) onCloseRef.current();
        else y.value = spring(0);
      },
    }),
  ).current;
  const backdrop = useAnimatedStyle(() => ({ opacity: fade.value }));
  const sheet = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));

  return (
    <Modal transparent visible={mounted} onShow={onShow} onRequestClose={onClose} animationType="none" statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }, backdrop]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Tutup" />
      </Animated.View>
      <View style={styles.anchor} pointerEvents="box-none">
        <Animated.View
          aria-modal
          onLayout={(e) => {
            sheetHeight.current = e.nativeEvent.layout.height;
          }}
          style={[styles.sheetWrap, sheet]}
        >
          <GlassView level="floating" radius={0} style={[styles.sheet, { paddingBottom: insets.bottom + space.xl }]}>
            <View {...pan.panHandlers} style={styles.handleArea}>
              <View style={[styles.handle, { backgroundColor: colors.borderStrong }]} />
            </View>
            {title && (
              <View style={styles.header}>
                <AppText variant="h3" accessibilityRole="header">
                  {title}
                </AppText>
                {subtitle && (
                  <AppText variant="caption" tone="muted">
                    {subtitle}
                  </AppText>
                )}
              </View>
            )}
            {children}
          </GlassView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  anchor: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  sheetWrap: { width: '100%', maxWidth: layout.maxContentWidth + 80, maxHeight: '90%' },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderBottomWidth: 0,
    paddingHorizontal: space.xl,
  },
  handleArea: { alignItems: 'center', paddingTop: space.sm, paddingBottom: space.md },
  handle: { width: 40, height: 4, borderRadius: radius.full },
  header: { gap: space.xxs, marginBottom: space.lg },
});

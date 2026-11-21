import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Modal, PanResponder, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDesktop } from '@/hooks/useDesktop';
import { useI18n } from '@/i18n';
import { useMotion } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';
import { layout, motion, radius, space } from '@/theme/tokens';

import { AppText } from './AppText';
import { ModalGlassBoundary } from './GlassView';

export type BottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  /**
   * Isi bisa digulir: sheet dibatasi 90% tinggi layar dan isinya (daftar mata uang, notifikasi, pilihan)
   * di-scroll di dalamnya. Sheet yang sudah punya ScrollView sendiri (FormSheet) tidak memakainya.
   */
  scrollable?: boolean;
};

const DISMISS_DISTANCE = 96;
/** Desktop: lembar jadi dialog di tengah yang masuk dari 24px di bawah posisinya sambil membesar dari 0.96. */
const DIALOG_OFFSET = 24;

export function BottomSheet({ visible, onClose, title, subtitle, children, scrollable }: BottomSheetProps) {
  const { colors } = useTheme();
  const { t: tr } = useI18n();
  const { timing, spring } = useMotion();
  const insets = useSafeAreaInsets();
  const desktop = useDesktop();
  const [mounted, setMounted] = useState(visible);
  const sheetHeight = useRef(720);
  const hiddenY = () => (desktop ? DIALOG_OFFSET : sheetHeight.current);
  const y = useSharedValue(hiddenY());
  const fade = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      return;
    }
    fade.value = timing(0, motion.fast);
    y.value = timing(hiddenY(), desktop ? motion.fast : motion.base);
    const t = setTimeout(() => setMounted(false), motion.base);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, fade, y, timing]);

  const onShow = () => {
    y.value = hiddenY();
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
  const sheet = useAnimatedStyle(() =>
    desktop
      ? { opacity: fade.value, transform: [{ translateY: y.value }, { scale: 1 - (y.value / DIALOG_OFFSET) * 0.04 }] }
      : { transform: [{ translateY: y.value }] },
  );

  return (
    <Modal transparent visible={mounted} onShow={onShow} onRequestClose={onClose} animationType="none" statusBarTranslucent>
      <ModalGlassBoundary>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }, backdrop]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel={tr('common.close')} />
      </Animated.View>
      <View style={[styles.anchor, desktop && styles.anchorCenter]} pointerEvents="box-none">
        <Animated.View
          aria-modal
          onLayout={(e) => {
            sheetHeight.current = e.nativeEvent.layout.height;
          }}
          style={[styles.sheetWrap, desktop && styles.dialogWrap, scrollable && styles.sheetWrapScroll, sheet]}
        >
          {/* Solid (tanpa blur): latar = bg, tepi borderStrong memisahkan lembar dari overlay. Kartu di dalamnya tetap surface. */}
          <View
            style={[
              styles.sheet,
              desktop && styles.dialog,
              scrollable && styles.sheetScroll,
              { backgroundColor: colors.bg, borderColor: colors.borderStrong, paddingBottom: desktop ? space.xl : insets.bottom + space.xl },
            ]}
          >
            {/* Desktop: tutup lewat Escape atau klik di luar; pegangan seret hanya untuk sentuh. */}
            {desktop ? (
              <View style={styles.dialogTop} />
            ) : (
              <View {...pan.panHandlers} style={styles.handleArea}>
                <View style={[styles.handle, { backgroundColor: colors.borderStrong }]} />
              </View>
            )}
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
            {scrollable ? (
              <ScrollView style={styles.body} bounces={false} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator>
                {children}
              </ScrollView>
            ) : (
              children
            )}
          </View>
        </Animated.View>
      </View>
      </ModalGlassBoundary>
    </Modal>
  );
}

const styles = StyleSheet.create({
  anchor: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  anchorCenter: { justifyContent: 'center', padding: space.xl },
  dialogWrap: { maxWidth: layout.maxContentWidth, maxHeight: '85%' },
  dialog: { borderRadius: radius.xl, borderWidth: layout.hairline },
  dialogTop: { height: space.xl },
  sheetWrap: { width: '100%', maxWidth: layout.maxContentWidth + 80, maxHeight: '90%' },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth: layout.hairline,
    borderLeftWidth: layout.hairline,
    borderRightWidth: layout.hairline,
    overflow: 'hidden',
    paddingHorizontal: space.xl,
  },
  // Rantai flex agar ScrollView menyusut di dalam batas 90% tinggi layar.
  sheetWrapScroll: { flexShrink: 1 },
  sheetScroll: { flexShrink: 1 },
  body: { flexGrow: 0, flexShrink: 1 },
  handleArea: { alignItems: 'center', paddingTop: space.sm, paddingBottom: space.md },
  handle: { width: 40, height: 4, borderRadius: radius.full },
  header: { gap: space.xxs, marginBottom: space.lg },
});

import { CircleAlert, Info, TriangleAlert, type LucideIcon } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { useI18n } from '@/i18n';
import { useMotion } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';
import { layout, motion, radius, space } from '@/theme/tokens';

import { AppText } from './AppText';
import { Button } from './Button';
import { ModalGlassBoundary } from './GlassView';
import { Icon } from './Icon';

export type DialogTone = 'info' | 'warning' | 'danger';

export type DialogProps = {
  visible: boolean;
  title: string;
  message?: string;
  tone?: DialogTone;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
};

export function Dialog({
  visible,
  title,
  message,
  tone = 'info',
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  loading,
}: DialogProps) {
  const { colors } = useTheme();
  const { t: tr } = useI18n();
  const { timing } = useMotion();
  const [mounted, setMounted] = useState(visible);
  const t = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      t.value = timing(1, motion.base);
      return;
    }
    t.value = timing(0, motion.fast);
    const id = setTimeout(() => setMounted(false), motion.fast);
    return () => clearTimeout(id);
  }, [visible, t, timing]);

  const backdrop = useAnimatedStyle(() => ({ opacity: t.value }));
  const card = useAnimatedStyle(() => ({ opacity: t.value, transform: [{ scale: 0.96 + t.value * 0.04 }] }));

  const look: Record<DialogTone, { icon: LucideIcon; fg: string; bg: string }> = {
    info: { icon: Info, fg: colors.info, bg: colors.infoSoft },
    warning: { icon: TriangleAlert, fg: colors.warning, bg: colors.warningSoft },
    danger: { icon: CircleAlert, fg: colors.negative, bg: colors.negativeSoft },
  };

  return (
    <Modal transparent visible={mounted} onRequestClose={onCancel} animationType="none" statusBarTranslucent>
      <ModalGlassBoundary>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }, backdrop]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} accessibilityRole="button" accessibilityLabel={tr('common.close')} />
      </Animated.View>
      <View style={styles.center} pointerEvents="box-none">
        <Animated.View
          aria-modal
          accessibilityRole="alert"
          style={[styles.cardWrap, card]}
        >
          {/* Solid (tanpa blur): latar = bg, tepi borderStrong supaya tetap terlihat di atas overlay gelap. */}
          <View style={[styles.card, { backgroundColor: colors.bg, borderColor: colors.borderStrong }]}>
          <View style={[styles.icon, { backgroundColor: look[tone].bg }]}>
            <Icon icon={look[tone].icon} color={look[tone].fg} size={22} />
          </View>
          <View style={styles.text}>
            <AppText variant="h3">{title}</AppText>
            {message && (
              <AppText variant="body" tone="secondary">
                {message}
              </AppText>
            )}
          </View>
          <View style={styles.actions}>
            <Button label={cancelLabel ?? tr('common.cancel')} variant="secondary" size="md" onPress={onCancel} fullWidth />
            <Button
              label={confirmLabel}
              variant={tone === 'danger' ? 'danger' : 'primary'}
              size="md"
              onPress={onConfirm}
              loading={loading}
              fullWidth
            />
          </View>
          </View>
        </Animated.View>
      </View>
      </ModalGlassBoundary>
    </Modal>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xxl },
  cardWrap: { width: '100%', maxWidth: 400 },
  card: { padding: space.xxl, gap: space.lg, borderRadius: radius.lg, borderWidth: layout.hairline, overflow: 'hidden' },
  icon: { width: 44, height: 44, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  text: { gap: space.xs + 2 },
  actions: { gap: space.sm },
});

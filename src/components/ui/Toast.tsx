import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react-native';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { haptic, useMotion } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';
import { layout, motion, radius, space } from '@/theme/tokens';

import { AppText } from './AppText';
import { GlassView } from './GlassView';
import { Icon } from './Icon';

export type ToastTone = 'success' | 'error' | 'warning' | 'info';
export type ToastInput = { title: string; message?: string; tone?: ToastTone; durationMs?: number };
type ToastItem = ToastInput & { id: number };

const ToastContext = createContext<((t: ToastInput) => void) | null>(null);

export function useToast() {
  const show = useContext(ToastContext);
  if (!show) throw new Error('useToast harus dipakai di dalam <ToastProvider>');
  return { show };
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<ToastItem | null>(null);
  const seq = useRef(0);
  const show = useCallback((t: ToastInput) => {
    seq.current += 1;
    if (t.tone === 'success') haptic('success');
    if (t.tone === 'error' || t.tone === 'warning') haptic('warning');
    setCurrent({ ...t, id: seq.current });
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {current && <ToastView key={current.id} item={current} onDone={() => setCurrent(null)} />}
    </ToastContext.Provider>
  );
}

function ToastView({ item, onDone }: { item: ToastItem; onDone: () => void }) {
  const { colors } = useTheme();
  const { timing, spring } = useMotion();
  const insets = useSafeAreaInsets();
  const t = useSharedValue(0);

  const dismiss = useCallback(() => {
    t.value = timing(0, motion.fast);
    setTimeout(onDone, motion.fast);
  }, [onDone, t, timing]);

  useEffect(() => {
    t.value = spring(1);
    const id = setTimeout(dismiss, item.durationMs ?? 3500);
    return () => clearTimeout(id);
  }, [dismiss, item.durationMs, spring, t]);

  const style = useAnimatedStyle(() => ({ opacity: t.value, transform: [{ translateY: (1 - t.value) * -16 }] }));
  const tone = item.tone ?? 'info';
  const look = {
    success: { icon: CircleCheck, fg: colors.positive },
    error: { icon: CircleAlert, fg: colors.negative },
    warning: { icon: TriangleAlert, fg: colors.warning },
    info: { icon: Info, fg: colors.info },
  }[tone];

  return (
    <View style={[styles.anchor, { top: insets.top + space.sm }]} pointerEvents="box-none">
      <Animated.View
        accessibilityRole={tone === 'error' ? 'alert' : 'text'}
        aria-live="polite"
        style={[styles.toastWrap, style]}
      >
        <GlassView level="floating" radius={radius.md} style={styles.toast}>
        <Icon icon={look.icon} color={look.fg} />
        <View style={styles.text}>
          <AppText variant="bodyStrong" numberOfLines={2}>
            {item.title}
          </AppText>
          {item.message && (
            <AppText variant="caption" tone="secondary" numberOfLines={3}>
              {item.message}
            </AppText>
          )}
        </View>
        <Pressable onPress={dismiss} hitSlop={12} accessibilityRole="button" accessibilityLabel="Tutup notifikasi">
          <Icon icon={X} color={colors.textMuted} size={layout.iconSize.sm} />
        </Pressable>
        </GlassView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: { position: 'absolute', left: space.lg, right: space.lg, alignItems: 'center' },
  toastWrap: { width: '100%', maxWidth: layout.maxContentWidth },
  toast: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, padding: space.lg },
  text: { flex: 1, gap: space.xxs },
});

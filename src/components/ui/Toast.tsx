import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react-native';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useI18n } from '@/i18n';
import { haptic, useMotion } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';
import { elevation, fonts, layout, motion, palettes, radius, space } from '@/theme/tokens';

import { AppText } from './AppText';
import { Icon } from './Icon';
import { PressableScale } from './PressableScale';

export type ToastTone = 'success' | 'error' | 'warning' | 'info';
export type ToastAction = { label: string; onPress: () => void };
/** actions: maksimal dua tombol (mis. Batalkan + Ubah). Toast dengan tombol tampil lebih lama. */
export type ToastInput = { title: string; message?: string; tone?: ToastTone; durationMs?: number; actions?: ToastAction[] };
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
      {current && <ToastView key={current.id} item={current} onDone={() => setCurrent((c) => (c?.id === current.id ? null : c))} />}
    </ToastContext.Provider>
  );
}

function ToastView({ item, onDone }: { item: ToastItem; onDone: () => void }) {
  const { scheme } = useTheme();
  const { t: tr } = useI18n();
  const { timing, spring } = useMotion();
  const insets = useSafeAreaInsets();
  const t = useSharedValue(0);
  const leaving = useSharedValue(0);

  // Keluar lebih cepat dari masuk (Motion Kit "Notifikasi"): mengecil sedikit sambil memudar.
  const dismiss = useCallback(() => {
    leaving.value = timing(1, motion.fast);
    setTimeout(onDone, motion.fast);
  }, [onDone, leaving, timing]);

  const duration = item.durationMs ?? (item.actions?.length ? 7000 : 3500);
  useEffect(() => {
    t.value = spring(1);
    const id = setTimeout(dismiss, duration);
    return () => clearTimeout(id);
  }, [dismiss, duration, spring, t]);

  const style = useAnimatedStyle(() => ({
    opacity: Math.min(t.value, 1 - leaving.value),
    transform: [{ translateY: (1 - t.value) * -22 + leaving.value * -14 }, { scale: 0.86 + Math.min(t.value, 1) * 0.14 - leaving.value * 0.08 }],
  }));
  const tone = item.tone ?? 'info';
  // Talmo .toast: pill tinta di tema terang, pill kertas di tema gelap; warna isi dari palet kebalikannya.
  const ink = palettes[scheme === 'dark' ? 'light' : 'dark'];
  const look = {
    success: { icon: CircleCheck, fg: ink.positive },
    error: { icon: CircleAlert, fg: ink.negative },
    warning: { icon: TriangleAlert, fg: ink.warning },
    info: { icon: Info, fg: ink.info },
  }[tone];
  const bg = scheme === 'dark' ? '#F2F0EC' : '#1C1B1F';
  const fg = scheme === 'dark' ? '#1C1B1F' : '#F4F2EE';
  const actionBg = scheme === 'dark' ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.14)';

  return (
    <View style={[styles.anchor, { top: insets.top + space.sm }]} pointerEvents="box-none">
      <Animated.View
        accessibilityRole={tone === 'error' ? 'alert' : 'text'}
        aria-live="polite"
        style={[styles.toast, { backgroundColor: bg }, elevation[scheme].floating, style]}
      >
        <Icon icon={look.icon} color={look.fg} size={18} />
        <View style={styles.text}>
          <AppText variant="bodyStrong" numberOfLines={2} style={{ color: fg }}>
            {item.title}
          </AppText>
          {item.message && (
            <AppText variant="caption" numberOfLines={3} style={{ color: ink.textSecondary }}>
              {item.message}
            </AppText>
          )}
        </View>
        {item.actions?.slice(0, 2).map((a) => (
          <PressableScale
            key={a.label}
            accessibilityLabel={a.label}
            onPress={() => {
              a.onPress();
              dismiss();
            }}
            focusRadius={radius.sm}
            style={[styles.action, { backgroundColor: actionBg }]}
          >
            <AppText variant="caption" style={[styles.actionLabel, { color: fg }]}>
              {a.label}
            </AppText>
          </PressableScale>
        ))}
        <Pressable onPress={dismiss} hitSlop={12} accessibilityRole="button" accessibilityLabel={tr('common.closeNotification')} style={styles.close}>
          <Icon icon={X} color={ink.textMuted} size={layout.iconSize.sm} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: { position: 'absolute', left: space.md, right: space.md, alignItems: 'center' },
  toast: {
    width: '100%',
    maxWidth: 440,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderRadius: 13,
    paddingVertical: 11,
    paddingLeft: space.lg,
    paddingRight: 11,
  },
  text: { flex: 1, gap: space.xxs },
  action: { height: 30, paddingHorizontal: space.md, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontFamily: fonts.bold },
  close: { padding: space.xxs },
});

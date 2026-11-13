import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';

import { motion } from './tokens';

export const easeOut = Easing.bezier(0.2, 0, 0, 1);

/** Timing/spring yang otomatis instan saat prefers-reduced-motion aktif. */
export function useMotion() {
  const reduced = useReducedMotion();
  return {
    reduced,
    timing: (to: number, duration: number = motion.base) => {
      'worklet';
      return withTiming(to, { duration: reduced ? 0 : duration, easing: easeOut });
    },
    spring: (to: number) => {
      'worklet';
      return reduced ? withTiming(to, { duration: 0 }) : withSpring(to, motion.spring);
    },
  };
}

/**
 * Muncul/hilang tanpa unmount: skala + opasitas dengan pegas (centang, lencana hitungan, tombol kirim).
 * `from` = skala saat tersembunyi.
 */
export function usePresence(visible: boolean, from = 0.5) {
  const { spring } = useMotion();
  const t = useSharedValue(visible ? 1 : 0);
  useEffect(() => {
    t.value = spring(visible ? 1 : 0);
  }, [visible, spring, t]);
  return useAnimatedStyle(() => ({
    opacity: Math.max(0, Math.min(1, t.value)),
    transform: [{ scale: from + (1 - from) * t.value }],
  }));
}

/**
 * Animasi masuk saat elemen dipasang (mount): geser + skala + opasitas dengan pegas.
 * `delay` untuk giliran (stagger). Reduced motion: langsung di posisi akhir.
 */
export function useEnter({ delay = 0, scale = 1, x = 0, y = 0 }: { delay?: number; scale?: number; x?: number; y?: number } = {}) {
  const reduced = useReducedMotion();
  const t = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (!reduced) t.value = withDelay(delay, withSpring(1, motion.spring));
    // Hanya saat mount: nilai awal menentukan animasi masuk.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return useAnimatedStyle(() => ({
    opacity: Math.max(0, Math.min(1, t.value)),
    transform: [{ translateX: (1 - t.value) * x }, { translateY: (1 - t.value) * y }, { scale: scale + (1 - scale) * t.value }],
  }));
}

type HapticKind = 'tap' | 'selection' | 'success' | 'warning';

/** Intensitas getar pilihan pengguna (Pengaturan > Tampilan). Disimpan per perangkat. */
export type HapticLevel = 'off' | 'soft' | 'strong';
export const HAPTIC_LEVELS: HapticLevel[] = ['off', 'soft', 'strong'];
const HAPTIC_KEY = 'arshif.hapticLevel';
let hapticLevel: HapticLevel = 'soft';
const listeners = new Set<(level: HapticLevel) => void>();

function isLevel(v: unknown): v is HapticLevel {
  return v === 'off' || v === 'soft' || v === 'strong';
}

/** Dibaca sekali saat aplikasi mulai. */
export async function loadHapticLevel(): Promise<void> {
  const saved = await AsyncStorage.getItem(HAPTIC_KEY).catch(() => null);
  if (isLevel(saved)) setLevel(saved);
}

function setLevel(level: HapticLevel) {
  hapticLevel = level;
  listeners.forEach((fn) => fn(level));
}

export function useHapticLevel(): [HapticLevel, (level: HapticLevel) => void] {
  const [level, setState] = useState(hapticLevel);
  useEffect(() => {
    listeners.add(setState);
    return () => {
      listeners.delete(setState);
    };
  }, []);
  const update = useCallback((next: HapticLevel) => {
    setLevel(next);
    AsyncStorage.setItem(HAPTIC_KEY, next).catch(() => undefined);
  }, []);
  return [level, update];
}

const android = Platform.OS === 'android';
const api = android ? Number(Platform.Version) : 0;
const system = (type: Haptics.AndroidHaptics) => Haptics.performAndroidHapticsAsync(type);

/**
 * Lembut: haptic sistem Android (performHapticFeedback, sama dengan keyboard/picker bawaan) dan Soft di iOS.
 * selectionAsync/impactAsync di Android memutar motor getar mentah, itulah varian Kuat.
 * Segment_Tick butuh API 34, Confirm/Reject API 30; di bawahnya Clock_Tick.
 */
function soft(kind: HapticKind): Promise<void> {
  if (!android) {
    if (kind === 'selection') return Haptics.selectionAsync();
    if (kind === 'tap') return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
    return Haptics.notificationAsync(kind === 'success' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning);
  }
  const tick = api >= 34 ? Haptics.AndroidHaptics.Segment_Tick : Haptics.AndroidHaptics.Clock_Tick;
  if (kind === 'selection') return system(tick);
  if (kind === 'tap') return system(Haptics.AndroidHaptics.Virtual_Key);
  if (api < 30) return system(tick);
  return system(kind === 'success' ? Haptics.AndroidHaptics.Confirm : Haptics.AndroidHaptics.Reject);
}

function strong(kind: HapticKind): Promise<void> {
  if (kind === 'tap') return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  if (kind === 'selection') return Haptics.selectionAsync();
  return Haptics.notificationAsync(kind === 'success' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning);
}

/** Haptic sesuai intensitas pilihan pengguna; no-op di web atau saat Mati. */
export function haptic(kind: HapticKind = 'tap'): void {
  if (Platform.OS === 'web' || hapticLevel === 'off') return;
  (hapticLevel === 'soft' ? soft(kind) : strong(kind)).catch(() => undefined);
}

import { useRef, type ReactNode } from 'react';
import { Animated, LayoutAnimation, PanResponder, useWindowDimensions } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

/** Geser lebih dari ini (atau lempar cukup cepat) untuk menutup; kurang dari itu kartu kembali ke tempatnya. */
const DISTANCE = 96;
const VELOCITY = 0.8;
const DURATION = 200;

/**
 * Bungkus kartu yang bisa ditutup dengan geser ke kiri atau kanan (geser + memudar).
 * Pembaca layar mendapat aksi `dismiss` dengan label yang sama, karena geser saja tidak bisa dipakai semua orang.
 */
export function SwipeDismiss({ children, onDismiss, actionLabel }: { children: ReactNode; onDismiss: () => void; actionLabel: string }) {
  const { width } = useWindowDimensions();
  const reduced = useReducedMotion();
  const x = useRef(new Animated.Value(0)).current;

  const finish = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    onDismiss();
  };
  const out = (dir: 1 | -1) => {
    if (reduced) return finish();
    Animated.timing(x, { toValue: dir * width, duration: DURATION, useNativeDriver: false }).start(({ finished }) => finished && finish());
  };
  // PanResponder dibuat sekali; lewat ref supaya selalu memakai lebar layar dan prop terbaru.
  const outRef = useRef(out);
  outRef.current = out;

  const pan = useRef(
    PanResponder.create({
      // Hanya gerakan yang jelas mendatar: gulir vertikal Home tetap milik ScrollView.
      onMoveShouldSetPanResponderCapture: (_, g) => Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      // Gesture dan animasi lepas memakai nilai yang sama: keduanya harus JS driver.
      onPanResponderMove: Animated.event([null, { dx: x }], { useNativeDriver: false }),
      onPanResponderRelease: (_, g) => {
        if (Math.abs(g.dx) > DISTANCE || Math.abs(g.vx) > VELOCITY) outRef.current(g.dx < 0 ? -1 : 1);
        else Animated.spring(x, { toValue: 0, useNativeDriver: false, bounciness: 4 }).start();
      },
      onPanResponderTerminate: () => Animated.spring(x, { toValue: 0, useNativeDriver: false }).start(),
    }),
  ).current;

  const opacity = x.interpolate({ inputRange: [-width, 0, width], outputRange: [0, 1, 0], extrapolate: 'clamp' });

  return (
    <Animated.View
      {...pan.panHandlers}
      style={{ transform: [{ translateX: x }], opacity }}
      accessibilityActions={[{ name: 'dismiss', label: actionLabel }]}
      onAccessibilityAction={(e) => e.nativeEvent.actionName === 'dismiss' && finish()}
    >
      {children}
    </Animated.View>
  );
}

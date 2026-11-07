/**
 * Lingkungan test tanpa native: mock minimal Reanimated berisi HANYA API yang dipakai Arshif.
 * Animasi langsung lompat ke nilai akhir agar render deterministik.
 * Jika komponen memakai API Reanimated baru, tambahkan di sini.
 */
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  const identity = (to: unknown) => to;
  const Easing = { bezier: () => (t: number) => t, linear: (t: number) => t };
  const Animated = { View, createAnimatedComponent: <T,>(c: T) => c };
  return {
    __esModule: true,
    default: Animated,
    ...Animated,
    Easing,
    useSharedValue: (init: unknown) => ({ value: init }),
    useAnimatedStyle: (fn: () => object) => fn(),
    useAnimatedProps: (fn: () => object) => fn(),
    useReducedMotion: () => false,
    withTiming: identity,
    withSpring: identity,
    withRepeat: identity,
    withDelay: (_ms: number, anim: unknown) => anim,
    withSequence: (...anims: unknown[]) => anims[anims.length - 1],
    cancelAnimation: () => undefined,
  };
});

// Test memakai kurs contoh yang tetap (aplikasi memakai kurs live dari fx_rates).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fx = require('./src/lib/fx');
fx.setUsdRates(fx.SAMPLE_USD_RATES, '2026-11-05');

// WebView (grafik TradingView) tidak punya modul native di Jest: render View yang menyimpan props untuk diperiksa tes.
jest.mock('react-native-webview', () => {
  const { View } = require('react-native');
  const WebView = (props: Record<string, unknown>) => require('react').createElement(View, { testID: 'webview', ...props });
  return { __esModule: true, WebView, default: WebView };
});

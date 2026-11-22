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
  const layoutAnim = (): unknown => new Proxy({}, { get: (_t, key) => (key === 'then' ? undefined : () => layoutAnim()) });
  return {
    __esModule: true,
    default: Animated,
    ...Animated,
    Easing,
    useSharedValue: (init: unknown) => ({ value: init }),
    useAnimatedStyle: (fn: () => object) => fn(),
    useAnimatedProps: (fn: () => object) => fn(),
    useDerivedValue: (fn: () => unknown) => ({ value: fn() }),
    useReducedMotion: () => false,
    withTiming: identity,
    withSpring: identity,
    withRepeat: identity,
    withDelay: (_ms: number, anim: unknown) => anim,
    withSequence: (...anims: unknown[]) => anims[anims.length - 1],
    cancelAnimation: () => undefined,
    // Animasi masuk/keluar (dompet Akun & kartu): builder berantai yang tidak melakukan apa-apa.
    FadeIn: layoutAnim(),
    FadeOut: layoutAnim(),
    FadeInDown: layoutAnim(),
    LinearTransition: layoutAnim(),
    // Deck akun Beranda: interpolasi linier (+ clamp) cukup untuk render deterministik.
    Extrapolation: { CLAMP: 'clamp', EXTEND: 'extend', IDENTITY: 'identity' },
    interpolate: (v: number, input: number[], output: number[], extrapolate?: string) => {
      const [i0, i1] = [input[0], input[input.length - 1]];
      const [o0, o1] = [output[0], output[output.length - 1]];
      const t = i1 === i0 ? 0 : (v - i0) / (i1 - i0);
      const clamped = extrapolate === 'clamp' ? Math.min(1, Math.max(0, t)) : t;
      return o0 + (o1 - o0) * clamped;
    },
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

import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState, type ComponentType } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { AppText, Button } from '@/components/ui';
import { markIntroSeen } from '@/features/intro/introSeen';
import { ART_SIZE, OverviewArt, ScanArt, StatementArt, VoiceArt } from '@/features/intro/TourArt';
import { useT } from '@/i18n';
import { haptic } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';
import { layout, space } from '@/theme/tokens';

type Slide = { key: 'scan' | 'voice' | 'statement' | 'overview'; Art: ComponentType<{ active: boolean }> };
const SLIDES: Slide[] = [
  { key: 'scan', Art: ScanArt },
  { key: 'voice', Art: VoiceArt },
  { key: 'statement', Art: StatementArt },
  { key: 'overview', Art: OverviewArt },
];

const DOT = 6;
const DOT_GAP = 8;
const PILL = 20;

/**
 * Tur perkenalan sebelum masuk: 4 halaman geser (struk, suara, rekening koran, ringkasan).
 * Ilustrasi bergerak paralaks terhadap geseran dan memutar animasinya saat halamannya aktif.
 * Selesai / Lewati → tandai sudah dilihat → Masuk.
 */
export default function KenaliScreen() {
  const t = useT();
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const ref = useAnimatedRef<Animated.ScrollView>();
  const x = useSharedValue(0);
  const [page, setPage] = useState(0);
  const last = page === SLIDES.length - 1;

  const onScroll = useAnimatedScrollHandler((e) => {
    x.value = e.contentOffset.x;
  });

  // Halaman aktif berpindah begitu geseran melewati separuh, bukan setelah berhenti: ilustrasi halaman
  // berikutnya sudah mulai masuk selagi halamannya meluncur, dan halaman yang ditinggal tidak berkedip.
  const onPage = useCallback((p: number) => {
    setPage(p);
    haptic('selection');
  }, []);
  useAnimatedReaction(
    () => Math.min(SLIDES.length - 1, Math.max(0, Math.round(x.value / width))),
    (p, prev) => {
      if (prev !== null && p !== prev) scheduleOnRN(onPage, p);
    },
    [width, onPage],
  );

  const finish = useCallback(() => {
    markIntroSeen();
    router.replace('/masuk');
  }, [router]);

  const next = () => {
    if (last) return finish();
    ref.current?.scrollTo({ x: (page + 1) * width, animated: true });
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <View style={[styles.top, { paddingTop: insets.top + space.sm }]}>
        <AppText variant="bodyStrong">Arshif</AppText>
        {!last && <Button label={t('auth.tour.skip')} variant="ghost" size="sm" onPress={finish} />}
      </View>

      <Animated.ScrollView
        ref={ref}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={styles.flex}
      >
        {SLIDES.map((s, i) => (
          <Page key={s.key} slide={s} i={i} x={x} width={width} active={page === i} />
        ))}
      </Animated.ScrollView>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + space.lg }]}>
        <Dots x={x} width={width} page={page} />
        <View style={styles.cta}>
          <Button label={last ? t('auth.tour.done') : t('auth.tour.next')} onPress={next} fullWidth />
        </View>
      </View>
    </View>
  );
}

function Page({ slide, i, x, width, active }: { slide: Slide; i: number; x: SharedValue<number>; width: number; active: boolean }) {
  const t = useT();
  const { Art } = slide;
  // Ilustrasi dipasang saat halaman pertama kali aktif (animasi masuknya diputar sekali, sambil meluncur masuk)
  // dan tidak pernah dilepas lagi: kembali ke halaman ini menampilkan keadaan akhirnya, bukan kedipan ulang.
  const [seen, setSeen] = useState(active);
  useEffect(() => {
    if (active) setSeen(true);
  }, [active]);
  // Paralaks: ilustrasi tertinggal sedikit dari halaman, teks sedikit mendahului; keduanya memudar di tepi.
  const artStyle = useAnimatedStyle(() => {
    const d = (x.value - i * width) / width;
    return {
      opacity: interpolate(Math.abs(d), [0, 0.8], [1, 0], Extrapolation.CLAMP),
      transform: [{ translateX: d * width * 0.4 }, { scale: interpolate(Math.abs(d), [0, 1], [1, 0.86], Extrapolation.CLAMP) }],
    };
  });
  const textStyle = useAnimatedStyle(() => {
    const d = (x.value - i * width) / width;
    return {
      opacity: interpolate(Math.abs(d), [0, 0.6], [1, 0], Extrapolation.CLAMP),
      transform: [{ translateX: d * width * -0.12 }],
    };
  });

  return (
    <View style={[styles.page, { width }]} accessibilityLabel={t('auth.tour.page', { n: i + 1, total: SLIDES.length })}>
      <Animated.View style={[styles.artBox, artStyle]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {seen && <Art active={active} />}
      </Animated.View>
      <Animated.View style={[styles.copy, textStyle]}>
        <AppText variant="h1" align="center" accessibilityRole="header">
          {t(`auth.tour.${slide.key}.title`)}
        </AppText>
        <AppText variant="body" tone="secondary" align="center">
          {t(`auth.tour.${slide.key}.lead`)}
        </AppText>
      </Animated.View>
    </View>
  );
}

function Dots({ x, width, page }: { x: SharedValue<number>; width: number; page: number }) {
  const { colors } = useTheme();
  const t = useT();
  // Pil tinta bergeser mengikuti jari (hanya transform), titik di bawahnya diam.
  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: (x.value / width) * (DOT + DOT_GAP) }] }));
  return (
    <View style={styles.dots} accessibilityRole="progressbar" accessibilityLabel={t('auth.tour.page', { n: page + 1, total: SLIDES.length })}>
      {SLIDES.map((s) => (
        <View key={s.key} style={[styles.dot, { backgroundColor: colors.track }]} />
      ))}
      <Animated.View style={[styles.pill, { backgroundColor: colors.text }, pill]} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.xl, minHeight: 44 + space.sm },
  page: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.x3, gap: space.x3 },
  artBox: { width: ART_SIZE, height: ART_SIZE, alignItems: 'center', justifyContent: 'center' },
  copy: { gap: space.sm, maxWidth: 340, minHeight: 110 },
  bottom: { alignItems: 'center', paddingHorizontal: space.lg, gap: space.xl },
  cta: { width: '100%', maxWidth: layout.maxContentWidth },
  dots: { flexDirection: 'row', gap: DOT_GAP, height: DOT, alignItems: 'center' },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2 },
  // Pil lebih lebar dari titik, berpusat di atas titik aktif.
  pill: { position: 'absolute', left: (DOT - PILL) / 2, width: PILL, height: DOT, borderRadius: DOT / 2 },
});

import { Redirect } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AccentPicker, AppText, GlassView, Tabs } from '@/components/ui';
import { CashflowSection, DonutSection, GaugeSection } from '@/features/design-sheet/ChartSections';
import { BadgeChipSection, ButtonSection, InputSection, TabsSection } from '@/features/design-sheet/ControlSections';
import { ListSection, MoneySection, ProgressSection } from '@/features/design-sheet/DataSections';
import { OverlaySection, StateSection } from '@/features/design-sheet/FeedbackSections';
import { ColorSection, ShapeSection, TypeSection } from '@/features/design-sheet/FoundationSections';
import { ShowcaseSection } from '@/features/design-sheet/ShowcaseSection';
import { useTheme, type ThemeMode } from '@/theme/ThemeProvider';
import { layout, space } from '@/theme/tokens';

const MODES: { key: ThemeMode; label: string }[] = [
  { key: 'system', label: 'Sistem' },
  { key: 'dark', label: 'Gelap' },
  { key: 'light', label: 'Terang' },
];

/** Lembar Desain Fase 0: pembanding visual check untuk Fase 1. */
export default function DesignSheetRoute() {
  // Lembar Desain hanya untuk pengembangan. Rilis menyembunyikannya kecuali EXPO_PUBLIC_DESIGN_SHEET=1.
  if (!__DEV__ && process.env.EXPO_PUBLIC_DESIGN_SHEET !== '1') return <Redirect href="/" />;
  return <DesignSheet />;
}

function DesignSheet() {
  const { colors, mode, setMode } = useTheme();
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.column}>
          <View style={styles.hero}>
            <AppText variant="display">Arshif</AppText>
            <AppText variant="body" tone="secondary">
              Lembar desain Fase 0: token, komponen, dan semua state-nya. Layar Fase 1 dibandingkan dengan lembar ini.
            </AppText>
            <GlassView style={styles.controls}>
              <AppText variant="overline" tone="secondary">Tema</AppText>
              <Tabs items={MODES} value={mode} onChange={setMode} accessibilityLabel="Tema" />
              <AppText variant="overline" tone="secondary">Warna aksen</AppText>
              <AccentPicker />
            </GlassView>
          </View>
          <ShowcaseSection />
          <ColorSection />
          <TypeSection />
          <ShapeSection />
          <ButtonSection />
          <InputSection />
          <BadgeChipSection />
          <TabsSection />
          <MoneySection />
          <ProgressSection />
          <ListSection />
          <DonutSection />
          <GaugeSection />
          <CashflowSection />
          <StateSection />
          <OverlaySection />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingHorizontal: space.xl, paddingBottom: space.x5 * 2, alignItems: 'center' },
  column: { width: '100%', maxWidth: layout.maxContentWidth, gap: space.x3 },
  hero: { gap: space.md, paddingTop: space.xxl },
  controls: { padding: space.lg, gap: space.sm },
});

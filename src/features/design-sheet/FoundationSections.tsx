import { StyleSheet, View } from 'react-native';

import { AppText, Card } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';
import { motion, radius, space, type as typeScale, type Palette, type TypeVariant } from '@/theme/tokens';

import { Section } from './Section';

const SWATCHES: { key: keyof Palette; label: string }[] = [
  { key: 'bg', label: 'Latar' },
  { key: 'surface', label: 'Kartu' },
  { key: 'surfaceRaised', label: 'Sheet' },
  { key: 'text', label: 'Teks' },
  { key: 'textSecondary', label: 'Sekunder' },
  { key: 'textMuted', label: 'Redup' },
  { key: 'accent', label: 'Kuningan' },
  { key: 'positive', label: 'Pemasukan' },
  { key: 'negative', label: 'Over budget' },
  { key: 'warning', label: 'Peringatan' },
  { key: 'info', label: 'Info' },
  { key: 'track', label: 'Track' },
];

export function ColorSection() {
  const { colors, hues } = useTheme();
  return (
    <Section index="01 · Warna" title="Tinta & Kuningan" note="Latar tinta hangat, aksen kuningan. Hijau hanya untuk pemasukan, merah hanya untuk over budget.">
      <View style={styles.grid}>
        {SWATCHES.map((s) => (
          <View key={s.key} style={styles.swatch}>
            <View style={[styles.chipColor, { backgroundColor: colors[s.key], borderColor: colors.borderStrong }]} />
            <AppText variant="caption">{s.label}</AppText>
            <AppText variant="caption" tone="muted" numeric>
              {colors[s.key].toUpperCase()}
            </AppText>
          </View>
        ))}
      </View>
      <AppText variant="overline" tone="muted" uppercase>
        Warna kategori
      </AppText>
      <View style={styles.hueRow}>
        {Object.entries(hues).map(([name, hex]) => (
          <View key={name} accessibilityLabel={name} style={[styles.hue, { backgroundColor: hex }]} />
        ))}
      </View>
    </Section>
  );
}

const TYPE_SAMPLES: { variant: TypeVariant; text: string }[] = [
  { variant: 'display', text: 'Selamat pagi, Rani' },
  { variant: 'h1', text: 'Kesehatan keuangan' },
  { variant: 'h2', text: 'Anggaran November' },
  { variant: 'h3', text: 'Transaksi terakhir' },
  { variant: 'body', text: 'Kamu sudah memakai 61% anggaran Kebutuhan. Masih aman sampai gajian.' },
  { variant: 'caption', text: 'Kurs per 5 Nov, 14.00 · sumber ExchangeRate-API' },
  { variant: 'amountHero', text: 'Rp 48.215.400' },
];

export function TypeSection() {
  return (
    <Section index="02 · Tipografi" title="Fraunces × Plus Jakarta Sans" note="Fraunces untuk judul bernuansa editorial; Plus Jakarta Sans (foundry Jakarta) untuk UI dan angka tabular.">
      <View style={styles.typeList}>
        {TYPE_SAMPLES.map((s) => (
          <View key={s.variant} style={styles.typeRow}>
            <AppText variant="overline" tone="muted" uppercase>
              {`${s.variant} · ${typeScale[s.variant].fontSize}/${typeScale[s.variant].lineHeight}`}
            </AppText>
            <AppText variant={s.variant} numeric={s.variant === 'amountHero'}>
              {s.text}
            </AppText>
          </View>
        ))}
      </View>
    </Section>
  );
}

export function ShapeSection() {
  const { colors } = useTheme();
  const radii = Object.entries(radius).filter(([k]) => k !== 'full');
  return (
    <Section index="03 · Bentuk & gerak" title="Satu skala, satu ritme" note={`Gerak ${motion.fast}–${motion.slow}ms, hanya transform + opacity, spring lembut. Efek tekan scale ${motion.pressScale}. Semua instan saat reduced motion aktif.`}>
      <View style={styles.radiusRow}>
        {radii.map(([k, v]) => (
          <View key={k} style={styles.radiusItem}>
            <View style={[styles.radiusBox, { borderRadius: v, borderColor: colors.accent, backgroundColor: colors.accentSoft }]} />
            <AppText variant="caption" tone="secondary" numeric>{`${k} ${v}`}</AppText>
          </View>
        ))}
      </View>
      <Card>
        <AppText variant="caption" tone="secondary">
          Spasi 4-pt: {Object.values(space).join(' · ')}
        </AppText>
      </Card>
    </Section>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space.lg },
  swatch: { width: '33.33%', gap: space.xxs, paddingRight: space.sm },
  chipColor: { height: 48, borderRadius: radius.sm, borderWidth: 1, marginBottom: space.xs },
  hueRow: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  hue: { width: 28, height: 28, borderRadius: radius.full },
  typeList: { gap: space.xl },
  typeRow: { gap: space.xs },
  radiusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.lg },
  radiusItem: { alignItems: 'center', gap: space.xs },
  radiusBox: { width: 56, height: 56, borderWidth: 1.5 },
});

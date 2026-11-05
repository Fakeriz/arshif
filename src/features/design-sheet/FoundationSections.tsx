import { StyleSheet, View } from 'react-native';

import { useI18n } from '@/i18n';
import { AppText, Card, GlassView } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';
import { ACCENT_OPTIONS, accents, motion, radius, space, type as typeScale, type Palette, type TypeVariant } from '@/theme/tokens';

import { Section } from './Section';

const SWATCHES: { key: keyof Palette; label: string }[] = [
  { key: 'bg', label: 'Latar' },
  { key: 'text', label: 'Teks' },
  { key: 'textSecondary', label: 'Sekunder' },
  { key: 'textMuted', label: 'Redup' },
  { key: 'positive', label: 'Pemasukan' },
  { key: 'negative', label: 'Over budget' },
  { key: 'warning', label: 'Peringatan' },
  { key: 'info', label: 'Info' },
];

export function ColorSection() {
  const { colors, scheme, hues } = useTheme();
  const { t: tr } = useI18n();
  return (
    <Section index="Warna" title="Kaca & aksen" note="Netral tinta hangat, kaca translusen, satu aksen pilihan pengguna. Hijau selalu pemasukan; over budget punya warna sendiri dan selalu disertai ikon.">
      <AppText variant="overline" tone="muted">Lima aksen (tema ini)</AppText>
      <View style={styles.accentRow}>
        {ACCENT_OPTIONS.map((o) => {
          const t = accents[o.key][scheme];
          return (
            <View key={o.key} style={styles.accentItem}>
              <View style={[styles.accentChip, { backgroundColor: t.accent }]}>
                <AppText variant="caption" style={{ color: t.onAccent }}>Aa</AppText>
              </View>
              <AppText variant="caption">{tr(`domain.accent.${o.key}`)}</AppText>
              <AppText variant="caption" tone="muted" numeric>{t.accent}</AppText>
            </View>
          );
        })}
      </View>
      <View style={styles.grid}>
        {SWATCHES.map((s) => (
          <View key={s.key} style={styles.swatch}>
            <View style={[styles.chipColor, { backgroundColor: colors[s.key], borderColor: colors.borderStrong }]} />
            <AppText variant="caption">{s.label}</AppText>
            <AppText variant="caption" tone="muted" numeric>{colors[s.key].toUpperCase()}</AppText>
          </View>
        ))}
      </View>
      <AppText variant="overline" tone="muted">Lapisan kaca: panel (bening) dan mengambang (pekat)</AppText>
      <View style={styles.glassRow}>
        <GlassView style={styles.glassDemo}><AppText variant="caption">Panel</AppText></GlassView>
        <GlassView level="floating" style={styles.glassDemo}><AppText variant="caption">Mengambang</AppText></GlassView>
      </View>
      <AppText variant="overline" tone="muted">Warna kategori</AppText>
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
];

export function TypeSection() {
  return (
    <Section index="Tipografi" title="Plus Jakarta Sans" note="Satu keluarga untuk judul, UI, dan angka tabular. Dibuat foundry Jakarta, cocok untuk produk yang lahir di Indonesia.">
      <View style={styles.typeList}>
        {TYPE_SAMPLES.map((s) => (
          <View key={s.variant} style={styles.typeRow}>
            <AppText variant="overline" tone="muted">
              {`${s.variant} · ${typeScale[s.variant].fontSize}/${typeScale[s.variant].lineHeight}`}
            </AppText>
            <AppText variant={s.variant}>{s.text}</AppText>
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
    <Section index="Bentuk & gerak" title="Satu skala, satu ritme" note={`Kartu 16, tombol dan input 12, sheet 24. Gerak ${motion.fast}–${motion.slow}ms, hanya transform + opacity, efek tekan ${motion.pressScale}. Instan saat reduced motion aktif.`}>
      <View style={styles.radiusRow}>
        {radii.map(([k, v]) => (
          <View key={k} style={styles.radiusItem}>
            <View style={[styles.radiusBox, { borderRadius: v, borderColor: colors.accentText, backgroundColor: colors.accentSoft }]} />
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
  accentRow: { flexDirection: 'row', gap: space.sm },
  accentItem: { flex: 1, gap: space.xxs },
  accentChip: { height: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', marginBottom: space.xs },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space.lg },
  swatch: { width: '25%', gap: space.xxs, paddingRight: space.sm },
  chipColor: { height: 40, borderRadius: radius.sm, borderWidth: 1, marginBottom: space.xs },
  glassRow: { flexDirection: 'row', gap: space.md },
  glassDemo: { flex: 1, height: 72, alignItems: 'center', justifyContent: 'center' },
  hueRow: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  hue: { width: 28, height: 28, borderRadius: radius.full },
  typeList: { gap: space.xl },
  typeRow: { gap: space.xs },
  radiusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.lg },
  radiusItem: { alignItems: 'center', gap: space.xs },
  radiusBox: { width: 56, height: 56, borderWidth: 1.5 },
});

import { Sparkles } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppText, Badge, Card, EmptyState, HealthGauge, Icon, ProgressBar } from '@/components/ui';
import type { Pillar } from '@/lib/health';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';

/** Narasi AI sungguhan datang di Fase 2 (Gemini via Edge Function). Ini contoh yang selaras dengan data. */
const SAMPLE_NARRATION =
  'Keuanganmu cukup sehat. Tabunganmu sudah jalan dan cicilan masih ringan. Yang paling perlu perhatian bulan ini: belanja kesehatan melewati batas dan dana daruratmu belum sampai 6 bulan pengeluaran.';
const SAMPLE_ACTIONS = [
  'Naikkan setoran tabungan ke 20% penghasilan (Rp 2.850.000).',
  'Tahan belanja non-darurat di kategori Kesehatan sampai periode berikutnya.',
  'Sisihkan sisa anggaran Keinginan ke dana darurat.',
];

function tone(ratio: number): 'positive' | 'warning' | 'negative' {
  return ratio >= 0.7 ? 'positive' : ratio >= 0.4 ? 'warning' : 'negative';
}

export function ScoreTab({ score, delta, pillars }: { score: number | null; delta: number; pillars: Pillar[] }) {
  const { colors } = useTheme();
  if (score === null) {
    return <EmptyState title="Skor belum tersedia" message="Coach butuh minimal satu bulan transaksi untuk menghitung skor yang adil. Mulai catat dari sekarang." />;
  }
  return (
    <View style={styles.wrap}>
      <Card padding="xl">
        <HealthGauge score={score} delta={delta} />
      </Card>
      <Card>
        <AppText variant="h3">Dari mana skornya</AppText>
        <AppText variant="caption" tone="muted">
          Dihitung dengan rumus dari 5 pilar, bukan tebakan AI.
        </AppText>
        <View style={styles.pillars}>
          {pillars.map((p) => (
            <View key={p.key} style={styles.pillar}>
              <View style={styles.pillarHead}>
                <AppText variant="bodyStrong" style={styles.flex}>
                  {p.label}
                </AppText>
                <AppText variant="bodyStrong" numeric>{`${p.points}`}</AppText>
                <AppText variant="caption" tone="muted" numeric>{`/ ${p.max}`}</AppText>
              </View>
              <ProgressBar value={p.points / p.max} tone={tone(p.points / p.max)} height={6} accessibilityLabel={`${p.label}, ${p.points} dari ${p.max}`} />
              <AppText variant="caption" tone="muted">
                {p.hint}
              </AppText>
            </View>
          ))}
        </View>
      </Card>
      <Card>
        <View style={styles.narrHead}>
          <Icon icon={Sparkles} color={colors.accentText} />
          <AppText variant="h3" style={styles.flex}>
            Kata Coach
          </AppText>
          <Badge label="Contoh narasi" />
        </View>
        <AppText variant="body" tone="secondary" style={styles.narr}>
          {SAMPLE_NARRATION}
        </AppText>
        {SAMPLE_ACTIONS.map((a, i) => (
          <View key={a} style={styles.action}>
            <View style={[styles.num, { backgroundColor: colors.accentSoft }]}>
              <AppText variant="caption" tone="accent" numeric>
                {i + 1}
              </AppText>
            </View>
            <AppText variant="body" style={styles.flex}>
              {a}
            </AppText>
          </View>
        ))}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.lg },
  flex: { flex: 1 },
  pillars: { gap: space.xl, marginTop: space.xl },
  pillar: { gap: space.sm },
  pillarHead: { flexDirection: 'row', alignItems: 'baseline', gap: space.xs },
  narrHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  narr: { marginVertical: space.md },
  action: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingVertical: space.xs + 2 },
  num: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});

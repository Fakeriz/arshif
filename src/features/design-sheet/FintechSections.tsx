import { ArrowDownLeft, ArrowUpRight, Landmark, Wallet } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import {
  AppText,
  Card,
  GoalRing,
  NumberPad,
  NumberPadDisplay,
  Sparkline,
  StatTile,
  TrendBadge,
  useNumberPad,
} from '@/components/ui';
import { formatCompact } from '@/lib/money';
import { space } from '@/theme/tokens';

import { Row, Section, StateLabel } from './Section';

const NET_WORTH = [182_400_000, 185_100_000, 183_900_000, 190_250_000, 194_800_000, 199_300_000, 204_150_000];
const SPENDING = [6_200_000, 5_850_000, 7_100_000, 6_400_000, 6_950_000, 7_420_000];
const INCOME = [14_250_000, 14_250_000, 15_100_000, 14_250_000, 16_400_000, 16_400_000];
const MYR_RATE = [3_402, 3_398, 3_411, 3_425, 3_419, 3_437, 3_446, 3_441];

export function StatTileSection() {
  return (
    <Section
      index="Fintech"
      title="StatTile + TrendBadge"
      note="Kartu statistik: nominal, delta ±% terhadap periode lalu, dan sparkline. Pengeluaran memakai invert: naik = merah, panah tetap jujur ke atas."
    >
      <StatTile
        layout="wide"
        label="Kekayaan bersih"
        icon={Landmark}
        amount={NET_WORTH[NET_WORTH.length - 1]}
        currency="IDR"
        change={0.0243}
        changeSuffix="vs bulan lalu"
        series={NET_WORTH}
      />
      <View style={styles.pair}>
        <StatTile label="Pemasukan" icon={ArrowDownLeft} amount={16_400_000} currency="IDR" change={0} series={INCOME} />
        <StatTile label="Pengeluaran" icon={ArrowUpRight} amount={7_420_000} currency="IDR" change={0.068} invert series={SPENDING} />
      </View>
      <StateLabel>Loading · Saldo disembunyikan</StateLabel>
      <View style={styles.pair}>
        <StatTile label="Tabungan" amount={0} currency="IDR" loading />
        <StatTile label="Dompet" icon={Wallet} amount={2_150_000} currency="IDR" change={-0.12} series={SPENDING} hidden />
      </View>
      <StateLabel>TrendBadge</StateLabel>
      <Row>
        <TrendBadge value={0.124} />
        <TrendBadge value={-0.031} />
        <TrendBadge value={0.068} invert />
        <TrendBadge value={0} />
        <TrendBadge value={null} />
        <TrendBadge value={0.4} size="sm" />
      </Row>
    </Section>
  );
}

export function SparklineSection() {
  return (
    <Section index="Fintech" title="Sparkline" note="Garis halus tanpa overshoot, isian gradasi tipis, titik di nilai terakhir. Warna otomatis dari arah awal ke akhir.">
      <Card style={styles.sparkCard}>
        <View style={styles.rateRow}>
          <View style={styles.flex}>
            <AppText variant="bodyStrong">MYR → IDR</AppText>
            <AppText variant="caption" tone="muted">7 hari</AppText>
          </View>
          <Sparkline values={MYR_RATE} width={88} height={28} />
          <View style={styles.rateFig}>
            <AppText variant="amount" numeric>3.441</AppText>
            <TrendBadge value={0.0115} size="sm" />
          </View>
        </View>
      </Card>
      <Row>
        <Sparkline values={[4, 6, 5, 8, 7, 9]} />
        <Sparkline values={[9, 7, 8, 5, 6, 4]} />
        <Sparkline values={[4, 6, 5, 8, 7, 9]} invert />
        <Sparkline values={[5, 5, 5, 5]} />
        <Sparkline values={[3, 7, 4, 8, 6, 9]} tone="accent" area={false} />
      </Row>
    </Section>
  );
}

export function GoalSection() {
  return (
    <Section index="Fintech" title="GoalRing" note="Progres target tabungan memakai aksen (bukan semantik budget). Penuh berganti hijau dengan label Tercapai.">
      <Row>
        <GoalRing value={0.18} label="Laptop baru" />
        <GoalRing value={0.62} label="Dana darurat" />
        <GoalRing value={1} label="Liburan" />
        <GoalRing value={0.45} label="Umrah" size={56} thickness={6} />
      </Row>
      <Card>
        <View style={styles.goalRow}>
          <GoalRing value={0.62} label="Dana darurat" size={64} thickness={6} />
          <View style={styles.flex}>
            <AppText variant="h3">Dana darurat</AppText>
            <AppText variant="caption" tone="secondary" numeric>
              {`${formatCompact(18_600_000, 'IDR')} / ${formatCompact(30_000_000, 'IDR')}`}
            </AppText>
          </View>
        </View>
      </Card>
    </Section>
  );
}

function PadDemo({ currency }: { currency: string }) {
  const pad = useNumberPad(currency);
  return (
    <Card style={styles.padCard}>
      <NumberPadDisplay display={pad.display} currency={currency} rejects={pad.rejects} />
      <NumberPad currency={currency} onKey={pad.onKey} />
    </Card>
  );
}

export function NumberPadSection() {
  return (
    <Section
      index="Fintech"
      title="NumberPad"
      note="Keypad kalkulator nominal: ÷ × − + dan = menghitung (× ÷ lebih dulu). Mata uang tanpa desimal (IDR, JPY, KRW, VND) mendapat tombol 000, yang lain pemisah desimalnya sendiri. Tahan hapus untuk mengosongkan."
    >
      <View style={styles.pair}>
        <PadDemo currency="IDR" />
        <PadDemo currency="MYR" />
      </View>
    </Section>
  );
}

const styles = StyleSheet.create({
  pair: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  flex: { flex: 1 },
  sparkCard: { gap: space.md },
  rateRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  rateFig: { alignItems: 'flex-end', gap: space.xs },
  goalRow: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  padCard: { flexGrow: 1, flexBasis: 0, minWidth: 240, gap: space.lg },
});

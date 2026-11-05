import { Crown } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { usePaywall } from '@/components/shell/Paywall';
import { AppText, Card, CategoryIcon, CurrencyText, EmptyState, GlassView, Icon, PressableScale, ProBadge } from '@/components/ui';
import { shortDate } from '@/lib/dates';
import { topCategoryLabel, type WeeklyRecap } from '@/lib/recap';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Weekly Replay (FR-COACH-5): sorotan minggu lalu dengan angka besar dan nada merayakan,
 * bukan tabel angka. Satu kartu satu cerita.
 */
export function RecapTab({ recap, currency }: { recap: WeeklyRecap; currency: string }) {
  const { colors } = useTheme();
  const paywall = usePaywall();
  const range = `${shortDate(recap.start)} sampai ${shortDate(recap.end)}`;

  if (recap.txCount === 0) {
    return <EmptyState title="Belum ada data minggu lalu" message="Recap muncul setiap Senin pagi setelah ada transaksi di minggu sebelumnya." />;
  }
  const saved = recap.changePct !== null && recap.changePct < 0;

  return (
    <View style={styles.wrap}>
      <AppText variant="overline" tone="secondary">
        {`Replay minggu ${range}`}
      </AppText>
      <GlassView radius={radius.lg} style={[styles.hero, { backgroundColor: colors.accentSoft }]}>
        <AppText variant="caption" tone="secondary">
          Minggu lalu kamu belanja
        </AppText>
        <CurrencyText amount={recap.spent} currency={currency} variant="amountHero" />
        {recap.changePct !== null && (
          <AppText variant="bodyStrong" tone={saved ? 'positive' : 'secondary'}>
            {saved ? `Turun ${Math.abs(recap.changePct)}% dari minggu sebelumnya. Hemat.` : recap.changePct === 0 ? 'Sama dengan minggu sebelumnya.' : `Naik ${recap.changePct}% dari minggu sebelumnya.`}
          </AppText>
        )}
      </GlassView>
      <View style={styles.pair}>
        <Card style={styles.half}>
          <CategoryIcon category={recap.topCategoryKey ?? 'other'} size={44} />
          <AppText variant="caption" tone="secondary">
            Paling banyak di
          </AppText>
          <AppText variant="h3">{topCategoryLabel(recap)}</AppText>
          <CurrencyText amount={recap.topCategorySpent} currency={currency} variant="caption" />
        </Card>
        <Card style={styles.half}>
          <AppText variant="display" numeric>
            {recap.noSpendDays > 0 ? recap.noSpendDays : '7/7'}
          </AppText>
          <AppText variant="caption" tone="secondary">
            {recap.noSpendDays > 0 ? 'hari tanpa belanja' : 'hari ada pengeluaran'}
          </AppText>
          <AppText variant="caption" tone="muted">{`${recap.txCount} transaksi dalam seminggu`}</AppText>
        </Card>
      </View>
      {recap.biggest && (
        <Card>
          <AppText variant="caption" tone="secondary">
            Pengeluaran terbesar
          </AppText>
          <AppText variant="h3">{recap.biggest.merchant}</AppText>
          <CurrencyText amount={recap.biggest.amount} currency={recap.biggest.currency} kind="expense" variant="h2" />
          <AppText variant="caption" tone="muted">
            {shortDate(recap.biggest.date)}
          </AppText>
        </Card>
      )}
      <PressableScale accessibilityLabel="Recap bulanan, fitur Premium. Buka Premium" onPress={() => paywall('Recap bulanan dan Tanya Coach termasuk Premium.')} focusRadius={radius.lg}>
        <GlassView radius={radius.lg} style={styles.locked}>
          <Icon icon={Crown} color={colors.accentText} />
          <View style={styles.flex}>
            <AppText variant="bodyStrong">Recap bulanan</AppText>
            <AppText variant="caption" tone="secondary">
              Muncul setiap tanggal 1, khusus Premium
            </AppText>
          </View>
          <ProBadge size="sm" />
        </GlassView>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.lg },
  flex: { flex: 1 },
  hero: { padding: space.xxl, gap: space.sm },
  pair: { flexDirection: 'row', gap: space.md },
  half: { flex: 1, gap: space.xs },
  locked: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
});

import { Crown } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { usePaywall } from '@/components/shell/Paywall';
import { AppText, Badge, Button, Card, ProgressBar } from '@/components/ui';
import { QUOTA_LABEL, quotaFor, type QuotaKey, type Usage } from '@/lib/quota';
import type { Plan } from '@/data/types';
import { space } from '@/theme/tokens';

const KEYS: QuotaKey[] = ['scan', 'automation', 'importPdf', 'accounts'];

/** Pemakaian kuota bulan ini. Batas yang sudah penuh ditandai dan mengarah ke Premium. */
export function UsageCard({ plan, usage, accountCount, forceLimit }: { plan: Plan; usage: Usage; accountCount: number; forceLimit: boolean }) {
  const paywall = usePaywall();
  return (
    <Card>
      <View style={styles.head}>
        <AppText variant="h3">Pemakaian bulan ini</AppText>
        <Badge label={plan === 'free' ? 'Paket Free' : 'Premium'} tone={plan === 'free' ? 'neutral' : 'accent'} />
      </View>
      <View style={styles.list}>
        {KEYS.map((k) => {
          const limit = quotaFor(plan, k);
          const used = forceLimit && limit !== null ? limit : k === 'accounts' ? accountCount : usage[k];
          const full = limit !== null && used >= limit;
          return (
            <View key={k} style={styles.item}>
              <View style={styles.row}>
                <AppText variant="bodyStrong" style={styles.flex}>
                  {QUOTA_LABEL[k]}
                </AppText>
                <AppText variant="caption" tone={full ? 'warning' : 'secondary'} numeric>
                  {limit === null ? `${used}, tanpa batas` : `${used} / ${limit}`}
                </AppText>
              </View>
              {limit !== null && <ProgressBar value={used / limit} accessibilityLabel={`${QUOTA_LABEL[k]} ${used} dari ${limit}`} height={6} />}
            </View>
          );
        })}
      </View>
      <AppText variant="caption" tone="muted" style={styles.reset}>
        Kuota direset setiap tanggal 1. Pekerjaan AI yang gagal tidak memotong kuota.
      </AppText>
      {plan === 'free' && <Button label="Buka batas dengan Premium" icon={Crown} variant="secondary" size="md" fullWidth onPress={() => paywall('Premium membuka scan 300/bulan, import 10/bulan, dan akun tanpa batas.')} />}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  list: { gap: space.lg, marginVertical: space.lg },
  item: { gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  flex: { flex: 1 },
  reset: { marginBottom: space.lg },
});

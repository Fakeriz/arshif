import { CircleCheck } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/shell/Screen';
import { AppText, Button, Card, Icon } from '@/components/ui';
import { useI18n } from '@/i18n';
import { isoDateLabel } from '@/lib/dates';
import { QUOTAS } from '@/lib/quota';
import { useStore } from '@/state/AppStore';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';

/** Halaman sukses setelah pembelian toko atau pesanan web lunas. Isi = apa yang baru terbuka, dari QUOTAS. */
export default function PremiumSuccessScreen() {
  const router = useRouter();
  const { state } = useStore();
  const { t, lang } = useI18n();
  const { colors } = useTheme();
  const p = QUOTAS.premium;
  const unlocked = [
    `${t('domain.quota.accounts')}: ${t('billing.compare.unlimited')}`,
    `${t('domain.quota.scan')}: ${t('billing.compare.perMonth', { n: p.scan ?? 0 })}`,
    `${t('domain.quota.importPdf')}: ${t('billing.compare.perMonth', { n: p.importPdf ?? 0 })}`,
    `${t('domain.quota.automation')}: ${t('billing.compare.unlimited')}`,
    `${t('billing.compare.coachRow')}: ${t('billing.compare.coachPremium')}`,
  ];
  return (
    <Screen>
      <View style={styles.hero}>
        <Icon icon={CircleCheck} color={colors.positive} size={56} />
        <AppText variant="h1" align="center" accessibilityRole="header">
          {t('billing.success.title')}
        </AppText>
        <AppText variant="body" tone="secondary" align="center">
          {t('billing.success.message')}
        </AppText>
        {state.premiumUntil && (
          <AppText variant="bodyStrong" align="center">
            {t('billing.success.until', { date: isoDateLabel(state.premiumUntil, lang) })}
          </AppText>
        )}
      </View>
      <Card>
        {unlocked.map((line) => (
          <AppText key={line} variant="body" style={styles.line}>
            {line}
          </AppText>
        ))}
      </Card>
      <Button label={t('billing.success.cta')} fullWidth onPress={() => router.replace('/')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: space.md, paddingVertical: space.x3 },
  line: { paddingVertical: space.xs },
});

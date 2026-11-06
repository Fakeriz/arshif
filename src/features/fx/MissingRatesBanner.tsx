import { useRouter } from 'expo-router';
import { TriangleAlert } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Card, Icon } from '@/components/ui';
import { useT } from '@/i18n';
import { useMissingRates } from '@/state/derived';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';

/**
 * Kurs hilang (FR-FX-4): ada mata uang tanpa kurs harian dan tanpa "Kurs saya". Nominalnya tidak dihitung di
 * total sampai kursnya diisi. Aplikasi tidak memakai kurs lain diam-diam; pengguna diminta mengisinya.
 */
export function MissingRatesBanner() {
  const t = useT();
  const { colors } = useTheme();
  const router = useRouter();
  const missing = useMissingRates();
  if (missing.length === 0) return null;
  const codes = missing.join(', ');
  return (
    <Card accessibilityLabel={t('acct.rates.missingTitle', { codes })}>
      <View style={styles.row}>
        <Icon icon={TriangleAlert} color={colors.warning} />
        <View style={styles.flex}>
          <AppText variant="bodyStrong">{t('acct.rates.missingTitle', { codes })}</AppText>
          <AppText variant="caption" tone="secondary">
            {t('acct.rates.missingMessage')}
          </AppText>
        </View>
      </View>
      <Button label={t('acct.rates.fill')} size="md" variant="secondary" fullWidth onPress={() => router.push('/kurs-saya')} />
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start', marginBottom: space.md },
  flex: { flex: 1, gap: space.xxs },
});

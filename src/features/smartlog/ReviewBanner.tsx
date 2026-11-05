import { useRouter } from 'expo-router';
import { ChevronRight, Inbox } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppText, Card, Icon } from '@/components/ui';
import { useT } from '@/i18n';
import { useSmartLog } from '@/state/smartlog';
import { useTheme } from '@/theme/ThemeProvider';
import { layout, space } from '@/theme/tokens';

/** Pengingat di daftar transaksi: ada notifikasi bank yang belum tercatat karena menunggu dicek. */
export function ReviewBanner() {
  const t = useT();
  const router = useRouter();
  const { colors } = useTheme();
  const { review } = useSmartLog();
  if (review.length === 0) return null;
  const label = t('slog.banner.review', { count: review.length });
  return (
    <Card padding="md" onPress={() => router.push('/otomasi/tinjau')} accessibilityLabel={label}>
      <View style={styles.row}>
        <Icon icon={Inbox} color={colors.accentText} />
        <AppText variant="bodyStrong" style={styles.flex}>
          {label}
        </AppText>
        <Icon icon={ChevronRight} color={colors.textMuted} size={layout.iconSize.md} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  flex: { flex: 1 },
});

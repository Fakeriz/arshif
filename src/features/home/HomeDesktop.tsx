import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { useI18n } from '@/i18n';
import { dayLong, todayYmd } from '@/lib/dates';
import { space } from '@/theme/tokens';

/** Judul halaman besar rata kiri + tanggal hari ini, pengganti header ponsel (avatar dan lonceng pindah ke nav atas). */
export function HomeDesktopTitle() {
  const { t, lang } = useI18n();
  return (
    <View style={styles.title}>
      <AppText variant="display" accessibilityRole="header">
        {t('shell.tab.home')}
      </AppText>
      <AppText variant="caption" tone="secondary">
        {dayLong(todayYmd(), lang)}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { gap: space.xs, paddingTop: space.sm, paddingBottom: space.xs },
});

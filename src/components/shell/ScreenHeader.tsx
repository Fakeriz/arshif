import { ChevronLeft } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useT } from '@/i18n';
import { goBack } from '@/components/shell/goBack';
import { AppText } from '@/components/ui';
import { space } from '@/theme/tokens';

import { HeaderButton } from './HeaderActions';

/**
 * Header layar stack (Talmo .top + .phead): baris tombol bulat (kembali, aksi kanan lewat <HeaderActions/>),
 * lalu judul halaman besar rata kiri dengan subjudul redup opsional.
 */
export function ScreenHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  const router = useRouter();
  const t = useT();
  return (
    <View style={styles.wrap}>
      <View style={styles.bar}>
        <HeaderButton label={t('common.back')} icon={ChevronLeft} onPress={() => goBack(router)} />
        {right ? <View style={styles.side}>{right}</View> : null}
      </View>
      <View style={styles.head}>
        <AppText variant="h1" accessibilityRole="header" numberOfLines={2}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="body" tone="muted">
            {subtitle}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.lg },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  side: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  head: { gap: space.sm, marginTop: space.xs },
});

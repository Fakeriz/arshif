import { ChevronLeft } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useT } from '@/i18n';
import { goBack } from '@/components/shell/goBack';
import { AppText, Icon, PressableScale } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';
import { elevation, layout, radius, space } from '@/theme/tokens';

/**
 * Header layar stack (Talmo .top + .phead): baris tombol bulat (kembali, aksi kanan),
 * lalu judul halaman besar rata kiri dengan subjudul redup opsional.
 */
export function ScreenHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  const router = useRouter();
  const { colors, scheme } = useTheme();
  const t = useT();
  return (
    <View style={styles.wrap}>
      <View style={styles.bar}>
        <PressableScale
          accessibilityLabel={t('common.back')}
          focusRadius={radius.full}
          onPress={() => goBack(router)}
          style={[styles.btn, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }, elevation[scheme].card]}
        >
          <Icon icon={ChevronLeft} color={colors.text} />
        </PressableScale>
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
  btn: { width: 44, height: 44, borderRadius: radius.full, borderWidth: layout.hairline, alignItems: 'center', justifyContent: 'center' },
  side: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  head: { gap: space.sm, marginTop: space.xs },
});

import { ChevronLeft } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useT } from '@/i18n';
import { AppText, GlassView, Icon, PressableScale } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

/** Header layar stack: tombol kembali kaca + judul di tengah + slot aksi kanan. */
export function ScreenHeader({ title, right }: { title: string; right?: ReactNode }) {
  const router = useRouter();
  const { colors } = useTheme();
  const t = useT();
  return (
    <View style={styles.row}>
      <PressableScale
        accessibilityLabel={t('common.back')}
        focusRadius={radius.full}
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      >
        <GlassView radius={radius.full} style={styles.btn}>
          <Icon icon={ChevronLeft} color={colors.text} />
        </GlassView>
      </PressableScale>
      <AppText variant="h3" accessibilityRole="header" numberOfLines={1} style={styles.title}>
        {title}
      </AppText>
      <View style={styles.side}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 44 },
  btn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center' },
  side: { width: 44, alignItems: 'flex-end' },
});

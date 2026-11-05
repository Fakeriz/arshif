import { Bell, User } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useT } from '@/i18n';
import { NotificationsSheet } from '@/components/shell/NotificationsSheet';
import { AppText, GlassView, Icon, PressableScale } from '@/components/ui';
import { useStore } from '@/state/AppStore';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

export function HomeHeader() {
  const router = useRouter();
  const { colors } = useTheme();
  const { state } = useStore();
  const [open, setOpen] = useState(false);
  const t = useT();
  const unread = state.notifications.filter((n) => !n.read).length;

  return (
    <View style={styles.row}>
      <PressableScale accessibilityLabel={t('home.profileA11y')} focusRadius={radius.full} onPress={() => router.push('/pengaturan')}>
        <GlassView radius={radius.full} style={styles.btn}>
          <Icon icon={User} color={colors.text} />
        </GlassView>
      </PressableScale>
      <AppText variant="h3">Arshif</AppText>
      <PressableScale accessibilityLabel={unread ? t('home.notifUnreadA11y', { count: unread }) : t('home.notifA11y')} focusRadius={radius.full} onPress={() => setOpen(true)}>
        <GlassView radius={radius.full} style={styles.btn}>
          <Icon icon={Bell} color={colors.text} />
          {unread > 0 && <View style={[styles.dot, { backgroundColor: colors.accent }]} />}
        </GlassView>
      </PressableScale>
      <NotificationsSheet visible={open} onClose={() => setOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  btn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', top: 10, right: 11, width: 8, height: 8, borderRadius: radius.full },
});

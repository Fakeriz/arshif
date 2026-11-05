import { useRouter } from 'expo-router';
import { Bell, CalendarClock, ChartPie, Gauge, Sparkles, type LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppText, BottomSheet, Button, EmptyState, Icon, PressableScale } from '@/components/ui';
import type { NotificationType } from '@/data/types';
import { useStore } from '@/state/AppStore';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

const ICONS: Record<NotificationType, LucideIcon> = {
  weekly_recap: Sparkles,
  budget_alert: ChartPie,
  bill_due: CalendarClock,
  quota_warning: Gauge,
  system: Bell,
};

export function NotificationsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { state, dispatch } = useStore();
  const { colors } = useTheme();
  const router = useRouter();
  const unread = state.notifications.filter((n) => !n.read).length;

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Notifikasi" subtitle={unread ? `${unread} belum dibaca` : 'Semua sudah dibaca'}>
      {state.notifications.length === 0 ? (
        <EmptyState compact title="Belum ada notifikasi" message="Pengingat tagihan dan peringatan anggaran muncul di sini." />
      ) : (
        <View style={styles.list}>
          {state.notifications.map((n) => (
            <PressableScale
              key={n.id}
              accessibilityLabel={`${n.title}. ${n.message}. ${n.read ? 'Sudah dibaca' : 'Belum dibaca'}`}
              focusRadius={radius.md}
              scaleTo={0.985}
              onPress={() => {
                dispatch({ type: 'notif/read', id: n.id });
                if (n.href) {
                  onClose();
                  router.navigate(n.href);
                }
              }}
              style={styles.item}
            >
              <View style={[styles.icon, { backgroundColor: n.read ? colors.track : colors.accentSoft }]}>
                <Icon icon={ICONS[n.type]} color={n.read ? colors.textSecondary : colors.accentText} />
              </View>
              <View style={styles.text}>
                <AppText variant="bodyStrong">{n.title}</AppText>
                <AppText variant="caption" tone="secondary">
                  {n.message}
                </AppText>
                <AppText variant="caption" tone="muted">
                  {n.when}
                </AppText>
              </View>
              {!n.read && <View style={[styles.dot, { backgroundColor: colors.accent }]} />}
            </PressableScale>
          ))}
          {unread > 0 && <Button label="Tandai semua dibaca" variant="secondary" size="md" fullWidth onPress={() => dispatch({ type: 'notif/readAll' })} />}
        </View>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.sm },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingVertical: space.sm },
  icon: { width: 40, height: 40, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: space.xxs },
  dot: { width: 8, height: 8, borderRadius: radius.full, marginTop: space.sm },
});

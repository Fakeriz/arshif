import { Bell, ChartPie, House, ListOrdered, Plus, User, Wallet } from 'lucide-react-native';
import { usePathname, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { AppText, Button, GlassView, Icon, PressableScale } from '@/components/ui';
import { HOME_DESKTOP_WIDTH } from '@/features/home/HomeDesktop';
import { ProfileAvatar } from '@/features/settings/ProfileAvatar';
import { useT } from '@/i18n';
import { useStore } from '@/state/AppStore';
import { useMotion } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';
import { motion, radius, space } from '@/theme/tokens';

import { CaptureSheet } from './CaptureSheet';
import { NotificationsSheet } from './NotificationsSheet';

const TABS = [
  { href: '/', label: 'shell.tab.home', icon: House },
  { href: '/transaksi', label: 'shell.tab.transactions', icon: ListOrdered },
  { href: '/anggaran', label: 'shell.tab.budget', icon: ChartPie },
  { href: '/aset', label: 'shell.tab.assets', icon: Wallet },
] as const;

function activeIndex(path: string) {
  const i = TABS.findIndex((tab) => tab.href !== '/' && path.startsWith(tab.href));
  return i < 0 ? 0 : i;
}

/**
 * Nav desktop ala Talmo: nama produk kiri, pill tab di tengah dengan sorotan tinta yang bergeser ke tab aktif
 * (gerak menunjukkan dari mana ke mana kita pindah), notifikasi + profil + "Catat transaksi" di kanan.
 */
export function DesktopNav() {
  const router = useRouter();
  const t = useT();
  const { colors } = useTheme();
  const { state } = useStore();
  const { timing } = useMotion();
  const [capture, setCapture] = useState(false);
  const [notif, setNotif] = useState(false);
  const unread = state.notifications.filter((n) => !n.read).length;
  const active = activeIndex(usePathname());

  // Posisi tiap tab diukur saat layout; sorotan meluncur ke posisi tab aktif.
  const frames = useRef<{ x: number; width: number }[]>([]);
  const [measured, setMeasured] = useState(false);
  const x = useSharedValue(0);
  const w = useSharedValue(0);
  useEffect(() => {
    const f = frames.current[active];
    if (!f) return;
    x.value = timing(f.x, motion.slow);
    w.value = timing(f.width, motion.slow);
  }, [active, measured, timing, x, w]);
  const highlight = useAnimatedStyle(() => ({ width: w.value, transform: [{ translateX: x.value }] }));

  return (
    <View style={styles.bar}>
      <AppText variant="h2" style={styles.brand}>
        Arshif
      </AppText>

      <GlassView radius={radius.full} style={styles.pill}>
        <View accessibilityRole="tablist" style={styles.tabs}>
          <Animated.View pointerEvents="none" style={[styles.highlight, { backgroundColor: colors.accent, opacity: measured ? 1 : 0 }, highlight]} />
          {TABS.map((tab, i) => {
            const on = i === active;
            const fg = on ? colors.onAccent : colors.textSecondary;
            return (
              <PressableScale
                key={tab.href}
                accessibilityRole="tab"
                aria-selected={on}
                focusRadius={radius.full}
                onLayout={(e) => {
                  frames.current[i] = { x: e.nativeEvent.layout.x, width: e.nativeEvent.layout.width };
                  if (frames.current.filter(Boolean).length === TABS.length && !measured) {
                    // Posisi awal tanpa animasi: sorotan sudah di tab aktif saat halaman dibuka.
                    const f = frames.current[active];
                    x.value = f.x;
                    w.value = f.width;
                    setMeasured(true);
                  }
                }}
                onPress={() => router.navigate(tab.href)}
                style={styles.tab}
              >
                <Icon icon={tab.icon} color={fg} size={18} />
                <AppText variant="button" style={{ color: fg }}>
                  {t(tab.label)}
                </AppText>
              </PressableScale>
            );
          })}
        </View>
      </GlassView>

      <View style={styles.right}>
        <PressableScale
          accessibilityLabel={unread ? t('home.notifUnreadA11y', { count: unread }) : t('home.notifA11y')}
          focusRadius={radius.full}
          onPress={() => setNotif(true)}
        >
          <GlassView radius={radius.full} style={styles.iconBtn}>
            <Icon icon={Bell} color={colors.text} />
            {unread > 0 && <View style={[styles.dot, { backgroundColor: colors.accent }]} />}
          </GlassView>
        </PressableScale>
        <PressableScale accessibilityLabel={t('home.profileA11y')} focusRadius={radius.full} onPress={() => router.push('/pengaturan')}>
          {state.avatarPath ? (
            <ProfileAvatar size={44} />
          ) : (
            <GlassView radius={radius.full} style={styles.iconBtn}>
              <Icon icon={User} color={colors.text} />
            </GlassView>
          )}
        </PressableScale>
        <Button label={t('common.addTransaction')} icon={Plus} onPress={() => setCapture(true)} />
      </View>

      <CaptureSheet visible={capture} onClose={() => setCapture(false)} />
      <NotificationsSheet visible={notif} onClose={() => setNotif(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  // Sejajar dengan kolom Beranda (lebar dan gutter sama dengan Screen), jadi nama produk segaris dengan judul.
  bar: { flexDirection: 'row', alignItems: 'center', gap: space.lg, width: '100%', maxWidth: HOME_DESKTOP_WIDTH + space.lg * 2, alignSelf: 'center', paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: space.sm },
  brand: { flex: 1 },
  pill: { padding: space.xs + 2 },
  tabs: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  highlight: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: radius.full },
  tab: { flexDirection: 'row', alignItems: 'center', gap: space.sm, height: 44, paddingHorizontal: space.lg, borderRadius: radius.full },
  right: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: space.sm },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', top: 10, right: 11, width: 8, height: 8, borderRadius: radius.full },
});

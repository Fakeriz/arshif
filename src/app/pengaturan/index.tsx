import { useRouter } from 'expo-router';
import { Bell, BellRing, ChevronRight, CreditCard, Database, DatabaseBackup, LogOut, Palette, Shapes, ShieldCheck, Wallet } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { GridCell, GridRow } from '@/components/shell/DesktopGrid';
import { Screen } from '@/components/shell/Screen';
import { HeaderButton } from '@/components/shell/HeaderActions';
import { ScreenHeader } from '@/components/shell/ScreenHeader';
import { AppText, Card, Dialog, Icon, MenuGroup, type MenuEntry } from '@/components/ui';
import { isAdmin } from '@/data/remote/api';
import { useDesktop } from '@/hooks/useDesktop';
import { LANGS, useI18n } from '@/i18n';
import { isoDateLabel } from '@/lib/dates';
import { supabase } from '@/lib/supabase';
import { useStore } from '@/state/AppStore';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';
import { ProfileAvatar } from '@/features/settings/ProfileAvatar';
import { profileName } from '@/lib/profile';
import { backupDue, loadSchedule, type BackupSchedule } from '@/features/backup/service';

const NOTIF_COUNT = 4;

/**
 * Pengaturan = daftar menu per kategori. Setiap baris membuka layar turunannya (atau sheet bahasa); baris kedua
 * menampilkan keadaan sekarang supaya tidak perlu membuka menu hanya untuk mengecek.
 */
export default function PengaturanScreen() {
  const { colors, mode } = useTheme();
  const { state } = useStore();
  const { t, lang } = useI18n();
  const desktop = useDesktop();
  const router = useRouter();
  const [admin, setAdmin] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [backup, setBackup] = useState<BackupSchedule | null>(null);
  useEffect(() => {
    void loadSchedule().then(setBackup);
  }, []);
  // Panel admin hanya web; barisnya hanya muncul untuk akun admin (server tetap memeriksa ulang).
  useEffect(() => {
    if (Platform.OS === 'web') isAdmin().then(setAdmin).catch(() => undefined);
  }, []);
  const name = profileName(state.displayName, state.email);
  const notifOn = Object.values(state.notifPrefs).filter(Boolean).length;
  const account: MenuEntry[] = [
    // Paket & masa aktif Pro ada di Profil (kartu di atas).
    { key: 'accounts', icon: CreditCard, title: t('settings.accounts.title'), subtitle: t('settings.menu.accountsCount', { count: state.accounts.length }), onPress: () => router.push('/pengaturan/akun') },
    { key: 'smartlog', icon: BellRing, title: t('slog.automation.entry'), subtitle: t('slog.automation.entrySub'), onPress: () => router.push('/otomasi') },
  ];
  const prefs: MenuEntry[] = [
    { key: 'finance', icon: Wallet, title: t('settings.menu.finance'), subtitle: `${state.mainCurrency} · ${t('settings.payday.value', { day: state.payday })}`, onPress: () => router.push('/pengaturan/keuangan') },
    {
      key: 'categories', icon: Shapes, title: t('settings.categories.title'), onPress: () => router.push('/pengaturan/kategori'),
      subtitle: t('settings.categories.menuSub', { count: state.categories.custom.filter((c) => !c.deleted).length, hidden: state.categories.hidden.length }),
    },
    { key: 'appearance', icon: Palette, title: t('settings.appearance'), subtitle: `${t(`settings.themeMode.${mode}`)} · ${LANGS.find((l) => l.key === lang)?.nativeName ?? lang}`, onPress: () => router.push('/pengaturan/tampilan') },
    { key: 'notif', icon: Bell, title: t('settings.notifications'), subtitle: t('settings.menu.notifCount', { on: notifOn, total: NOTIF_COUNT }), onPress: () => router.push('/pengaturan/notifikasi') },
  ];
  const backupSub = backup && backupDue(backup) ? t('settings.backup.menuDue') : backup?.lastAt ? isoDateLabel(backup.lastAt, lang) : t('settings.backup.menuNever');
  const data: MenuEntry[] = [
    { key: 'backup', icon: DatabaseBackup, title: t('settings.backup.title'), subtitle: backupSub, onPress: () => router.push('/pengaturan/cadangan') },
    { key: 'data', icon: Database, title: t('settings.menu.data'), subtitle: t('settings.menu.dataSub'), onPress: () => router.push('/pengaturan/data') },
    ...(admin ? [{ key: 'admin', icon: ShieldCheck, title: t('billing.admin.title'), subtitle: t('settings.menu.adminSub'), onPress: () => router.push('/admin') }] : []),
  ];

  const profileCard = (
    <Card onPress={() => router.push('/pengaturan/profil')} accessibilityLabel={t('settings.profile.cardA11y', { name })}>
      <View style={styles.profile}>
        <ProfileAvatar size={56} />
        <View style={styles.flex}>
          <AppText variant="h3" numberOfLines={1}>
            {name}
          </AppText>
          <AppText variant="caption" tone="secondary" numberOfLines={1}>
            {state.email}
          </AppText>
        </View>
        <Icon icon={ChevronRight} color={colors.textSecondary} />
      </View>
    </Card>
  );
  const accountGroup = <MenuGroup label={t('settings.groups.account')} entries={account} />;
  const prefsGroup = <MenuGroup label={t('settings.groups.prefs')} entries={prefs} />;
  const dataGroup = <MenuGroup label={t('settings.groups.data')} entries={data} />;

  return (
    <Screen wide={desktop}>
      <ScreenHeader title={t('settings.title')} right={<HeaderButton label={t('settings.signOut')} icon={LogOut} onPress={() => setSigningOut(true)} />} />
      {desktop ? (
        // Desktop: profil selebar halaman, lalu dua kolom yang sama-sama diawali label grup (sejajar),
        // Akun + Data di kiri dan Preferensi di kanan agar tingginya hampir sama.
        <>
          {profileCard}
          <GridRow style={styles.top}>
            <GridCell span={6}>
              {accountGroup}
              {dataGroup}
            </GridCell>
            <GridCell span={6} order={1}>
              {prefsGroup}
            </GridCell>
          </GridRow>
        </>
      ) : (
        <>
          {profileCard}
          {accountGroup}
          {prefsGroup}
          {dataGroup}
        </>
      )}


      {/* Keluar (ikon kanan atas) selalu dikonfirmasi dulu. Sesi dihapus dari perangkat, gerbang rute kembali ke layar masuk. */}
      <Dialog
        visible={signingOut}
        title={t('settings.signOutTitle')}
        message={t('settings.signOutMessage')}
        confirmLabel={t('settings.signOut')}
        onCancel={() => setSigningOut(false)}
        onConfirm={() => {
          setSigningOut(false);
          void supabase.auth.signOut();
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { alignItems: 'flex-start' },
  profile: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  flex: { flex: 1, minWidth: 0 },
});

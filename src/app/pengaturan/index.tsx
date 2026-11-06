import { useRouter } from 'expo-router';
import { Bell, BellRing, CreditCard, Crown, Database, Languages, LogOut, Palette, ShieldCheck, Wallet } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/shell/Screen';
import { ScreenHeader } from '@/components/shell/ScreenHeader';
import { AppText, Button, Card } from '@/components/ui';
import { isAdmin } from '@/data/remote/api';
import { MenuGroup, type MenuEntry } from '@/features/settings/kit';
import { LanguageSheet } from '@/features/settings/LanguageSheet';
import { LANGS, useI18n } from '@/i18n';
import { isoDateLabel } from '@/lib/dates';
import { supabase } from '@/lib/supabase';
import { useStore } from '@/state/AppStore';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

const NOTIF_COUNT = 4;

/**
 * Pengaturan = daftar menu per kategori. Setiap baris membuka layar turunannya (atau sheet bahasa); baris kedua
 * menampilkan keadaan sekarang supaya tidak perlu membuka menu hanya untuk mengecek.
 */
export default function PengaturanScreen() {
  const { colors, mode, accent } = useTheme();
  const { state } = useStore();
  const { t, lang } = useI18n();
  const router = useRouter();
  const [langOpen, setLangOpen] = useState(false);
  const [admin, setAdmin] = useState(false);
  // Panel admin hanya web; barisnya hanya muncul untuk akun admin (server tetap memeriksa ulang).
  useEffect(() => {
    if (Platform.OS === 'web') isAdmin().then(setAdmin).catch(() => undefined);
  }, []);
  const name = state.displayName?.trim() || state.email.split('@')[0];
  const initials = name.split(/[\s._-]+/).filter(Boolean).map((p) => p[0]!.toUpperCase()).slice(0, 2).join('');
  const notifOn = Object.values(state.notifPrefs).filter(Boolean).length;
  const premium = state.plan === 'premium';

  const planLine = premium
    ? state.premiumUntil
      ? t('billing.settings.until', { date: isoDateLabel(state.premiumUntil, lang) })
      : t('settings.usage.planPremium')
    : t('settings.usage.planFree');

  const account: MenuEntry[] = [
    { key: 'plan', icon: Crown, title: t('settings.menu.plan'), subtitle: planLine, onPress: () => router.push('/pengaturan/paket') },
    { key: 'accounts', icon: CreditCard, title: t('settings.accounts.title'), subtitle: t('settings.menu.accountsCount', { count: state.accounts.length }), onPress: () => router.push('/pengaturan/akun') },
    { key: 'smartlog', icon: BellRing, title: t('slog.automation.entry'), subtitle: t('slog.automation.entrySub'), onPress: () => router.push('/otomasi') },
  ];
  const prefs: MenuEntry[] = [
    { key: 'language', icon: Languages, title: t('settings.language'), subtitle: LANGS.find((l) => l.key === lang)?.nativeName ?? lang, onPress: () => setLangOpen(true) },
    { key: 'finance', icon: Wallet, title: t('settings.menu.finance'), subtitle: `${state.mainCurrency} · ${t('settings.payday.value', { day: state.payday })}`, onPress: () => router.push('/pengaturan/keuangan') },
    { key: 'appearance', icon: Palette, title: t('settings.appearance'), subtitle: `${t(`settings.themeMode.${mode}`)} · ${t(`domain.accent.${accent}`)}`, onPress: () => router.push('/pengaturan/tampilan') },
    { key: 'notif', icon: Bell, title: t('settings.notifications'), subtitle: t('settings.menu.notifCount', { on: notifOn, total: NOTIF_COUNT }), onPress: () => router.push('/pengaturan/notifikasi') },
  ];
  const data: MenuEntry[] = [
    { key: 'data', icon: Database, title: t('settings.menu.data'), subtitle: t('settings.menu.dataSub'), onPress: () => router.push('/pengaturan/data') },
    ...(admin ? [{ key: 'admin', icon: ShieldCheck, title: t('billing.admin.title'), subtitle: t('settings.menu.adminSub'), onPress: () => router.push('/admin') }] : []),
  ];

  return (
    <Screen>
      <ScreenHeader title={t('settings.title')} />
      <Card>
        <View style={styles.profile}>
          <View style={[styles.avatar, { backgroundColor: colors.accentSoft }]}>
            <AppText variant="h2" tone="accent">
              {initials}
            </AppText>
          </View>
          <View style={styles.flex}>
            <AppText variant="h3" numberOfLines={1}>
              {name}
            </AppText>
            <AppText variant="caption" tone="secondary" numberOfLines={1}>
              {state.email}
            </AppText>
          </View>
        </View>
      </Card>

      <MenuGroup label={t('settings.groups.account')} entries={account} />
      <MenuGroup label={t('settings.groups.prefs')} entries={prefs} />
      <MenuGroup label={t('settings.groups.data')} entries={data} />

      {/* Keluar: sesi dihapus dari perangkat, gerbang rute kembali ke layar masuk. */}
      <Button label={t('settings.signOut')} icon={LogOut} variant="secondary" fullWidth onPress={() => void supabase.auth.signOut()} />
      <LanguageSheet visible={langOpen} onClose={() => setLangOpen(false)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  profile: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  avatar: { width: 52, height: 52, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0 },
});

import { LogOut, ShieldCheck } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';
import { useEffect, useState } from 'react';

import { CurrencySheet } from '@/components/shell/CurrencySheet';
import { Screen } from '@/components/shell/Screen';
import { ScreenHeader } from '@/components/shell/ScreenHeader';
import { AccentPicker, AppText, Button, Card, ListItem, Tabs, Toggle } from '@/components/ui';
import { AccountsCard } from '@/features/settings/AccountsCard';
import { DataCard } from '@/features/settings/DataCard';
import { LanguageSheet } from '@/features/settings/LanguageSheet';
import { PaydaySheet } from '@/features/settings/PaydaySheet';
import { UsageCard } from '@/features/settings/UsageCard';
import { LANGS, useI18n } from '@/i18n';
import { isAdmin } from '@/data/remote/api';
import { currencyMeta } from '@/lib/money';
import { useStore } from '@/state/AppStore';
import { supabase } from '@/lib/supabase';
import { HAPTIC_LEVELS, haptic, useHapticLevel } from '@/theme/motion';
import { useTheme, type ThemeMode } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import type { NotifPrefs } from '@/state/reducer';

const MODES: ThemeMode[] = ['system', 'dark', 'light'];
const NOTIFS: (keyof NotifPrefs)[] = ['bill_due', 'budget_alert', 'weekly_recap', 'quota_warning'];

export default function PengaturanScreen() {
  const { colors, mode, setMode } = useTheme();
  const { state, dispatch } = useStore();
  const { t, lang } = useI18n();
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [paydayOpen, setPaydayOpen] = useState(false);
  const [hapticLevel, setHapticLevel] = useHapticLevel();
  const router = useRouter();
  const [admin, setAdmin] = useState(false);
  // Panel admin hanya web; tombolnya hanya muncul untuk akun admin (server tetap memeriksa ulang).
  useEffect(() => {
    if (Platform.OS === 'web') isAdmin().then(setAdmin).catch(() => undefined);
  }, []);
  const name = state.displayName?.trim() || state.email.split('@')[0];
  const initials = name.split(/[\s._-]+/).filter(Boolean).map((p) => p[0]!.toUpperCase()).slice(0, 2).join('');

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
            <AppText variant="caption" tone="secondary">
              {state.email}
            </AppText>
          </View>
        </View>
      </Card>

      <UsageCard plan={state.plan} usage={state.usage} accountCount={state.accounts.length} />

      <AccountsCard />

      <Card padding="md">
        <ListItem
          title={t('slog.automation.entry')}
          subtitle={t('slog.automation.entrySub')}
          subtitleLines={2}
          chevron
          onPress={() => router.push('/otomasi')}
        />
      </Card>

      <Card>
        <AppText variant="h3">{t('settings.appearance')}</AppText>
        <View style={styles.block}>
          <AppText variant="caption" tone="secondary">
            {t('settings.theme')}
          </AppText>
          <Tabs items={MODES.map((key) => ({ key, label: t(`settings.themeMode.${key}`) }))} value={mode} onChange={setMode} accessibilityLabel={t('settings.theme')} />
        </View>
        <View style={styles.block}>
          <AppText variant="caption" tone="secondary">
            {t('common.accentColor')}
          </AppText>
          <AccentPicker />
        </View>
        <View style={styles.block}>
          <AppText variant="caption" tone="secondary">
            {t('settings.haptics')}
          </AppText>
          <Tabs
            items={HAPTIC_LEVELS.map((key) => ({ key, label: t(`settings.hapticLevel.${key}`) }))}
            value={hapticLevel}
            onChange={(level) => {
              setHapticLevel(level);
              // Contoh langsung dari intensitas yang baru dipilih.
              haptic('selection');
            }}
            accessibilityLabel={t('settings.haptics')}
          />
          <AppText variant="caption" tone="muted">
            {t('settings.hapticsSub')}
          </AppText>
        </View>
      </Card>

      <Card padding="md">
        <ListItem
          title={t('settings.language')}
          subtitle={t('settings.languageSub')}
          subtitleLines={2}
          trailing={LANGS.find((l) => l.key === lang)?.nativeName}
          chevron
          divider
          onPress={() => setLangOpen(true)}
        />
        <ListItem
          title={t('settings.mainCurrency')}
          subtitle={t('settings.mainCurrencySub')}
          subtitleLines={2}
          trailing={currencyMeta(state.mainCurrency).code}
          chevron
          divider
          onPress={() => setCurrencyOpen(true)}
        />
        <ListItem
          title={t('settings.payday.title')}
          subtitle={t('settings.payday.rowSub')}
          subtitleLines={2}
          trailing={t('settings.payday.value', { day: state.payday })}
          chevron
          divider
          onPress={() => setPaydayOpen(true)}
        />
        <ListItem
          title={t('acct.rates.title')}
          subtitle={t('acct.rates.rowSub')}
          subtitleLines={2}
          trailing={state.userRates.length ? String(state.userRates.length) : undefined}
          chevron
          divider
          onPress={() => router.push('/kurs-saya')}
        />
        <ListItem
          title={t('settings.hideBalance')}
          subtitle={t('settings.hideBalanceSub')}
          subtitleLines={2}
          trailing={<Toggle value={state.hideBalance} onChange={(value) => dispatch({ type: 'prefs/hideBalance', value })} accessibilityLabel={t('settings.hideBalance')} />}
        />
      </Card>

      <Card padding="md">
        <AppText variant="h3" style={styles.cardTitle}>
          {t('settings.notifications')}
        </AppText>
        {NOTIFS.map((key, i) => (
          <ListItem
            key={key}
            title={t(`settings.notif.${key}.title`)}
            subtitle={t(`settings.notif.${key}.sub`)}
            subtitleLines={2}
            divider={i < NOTIFS.length - 1}
            trailing={<Toggle value={state.notifPrefs[key]} onChange={(value) => dispatch({ type: 'prefs/notif', key, value })} accessibilityLabel={t(`settings.notif.${key}.title`)} />}
          />
        ))}
      </Card>

      <DataCard />
      {admin && <Button label={t('billing.admin.title')} icon={ShieldCheck} variant="secondary" fullWidth onPress={() => router.push('/admin')} />}
      {/* Keluar: sesi dihapus dari perangkat, gerbang rute kembali ke layar masuk. */}
      <Button label={t('settings.signOut')} icon={LogOut} variant="secondary" fullWidth onPress={() => void supabase.auth.signOut()} />
      <LanguageSheet visible={langOpen} onClose={() => setLangOpen(false)} />
      <PaydaySheet visible={paydayOpen} value={state.payday} onClose={() => setPaydayOpen(false)} onChange={(payday) => dispatch({ type: 'prefs/payday', payday })} />
      <CurrencySheet visible={currencyOpen} value={state.mainCurrency} onClose={() => setCurrencyOpen(false)} onSelect={(code) => dispatch({ type: 'prefs/mainCurrency', code })} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  profile: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  avatar: { width: 52, height: 52, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  block: { gap: space.sm, marginTop: space.lg },
  cardTitle: { paddingHorizontal: space.xs, paddingTop: space.xs },
});

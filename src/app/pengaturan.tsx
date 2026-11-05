import { StyleSheet, View } from 'react-native';
import { useState } from 'react';

import { CurrencySheet } from '@/components/shell/CurrencySheet';
import { Screen } from '@/components/shell/Screen';
import { ScreenHeader } from '@/components/shell/ScreenHeader';
import { AccentPicker, AppText, Card, ListItem, Tabs, Toggle } from '@/components/ui';
import { DEMO_USER } from '@/data/seed';
import { DataCard } from '@/features/settings/DataCard';
import { UsageCard } from '@/features/settings/UsageCard';
import { currencyMeta } from '@/lib/money';
import { useStore } from '@/state/AppStore';
import { useDemoState } from '@/state/demo';
import { useTheme, type ThemeMode } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import type { NotifPrefs } from '@/state/reducer';

const MODES: { key: ThemeMode; label: string }[] = [
  { key: 'system', label: 'Sistem' },
  { key: 'dark', label: 'Gelap' },
  { key: 'light', label: 'Terang' },
];

const NOTIFS: { key: keyof NotifPrefs; title: string; sub: string }[] = [
  { key: 'bill_due', title: 'Tagihan jatuh tempo', sub: 'H-3 dan pada hari jatuh tempo' },
  { key: 'budget_alert', title: 'Peringatan anggaran', sub: 'Saat pemakaian bucket mencapai 80% dan 100%' },
  { key: 'weekly_recap', title: 'Recap mingguan', sub: 'Setiap Senin pagi' },
  { key: 'quota_warning', title: 'Kuota hampir habis', sub: 'Saat kuota scan atau automation menipis' },
];

export default function PengaturanScreen() {
  const { colors, mode, setMode } = useTheme();
  const { state, dispatch } = useStore();
  const demo = useDemoState();
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const initials = DEMO_USER.name.split(' ').map((p) => p[0]).slice(0, 2).join('');

  return (
    <Screen>
      <ScreenHeader title="Pengaturan" />
      <Card>
        <View style={styles.profile}>
          <View style={[styles.avatar, { backgroundColor: colors.accentSoft }]}>
            <AppText variant="h2" tone="accent">
              {initials}
            </AppText>
          </View>
          <View style={styles.flex}>
            <AppText variant="h3">{DEMO_USER.name}</AppText>
            <AppText variant="caption" tone="secondary">
              {DEMO_USER.email}
            </AppText>
          </View>
        </View>
      </Card>

      <UsageCard plan={state.plan} usage={state.usage} accountCount={state.accounts.length} forceLimit={demo === 'limit'} />

      <Card>
        <AppText variant="h3">Tampilan</AppText>
        <View style={styles.block}>
          <AppText variant="caption" tone="secondary">
            Tema
          </AppText>
          <Tabs items={MODES} value={mode} onChange={setMode} accessibilityLabel="Tema" />
        </View>
        <View style={styles.block}>
          <AppText variant="caption" tone="secondary">
            Warna aksen
          </AppText>
          <AccentPicker />
        </View>
      </Card>

      <Card padding="md">
        <ListItem
          title="Mata uang utama"
          subtitle="Semua total dan anggaran dikonversi ke sini"
          subtitleLines={2}
          trailing={currencyMeta(state.mainCurrency).code}
          chevron
          divider
          onPress={() => setCurrencyOpen(true)}
        />
        <ListItem
          title="Sembunyikan saldo"
          subtitle="Saldo tampil sebagai titik di Beranda"
          trailing={<Toggle value={state.hideBalance} onChange={(value) => dispatch({ type: 'prefs/hideBalance', value })} accessibilityLabel="Sembunyikan saldo" />}
        />
      </Card>

      <Card padding="md">
        <AppText variant="h3" style={styles.cardTitle}>
          Notifikasi
        </AppText>
        {NOTIFS.map((n, i) => (
          <ListItem
            key={n.key}
            title={n.title}
            subtitle={n.sub}
            subtitleLines={2}
            divider={i < NOTIFS.length - 1}
            trailing={<Toggle value={state.notifPrefs[n.key]} onChange={(value) => dispatch({ type: 'prefs/notif', key: n.key, value })} accessibilityLabel={n.title} />}
          />
        ))}
      </Card>

      <DataCard />
      <AppText variant="caption" tone="muted" align="center">
        Arshif versi pengembangan Fase 1. Semua data di layar ini adalah contoh.
      </AppText>
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

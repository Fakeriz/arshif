import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import {
  Command,
  Cpu,
  ExternalLink,
  Globe,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Moon,
  Receipt,
  Sun,
  Users,
  type LucideIcon,
} from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';

import { Screen } from '@/components/shell/Screen';
import { AppText, Button, Card, Chip, EmptyState, Icon, PressableScale, Skeleton, Tabs } from '@/components/ui';
import { isAdmin } from '@/data/remote/api';
import { probeSystemHealth, type SystemHealthProbe } from '@/features/admin/adminApi';
import { CommandPalette } from '@/features/admin/CommandPalette';
import { copy } from '@/features/admin/copy';
import { DashboardSection } from '@/features/admin/Dashboard';
import { AiSection, OrdersSection } from '@/features/admin/Logs';
import { BroadcastSection, FxSection } from '@/features/admin/Ops';
import { useLoad, type AdminNavTarget, type AdminSectionKey } from '@/features/admin/parts';
import { UsersSection } from '@/features/admin/Users';
import { clearReturnTo, setReturnTo } from '@/lib/returnTo';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/state/session';
import { clearUserLocalData } from '@/state/sessionCleanup';
import { useTheme, type ThemeMode } from '@/theme/ThemeProvider';
import { layout, radius, space } from '@/theme/tokens';
import { withThemeTransition } from '@/theme/viewTransition';

const SECTIONS: readonly AdminSectionKey[] = ['dasbor', 'pengguna', 'ai', 'pesanan', 'kurs', 'broadcast'] as const;
const SECTION_ICONS: Record<AdminSectionKey, LucideIcon> = {
  dasbor: LayoutDashboard,
  pengguna: Users,
  ai: Cpu,
  pesanan: Receipt,
  kurs: Globe,
  broadcast: Megaphone,
};
const WIDTH = 1240;

/**
 * Admin web (FR-ADM-1..4). Hanya web: di aplikasi mobile rute ini langsung kembali ke Home.
 * Akses = role admin di server (admin_users); RPC dan function admin menolak akun lain, layar ini hanya
 * tidak menampilkan panelnya. Bagian aktif ada di URL (?bagian=) supaya muat ulang tetap di tempat.
 */
export default function AdminScreen() {
  if (Platform.OS !== 'web') return <Redirect href="/" />;
  return <AdminWeb />;
}

function AdminWeb() {
  const { session, ready } = useSession();
  const router = useRouter();
  const email = session?.user.email ?? '';
  const access = useLoad(() => (session ? isAdmin() : Promise.resolve(false)), [session?.user.id]);

  useEffect(() => {
    if (session && access.data) clearReturnTo();
  }, [session, access.data]);

  if (!ready) return <Gate loading />;
  if (!session) {
    return (
      <Gate>
        <EmptyState
          title={copy.gate.signInTitle}
          message={copy.gate.signInMessage}
          actionLabel={copy.gate.signIn}
          onAction={() => {
            setReturnTo('/admin');
            router.push('/masuk');
          }}
        />
      </Gate>
    );
  }
  if (access.error) {
    return (
      <Gate>
        <EmptyState kind="error" title={copy.gate.errorTitle} message={copy.gate.errorMessage} actionLabel={copy.retry} onAction={access.reload} />
      </Gate>
    );
  }
  if (access.data === null || access.loading) return <Gate loading />;
  if (!access.data) {
    return (
      <Gate>
        <EmptyState kind="error" title={copy.gate.forbiddenTitle} message={copy.gate.forbiddenMessage(email)} actionLabel={copy.signOut} onAction={() => void clearUserLocalData().finally(() => supabase.auth.signOut())} />
      </Gate>
    );
  }
  return <Panel email={email} />;
}

function Gate({ loading, children }: { loading?: boolean; children?: React.ReactNode }) {
  return (
    <Screen maxWidth={1080}>
      <AppText variant="h2" accessibilityRole="header">
        {copy.title}
      </AppText>
      {loading ? (
        <View accessibilityRole="progressbar" accessibilityLabel={copy.gate.checking} style={styles.gate}>
          <Skeleton height={44} radius={radius.md} />
          <Skeleton height={200} radius={radius.lg} />
        </View>
      ) : (
        children
      )}
    </Screen>
  );
}

function resolveSection(raw: string | undefined): AdminSectionKey {
  return SECTIONS.includes(raw as AdminSectionKey) ? (raw as AdminSectionKey) : 'dasbor';
}

function Panel({ email }: { email: string }) {
  const params = useLocalSearchParams<{ bagian?: string; uid?: string; q?: string; email?: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { colors, mode, scheme, setMode } = useTheme();
  const desktop = width >= 960;

  const [nav, setNav] = useState<AdminNavTarget>(() => ({
    bagian: resolveSection(params.bagian),
    uid: params.uid || undefined,
    q: params.q || undefined,
    email: params.email || undefined,
  }));
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [fxAutoSyncSeq, setFxAutoSyncSeq] = useState(0);
  const [assetAutoSyncSeq, setAssetAutoSyncSeq] = useState(0);

  useEffect(() => {
    setNav({
      bagian: resolveSection(params.bagian),
      uid: params.uid || undefined,
      q: params.q || undefined,
      email: params.email || undefined,
    });
  }, [params.bagian, params.uid, params.q, params.email]);

  const health = useLoad(probeSystemHealth, []);

  const navigateAdmin = useCallback(
    (next: AdminNavTarget) => {
      setNav(next);
      router.setParams({
        bagian: next.bagian,
        uid: next.uid ?? '',
        q: next.q ?? '',
        email: next.email ?? '',
      });
    },
    [router],
  );

  const changeTheme = useCallback(
    (next: ThemeMode) => {
      withThemeTransition(() => setMode(next));
    },
    [setMode],
  );

  const cycleTheme = useCallback(() => {
    const order: ThemeMode[] = ['system', 'dark', 'light'];
    const idx = order.indexOf(mode);
    changeTheme(order[(idx + 1) % order.length]);
  }, [mode, changeTheme]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((open) => !open);
        return;
      }
      if (e.altKey && !e.metaKey && !e.ctrlKey && e.key >= '1' && e.key <= '6') {
        const target = e.target as HTMLElement | null;
        const tag = target?.tagName?.toUpperCase();
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        e.preventDefault();
        const nextSection = SECTIONS[Number(e.key) - 1];
        if (nextSection) navigateAdmin({ bagian: nextSection });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigateAdmin]);

  const section = nav.bagian;
  const signOut = () => void clearUserLocalData().finally(() => supabase.auth.signOut());

  const mainContent = (
    <View style={styles.mainCol}>
      <View style={styles.sectionHeader}>
        <View style={styles.flex}>
          <AppText variant="h1" accessibilityRole="header">
            {copy.nav[section]}
          </AppText>
          <AppText variant="caption" tone="secondary">
            {copy.sectionSubtitle[section]}
          </AppText>
        </View>
        {!desktop && (
          <PressableScale
            onPress={() => setPaletteOpen(true)}
            accessibilityLabel={copy.palette.trigger}
            focusRadius={radius.control}
            scaleTo={0.97}
            style={[styles.palettePill, { backgroundColor: colors.surface, borderColor: colors.borderStrong }]}
          >
            <Icon icon={Command} color={colors.textSecondary} size={14} />
            <AppText variant="overline" tone="secondary">
              {copy.palette.shortcut}
            </AppText>
          </PressableScale>
        )}
      </View>

      {section === 'dasbor' && (
        <DashboardSection onNavigate={navigateAdmin} health={health.data} onRecheckHealth={health.reload} />
      )}
      {section === 'pengguna' && (
        <UsersSection initialUserId={nav.uid} initialQuery={nav.q} onNavigate={navigateAdmin} />
      )}
      {section === 'ai' && <AiSection onNavigate={navigateAdmin} />}
      {section === 'pesanan' && <OrdersSection onNavigate={navigateAdmin} />}
      {section === 'kurs' && (
        <FxSection autoSyncFxSeq={fxAutoSyncSeq} autoSyncAssetsSeq={assetAutoSyncSeq} />
      )}
      {section === 'broadcast' && <BroadcastSection initialEmail={nav.email} />}
    </View>
  );

  return (
    <Screen maxWidth={WIDTH}>
      {desktop ? (
        <View style={styles.desktopLayout}>
          <View style={styles.rail}>
            <Card padding="lg">
              <View style={styles.railHead}>
                <AppText variant="overline" tone="muted">
                  {copy.consoleTag}
                </AppText>
                <AppText variant="h2" accessibilityRole="header">
                  {copy.title}
                </AppText>
                <AppText variant="caption" tone="secondary" numberOfLines={1}>
                  {copy.signedInAs(email)}
                </AppText>
                <HealthPill data={health.data} loading={health.loading} onPress={health.reload} />
              </View>
            </Card>

            <Card padding="md">
              <View style={styles.railNav} accessibilityRole="radiogroup" accessibilityLabel={copy.title}>
                {SECTIONS.map((s) => {
                  const active = section === s;
                  const NavIcon = SECTION_ICONS[s];
                  return (
                    <PressableScale
                      key={s}
                      onPress={() => navigateAdmin({ bagian: s })}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: active }}
                      aria-checked={active}
                      accessibilityLabel={copy.nav[s]}
                      focusRadius={radius.inset}
                      scaleTo={0.98}
                      style={[
                        styles.railItem,
                        active && { backgroundColor: colors.accent },
                      ]}
                    >
                      <Icon icon={NavIcon} color={active ? colors.onAccent : colors.textSecondary} size={17} />
                      <AppText variant="bodyStrong" tone={active ? 'onAccent' : 'primary'} style={styles.flex} numberOfLines={1}>
                        {copy.nav[s]}
                      </AppText>
                    </PressableScale>
                  );
                })}
              </View>
            </Card>

            <Card padding="md">
              <View style={styles.railTools}>
                <PressableScale
                  onPress={() => setPaletteOpen(true)}
                  accessibilityLabel={copy.palette.trigger}
                  focusRadius={radius.inset}
                  scaleTo={0.98}
                  style={[styles.paletteButton, { backgroundColor: colors.surfaceSunken, borderColor: colors.border }]}
                >
                  <Icon icon={Command} color={colors.textSecondary} size={15} />
                  <AppText variant="caption" tone="primary" style={styles.flex}>
                    {copy.palette.trigger}
                  </AppText>
                  <View style={[styles.kbd, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}>
                    <AppText variant="overline" tone="secondary">
                      {copy.palette.shortcut}
                    </AppText>
                  </View>
                </PressableScale>

                <View style={styles.themeBlock}>
                  <AppText variant="overline" tone="muted">
                    {copy.theme.label}
                  </AppText>
                  <Tabs
                    items={[
                      { key: 'system', label: copy.theme.system },
                      { key: 'dark', label: copy.theme.dark },
                      { key: 'light', label: copy.theme.light },
                    ]}
                    value={mode}
                    onChange={changeTheme}
                    accessibilityLabel={copy.theme.label}
                  />
                </View>

                <View style={styles.railFooter}>
                  <Button label={copy.toApp} icon={ExternalLink} variant="secondary" size="sm" onPress={() => router.push('/')} />
                  <Button label={copy.signOut} icon={LogOut} variant="ghost" size="sm" onPress={signOut} />
                </View>
              </View>
            </Card>
          </View>

          {mainContent}
        </View>
      ) : (
        <View style={styles.mobileLayout}>
          <View style={styles.mobileHeader}>
            <View style={styles.flex}>
              <AppText variant="h2" accessibilityRole="header">
                {copy.title}
              </AppText>
              <AppText variant="caption" tone="secondary" numberOfLines={1}>
                {copy.signedInAs(email)}
              </AppText>
            </View>
            <View style={styles.mobileActions}>
              <PressableScale
                onPress={cycleTheme}
                accessibilityLabel={copy.theme.label}
                focusRadius={radius.control}
                scaleTo={0.96}
                style={[styles.iconBtn, { backgroundColor: colors.surface, borderColor: colors.borderStrong }]}
              >
                <Icon icon={scheme === 'dark' ? Moon : Sun} color={colors.text} size={16} />
              </PressableScale>
              <Button label={copy.signOut} icon={LogOut} variant="ghost" size="sm" onPress={signOut} />
            </View>
          </View>

          <HealthPill data={health.data} loading={health.loading} onPress={health.reload} />

          <View style={styles.nav} accessibilityRole="radiogroup" accessibilityLabel={copy.title}>
            {SECTIONS.map((s) => (
              <Chip key={s} label={copy.nav[s]} selected={section === s} onPress={() => navigateAdmin({ bagian: s })} />
            ))}
          </View>

          {mainContent}
        </View>
      )}

      <CommandPalette
        visible={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        activeSection={section}
        onNavigate={navigateAdmin}
        onCheckHealth={health.reload}
        onSyncFx={() => {
          navigateAdmin({ bagian: 'kurs' });
          setFxAutoSyncSeq((n) => n + 1);
        }}
        onSyncAssets={() => {
          navigateAdmin({ bagian: 'kurs' });
          setAssetAutoSyncSeq((n) => n + 1);
        }}
        onChangeTheme={changeTheme}
        onOpenApp={() => router.push('/')}
      />
    </Screen>
  );
}

function HealthPill({ data, loading, onPress }: { data: SystemHealthProbe | null; loading: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  let label = copy.health.checking;
  let dotColor = colors.textMuted;
  if (data) {
    if (data.status === 'ready') {
      label = copy.health.ready(data.rttMs);
      dotColor = colors.positive;
    } else if (data.status === 'live') {
      label = copy.health.live(data.rttMs);
      dotColor = colors.positive;
    } else if (data.status === 'degraded') {
      label = copy.health.degraded;
      dotColor = colors.warning;
    } else {
      label = copy.health.unreachable;
      dotColor = colors.negative;
    }
  }

  return (
    <PressableScale
      onPress={onPress}
      hitSlop={8}
      accessibilityLabel={`${copy.health.recheck}: ${label}`}
      focusRadius={radius.control}
      scaleTo={0.98}
      style={[styles.healthPill, { backgroundColor: colors.fill, borderColor: colors.border }]}
    >
      <View style={[styles.dot, { backgroundColor: dotColor }]} />
      <AppText variant="overline" tone="secondary" numeric numberOfLines={1} style={styles.flex}>
        {loading && !data ? copy.health.checking : label}
      </AppText>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  gate: { gap: space.md },
  desktopLayout: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.xl,
  },
  rail: {
    width: 248,
    gap: space.md,
  },
  railHead: {
    gap: space.xs,
  },
  railNav: {
    gap: space.xs,
  },
  railItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm + 2,
    minHeight: 44,
    paddingHorizontal: space.md,
    borderRadius: radius.inset,
  },
  railTools: {
    gap: space.md,
  },
  paletteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 44,
    paddingHorizontal: space.md,
    borderRadius: radius.inset,
    borderWidth: layout.hairline,
  },
  palettePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    minHeight: 42,
    paddingHorizontal: space.md,
    borderRadius: radius.control,
    borderWidth: layout.hairline,
  },
  kbd: {
    paddingHorizontal: space.xs + 2,
    paddingVertical: 2,
    borderRadius: radius.xs,
    borderWidth: layout.hairline,
  },
  themeBlock: {
    gap: space.xs + 2,
  },
  railFooter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.xs,
    alignItems: 'center',
  },
  mainCol: {
    flex: 1,
    minWidth: 0,
    gap: space.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
  },
  mobileLayout: {
    gap: space.md,
  },
  mobileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  mobileActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.control,
    borderWidth: layout.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  healthPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: space.xs + 2,
    minHeight: 34,
    paddingHorizontal: space.sm + 2,
    borderRadius: radius.control,
    borderWidth: layout.hairline,
    marginTop: space.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
  },
  flex: { flex: 1, minWidth: 0 },
  nav: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});

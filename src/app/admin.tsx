import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { LogOut } from 'lucide-react-native';
import { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/shell/Screen';
import { AppText, Button, Chip, EmptyState, Skeleton } from '@/components/ui';
import { isAdmin } from '@/data/remote/api';
import { copy } from '@/features/admin/copy';
import { DashboardSection } from '@/features/admin/Dashboard';
import { AiSection, OrdersSection } from '@/features/admin/Logs';
import { BroadcastSection, FxSection } from '@/features/admin/Ops';
import { useLoad } from '@/features/admin/parts';
import { UsersSection } from '@/features/admin/Users';
import { clearReturnTo, setReturnTo } from '@/lib/returnTo';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/state/session';
import { radius, space } from '@/theme/tokens';

const SECTIONS = ['dasbor', 'pengguna', 'ai', 'pesanan', 'kurs', 'broadcast'] as const;
type Section = (typeof SECTIONS)[number];
const WIDTH = 1080;

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
        <EmptyState kind="error" title={copy.gate.forbiddenTitle} message={copy.gate.forbiddenMessage(email)} actionLabel={copy.signOut} onAction={() => void supabase.auth.signOut()} />
      </Gate>
    );
  }
  return <Panel email={email} />;
}

function Gate({ loading, children }: { loading?: boolean; children?: React.ReactNode }) {
  return (
    <Screen maxWidth={WIDTH}>
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

function Panel({ email }: { email: string }) {
  const params = useLocalSearchParams<{ bagian?: string }>();
  const router = useRouter();
  const section: Section = SECTIONS.includes(params.bagian as Section) ? (params.bagian as Section) : 'dasbor';

  return (
    <Screen maxWidth={WIDTH}>
      <View style={styles.header}>
        <View style={styles.flex}>
          <AppText variant="h2" accessibilityRole="header">
            {copy.title}
          </AppText>
          <AppText variant="caption" tone="secondary" numberOfLines={1}>
            {copy.signedInAs(email)}
          </AppText>
        </View>
        <Button label={copy.signOut} icon={LogOut} variant="ghost" size="sm" onPress={() => void supabase.auth.signOut()} />
      </View>
      <View style={styles.nav} accessibilityRole="radiogroup" accessibilityLabel={copy.title}>
        {SECTIONS.map((s) => (
          <Chip key={s} label={copy.nav[s]} selected={section === s} onPress={() => router.setParams({ bagian: s })} />
        ))}
      </View>
      <AppText variant="h1" accessibilityRole="header">
        {copy.nav[section]}
      </AppText>
      {section === 'dasbor' && <DashboardSection />}
      {section === 'pengguna' && <UsersSection />}
      {section === 'ai' && <AiSection />}
      {section === 'pesanan' && <OrdersSection />}
      {section === 'kurs' && <FxSection />}
      {section === 'broadcast' && <BroadcastSection />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  gate: { gap: space.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  flex: { flex: 1, minWidth: 0, gap: space.xxs },
  nav: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});

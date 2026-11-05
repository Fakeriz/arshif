import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { Platform, StyleSheet } from 'react-native';

import { PaywallProvider } from '@/components/shell/Paywall';
import { BootScreen } from '@/components/shell/BootScreen';
import { BlurTargetArea, BlurTargetScope, ToastProvider } from '@/components/ui';
import { I18nProvider } from '@/i18n';
import { AppStoreProvider, useStore } from '@/state/AppStore';
import { SessionProvider, useSession } from '@/state/session';
import { loadHapticLevel } from '@/theme/motion';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';

SplashScreen.preventAutoHideAsync().catch(() => undefined);
void loadHapticLevel();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  // Splash tetap tampil sampai font siap → tidak ada layar kosong / lompatan font.
  if (!loaded && !error) return null;

  return (
    <I18nProvider>
      <ThemeProvider>
        <SessionProvider>
          <Shell />
        </SessionProvider>
      </ThemeProvider>
    </I18nProvider>
  );
}

function Shell() {
  const { colors, scheme } = useTheme();

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.bg).catch(() => undefined);
  }, [colors.bg]);

  return (
    <BlurTargetScope>
      <ToastProvider>
        <AppStoreProvider>
          <PaywallProvider>
            <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
            {/* Android: konten Stack = sumber blur untuk toast (di luar area) serta sheet/dialog (Modal). */}
            <BlurTargetArea style={styles.fill}>
              <Routes />
            </BlurTargetArea>
          </PaywallProvider>
        </AppStoreProvider>
      </ToastProvider>
    </BlurTargetScope>
  );
}

/**
 * Gerbang rute: belum login → masuk/verifikasi; login tapi belum setup → setup 3 langkah (FR-AUTH-2);
 * selain itu aplikasi. Splash ditahan sampai sesi dan data pertama siap supaya tidak ada kilasan layar.
 */
function Routes() {
  const { colors } = useTheme();
  const { session, ready } = useSession();
  const { state, reload } = useStore();
  const signedIn = !!session;
  const booting = !ready || (signedIn && (state.status === 'idle' || state.status === 'loading'));

  useEffect(() => {
    if (!booting) SplashScreen.hideAsync().catch(() => undefined);
  }, [booting]);

  // Native: splash masih tampil. Web tidak punya splash, jadi tampilkan layar muat (bukan layar kosong).
  if (booting) return Platform.OS === 'web' ? <BootScreen /> : null;
  if (signedIn && state.status === 'error') return <BootScreen onRetry={reload} />;

  const onboarded = signedIn && state.onboarded;
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: 'slide_from_right' }}>
      {/* Layar auth didaftarkan satu per satu (tanpa layout grup) supaya redirect guard jatuh ke "masuk"
          dan "/" tetap milik (tabs)/index. */}
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="(auth)/masuk" />
        <Stack.Screen name="(auth)/verifikasi" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && !onboarded}>
        <Stack.Screen name="setup" />
      </Stack.Protected>
      <Stack.Protected guard={onboarded}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="pengaturan" />
        <Stack.Screen name="coach" />
        <Stack.Screen name="tambah" />
        <Stack.Screen name="trx/[id]" />
        <Stack.Screen name="scan" />
        <Stack.Screen name="scan-review" />
        <Stack.Screen name="voice" />
        <Stack.Screen name="voice-review" />
        <Stack.Screen name="import" />
        <Stack.Screen name="import-review" />
      </Stack.Protected>
    </Stack>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });

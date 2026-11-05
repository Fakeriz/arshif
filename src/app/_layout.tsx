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

import { PaywallProvider } from '@/components/shell/Paywall';
import { ToastProvider } from '@/components/ui';
import { I18nProvider } from '@/i18n';
import { AppStoreProvider } from '@/state/AppStore';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const [loaded, error] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync().catch(() => undefined);
  }, [loaded, error]);

  // Splash tetap tampil sampai font siap → tidak ada layar kosong / lompatan font.
  if (!loaded && !error) return null;

  return (
    <I18nProvider>
      <ThemeProvider>
        <ThemedStack />
      </ThemeProvider>
    </I18nProvider>
  );
}

function ThemedStack() {
  const { colors, scheme } = useTheme();

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.bg).catch(() => undefined);
  }, [colors.bg]);

  return (
    <AppStoreProvider>
      <ToastProvider>
        <PaywallProvider>
          <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: 'slide_from_right' }} />
        </PaywallProvider>
      </ToastProvider>
    </AppStoreProvider>
  );
}

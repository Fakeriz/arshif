import { Stack } from 'expo-router';

import { useTheme } from '@/theme/ThemeProvider';

/** Grup layar sebelum login: masuk (email) lalu verifikasi kode 6 digit. */
export default function AuthLayout() {
  const { colors } = useTheme();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: 'slide_from_right' }} />;
}

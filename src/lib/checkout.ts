import { getLocales } from 'expo-localization';
import { Platform } from 'react-native';

import { WEB_CHECKOUT_REGIONS } from '@/config/public';

/**
 * Boleh menampilkan checkout web? Web: selalu. iOS/Android: hanya di wilayah yang diizinkan feature flag
 * (bawaan: tidak ada), sesuai aturan toko tentang link pembayaran eksternal.
 */
export function webCheckoutAllowed(os: string = Platform.OS, region: string | null = getLocales()[0]?.regionCode ?? null): boolean {
  if (os === 'web') return true;
  const allowed = os === 'ios' ? WEB_CHECKOUT_REGIONS.ios : os === 'android' ? WEB_CHECKOUT_REGIONS.android : [];
  return !!region && allowed.includes(region.toUpperCase());
}

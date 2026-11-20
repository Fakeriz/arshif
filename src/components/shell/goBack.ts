import type { useRouter } from 'expo-router';

/** Kembali; tanpa riwayat (halaman dibuka langsung/dimuat ulang di web) ke Beranda, bukan diam di tempat. */
export function goBack(router: ReturnType<typeof useRouter>) {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

let pending: Promise<ImagePicker.ImagePickerResult> | null = null;

/**
 * Buka layar lewat `go`. Untuk Scan di web, kamera dibuka DI SINI, di dalam ketukan pengguna: browser menolak
 * membuka kamera/berkas di luar ketukan, jadi layar Scan tidak bisa membukanya sendiri. Layar Scan lalu
 * memproses foto dari takePendingPick(). Android/iOS: layar Scan membuka pemindai sendiri saat dibuka.
 */
export function openCapture<H>(href: H, go: (href: H) => void): void {
  if (Platform.OS === 'web' && typeof href === 'string' && href.startsWith('/scan')) {
    // Dipanggil sinkron (tanpa await sebelumnya) supaya klik input berkas masih dihitung sebagai ketukan pengguna.
    pending = ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 });
  }
  go(href);
}

/** Foto yang sedang diambil dari ketukan terakhir (web), sekali pakai. */
export function takePendingPick(): Promise<ImagePicker.ImagePickerResult> | null {
  const p = pending;
  pending = null;
  return p;
}

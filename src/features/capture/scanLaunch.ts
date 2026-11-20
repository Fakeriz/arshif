import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

/** Cara memasukkan struk, dipilih di sheet Scan struk. */
export type ScanSource = 'camera' | 'gallery' | 'multi' | 'pdf';
export const SCAN_SOURCES: readonly ScanSource[] = ['camera', 'gallery', 'multi', 'pdf'];
export const MAX_MULTI = 3;

/** Struk terpilih: foto (dikompres sebelum unggah) atau PDF (diunggah apa adanya). */
export type PickedReceipt = { uri: string; width?: number; pdf?: boolean };

/** Buka kamera/galeri/pemilih PDF. Hasil: berkas terpilih (maks `limit` untuk multi), kosong bila dibatalkan. */
export function pickReceipts(source: ScanSource, limit = MAX_MULTI): Promise<PickedReceipt[]> {
  if (source === 'pdf') {
    return DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true }).then((r) =>
      r.canceled || !r.assets[0] ? [] : [{ uri: r.assets[0].uri, pdf: true }],
    );
  }
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1 };
  if (source === 'multi') Object.assign(opts, { allowsMultipleSelection: true, selectionLimit: limit });
  const launch = source === 'camera' ? ImagePicker.launchCameraAsync(opts) : ImagePicker.launchImageLibraryAsync(opts);
  // Web dan Android lama mengabaikan selectionLimit: kelebihannya dibuang di sini.
  const max = source === 'multi' ? limit : 1;
  return launch.then((r) => (r.canceled ? [] : r.assets.slice(0, max).map((a) => ({ uri: a.uri, width: a.width }))));
}

let pending: Promise<PickedReceipt[]> | null = null;

/**
 * Buka layar Scan untuk `source` lewat `go`. Di web pemilih dibuka DI SINI, di dalam ketukan pengguna: browser menolak
 * membuka kamera/berkas di luar ketukan, jadi layar Scan tidak bisa membukanya sendiri. Layar Scan lalu memproses
 * hasilnya dari takePendingPick(). Android/iOS: layar Scan membuka pemindai/pemilih sendiri saat dibuka.
 */
export function openScan(source: ScanSource, go: (href: `/scan?src=${ScanSource}`) => void, limit = MAX_MULTI): void {
  // Dipanggil sinkron (tanpa await sebelumnya) supaya klik input berkas masih dihitung sebagai ketukan pengguna.
  if (Platform.OS === 'web') pending = pickReceipts(source, limit);
  go(`/scan?src=${source}`);
}

/** Buka layar lewat `go`; layar Scan dibuka langsung dengan kamera (Foto ulang). */
export function openCapture<H>(href: H, go: (href: H) => void): void {
  if (Platform.OS === 'web' && typeof href === 'string' && href.startsWith('/scan')) pending = pickReceipts('camera');
  go(href);
}

/** Struk yang sedang dipilih dari ketukan terakhir (web), sekali pakai. */
export function takePendingPick(): Promise<PickedReceipt[]> | null {
  const p = pending;
  pending = null;
  return p;
}

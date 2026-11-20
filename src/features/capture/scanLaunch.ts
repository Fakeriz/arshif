import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import { afterSheetClose } from '@/components/shell/HeaderActions';

import { DocScannerNative } from '../../../modules/doc-scanner';

/** Cara memasukkan struk, dipilih di sheet Scan struk. */
export type ScanSource = 'camera' | 'gallery' | 'multi' | 'pdf';
export const SCAN_SOURCES: readonly ScanSource[] = ['camera', 'gallery', 'multi', 'pdf'];
export const MAX_MULTI = 3;

/** Struk terpilih: foto (dikompres sebelum unggah) atau PDF (diunggah apa adanya). */
export type PickedReceipt = { uri: string; width?: number; pdf?: boolean };

/** Izin kamera ditolak: layar Scan menawarkan galeri. */
export class CameraPermissionError extends Error {}

/**
 * Pemindai dokumen (FR-OCR-6), deteksi tepi + potong otomatis lewat modul native `doc-scanner`:
 * ML Kit di Android (butuh Google Play services), VisionKit di iOS. Tidak ada (web, Expo Go, build lama): kamera bawaan.
 */
function scannerReady(): boolean {
  if (Platform.OS === 'web' || !DocScannerNative) return false;
  try {
    return DocScannerNative.isAvailable();
  } catch {
    return false;
  }
}

/** Buka galeri/pemilih PDF/kamera bawaan. Hasil: berkas terpilih (maks `limit` untuk multi), kosong bila dibatalkan. */
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

/**
 * Ambil struk dari `source`. Kamera di Android/iOS: pemindai dokumen; tanpa pemindai atau bila gagal dibuka, kamera bawaan.
 * Web: pemilih dibuka sinkron (tanpa await sebelumnya) supaya klik input berkas masih dihitung sebagai ketukan pengguna.
 */
export async function acquireReceipts(source: ScanSource, limit = MAX_MULTI): Promise<PickedReceipt[]> {
  if (source === 'camera' && Platform.OS !== 'web') {
    if (scannerReady()) {
      try {
        const uri = await DocScannerNative!.scan(true);
        return uri ? [{ uri }] : [];
      } catch {
        // Pemindai gagal dibuka: kamera bawaan.
      }
    }
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new CameraPermissionError();
  }
  return pickReceipts(source, limit);
}

let pending: { source: ScanSource; files: Promise<PickedReceipt[]> } | null = null;

/**
 * Ambil struk DULU, baru buka layar Scan (hanya progres membaca) lewat `go`. Batal = tetap di layar asal.
 * Gagal (mis. izin kamera) tetap membuka layar Scan supaya pesannya tampil.
 */
export function startScan(source: ScanSource, go: (href: '/scan') => void, limit = MAX_MULTI): void {
  const files = acquireReceipts(source, limit);
  files.then(
    (f) => {
      if (!f.length) return;
      pending = { source, files };
      go('/scan');
    },
    () => {
      pending = { source, files };
      go('/scan');
    },
  );
}

/** startScan dari tombol di dalam sheet yang baru ditutup (lihat afterSheetClose). */
export function startScanFromSheet(source: ScanSource, go: (href: '/scan') => void, limit = MAX_MULTI): void {
  afterSheetClose(() => startScan(source, go, limit));
}

/**
 * Struk yang sudah diambil untuk layar Scan. null = layar dibuka langsung (mis. muat ulang halaman). Tidak dikosongkan saat
 * dibaca: StrictMode memanggil inisialisasi state dua kali; tiap startScan menggantinya.
 */
export function pendingPick(): typeof pending {
  return pending;
}

/** Dipanggil layar Scan setelah berkasnya diproses, supaya tidak diproses ulang. */
export function clearPendingPick(): void {
  pending = null;
}

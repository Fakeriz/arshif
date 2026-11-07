import { requireOptionalNativeModule } from 'expo';

type NativeDocScanner = {
  /** Android: Google Play services tersedia (ML Kit). iOS: perangkat mendukung VisionKit. */
  isAvailable(): boolean;
  /**
   * Buka pemindai (deteksi tepi, potong otomatis): ML Kit Document Scanner di Android, VisionKit
   * (VNDocumentCameraViewController) di iOS. Hasil: URI file JPEG halaman pertama, atau null bila dibatalkan.
   * `galleryAllowed` hanya berlaku di Android; pemindai iOS tidak punya impor galeri.
   * Gagal: kode ERR_NO_ACTIVITY, ERR_BUSY, ERR_UNAVAILABLE, ERR_LAUNCH, ERR_NO_PAGE.
   */
  scan(galleryAllowed: boolean): Promise<string | null>;
};

/** null di web, Expo Go, dan build lama tanpa modul ini. */
export const DocScannerNative = requireOptionalNativeModule<NativeDocScanner>('ArshifDocScanner');

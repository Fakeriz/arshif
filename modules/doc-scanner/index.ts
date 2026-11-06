import { requireOptionalNativeModule } from 'expo';

type NativeDocScanner = {
  /** Google Play services tersedia (dibutuhkan ML Kit Document Scanner). */
  isAvailable(): boolean;
  /**
   * Buka pemindai ML Kit (auto-crop, deteksi tepi). Hasil: URI file JPEG halaman pertama, atau null bila dibatalkan.
   * Gagal: kode ERR_NO_ACTIVITY, ERR_BUSY, ERR_UNAVAILABLE, ERR_LAUNCH, ERR_NO_PAGE.
   */
  scan(galleryAllowed: boolean): Promise<string | null>;
};

/** null di iOS, web, Expo Go, dan development build lama tanpa modul ini. */
export const DocScannerNative = requireOptionalNativeModule<NativeDocScanner>('ArshifDocScanner');

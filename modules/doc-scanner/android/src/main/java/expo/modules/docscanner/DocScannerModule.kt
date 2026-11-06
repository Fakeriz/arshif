package expo.modules.docscanner

import android.app.Activity
import com.google.android.gms.common.ConnectionResult
import com.google.android.gms.common.GoogleApiAvailability
import com.google.mlkit.vision.documentscanner.GmsDocumentScannerOptions
import com.google.mlkit.vision.documentscanner.GmsDocumentScanning
import com.google.mlkit.vision.documentscanner.GmsDocumentScanningResult
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * ML Kit Document Scanner (FR-OCR-6): pemindai bawaan Google Play services dengan deteksi tepi dan auto-crop.
 * Hanya mengambil gambar; isi struk tetap dibaca Gemini di server (FR-OCR-2).
 */
class DocScannerModule : Module() {
  private var pending: Promise? = null

  override fun definition() = ModuleDefinition {
    Name("ArshifDocScanner")

    Function("isAvailable") {
      val context = appContext.reactContext ?: return@Function false
      GoogleApiAvailability.getInstance().isGooglePlayServicesAvailable(context) == ConnectionResult.SUCCESS
    }

    AsyncFunction("scan") { galleryAllowed: Boolean, promise: Promise ->
      val activity = appContext.currentActivity
      if (activity == null) {
        promise.reject(CodedException("ERR_NO_ACTIVITY", "Activity tidak tersedia", null))
        return@AsyncFunction
      }
      if (pending != null) {
        promise.reject(CodedException("ERR_BUSY", "Pemindai sedang terbuka", null))
        return@AsyncFunction
      }
      val options = GmsDocumentScannerOptions.Builder()
        .setGalleryImportAllowed(galleryAllowed)
        .setPageLimit(1)
        .setResultFormats(GmsDocumentScannerOptions.RESULT_FORMAT_JPEG)
        .setScannerMode(GmsDocumentScannerOptions.SCANNER_MODE_FULL)
        .build()
      pending = promise
      GmsDocumentScanning.getClient(options)
        .getStartScanIntent(activity)
        .addOnSuccessListener { sender ->
          try {
            activity.startIntentSenderForResult(sender, REQUEST_CODE, null, 0, 0, 0)
          } catch (e: Exception) {
            settle()?.reject(CodedException("ERR_LAUNCH", e.message ?: "Gagal membuka pemindai", e))
          }
        }
        .addOnFailureListener { e ->
          settle()?.reject(CodedException("ERR_UNAVAILABLE", e.message ?: "Pemindai tidak tersedia", e))
        }
    }

    OnActivityResult { _, payload ->
      if (payload.requestCode != REQUEST_CODE) return@OnActivityResult
      val promise = settle() ?: return@OnActivityResult
      if (payload.resultCode != Activity.RESULT_OK) {
        promise.resolve(null)
        return@OnActivityResult
      }
      val uri = GmsDocumentScanningResult.fromActivityResultIntent(payload.data)?.pages?.firstOrNull()?.imageUri?.toString()
      if (uri == null) promise.reject(CodedException("ERR_NO_PAGE", "Tidak ada halaman hasil pindai", null))
      else promise.resolve(uri)
    }
  }

  private fun settle(): Promise? {
    val p = pending
    pending = null
    return p
  }

  companion object {
    private const val REQUEST_CODE = 0x5ca1
  }
}

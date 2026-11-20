import ExpoModulesCore
import UIKit
import VisionKit

/**
 * Pemindai dokumen iOS (FR-OCR-6): VNDocumentCameraViewController bawaan Apple, padanan ML Kit Document Scanner di
 * Android (deteksi tepi, potong otomatis, koreksi perspektif). API JS sama dengan Android: isAvailable() dan
 * scan(galleryAllowed) -> URI file JPEG halaman pertama, atau nil bila dibatalkan. Isi struk tetap dibaca Gemini.
 * VisionKit tidak punya impor galeri, jadi `galleryAllowed` diabaikan; layar scan menawarkan galeri setelah batal.
 */
public class DocScannerModule: Module {
  private var pending: Promise?
  private var delegate: ScanDelegate?

  public func definition() -> ModuleDefinition {
    Name("ArshifDocScanner")

    Function("isAvailable") { () -> Bool in
      VNDocumentCameraViewController.isSupported
    }

    AsyncFunction("scan") { (_: Bool, promise: Promise) in
      if self.pending != nil {
        promise.reject("ERR_BUSY", "Pemindai sedang terbuka")
        return
      }
      guard VNDocumentCameraViewController.isSupported else {
        promise.reject("ERR_UNAVAILABLE", "Pemindai dokumen tidak didukung perangkat ini")
        return
      }
      guard let presenter = self.appContext?.utilities?.currentViewController() else {
        promise.reject("ERR_NO_ACTIVITY", "Layar aplikasi tidak tersedia")
        return
      }
      let controller = VNDocumentCameraViewController()
      let delegate = ScanDelegate { [weak self] result in
        controller.dismiss(animated: true)
        guard let self = self, let promise = self.pending else { return }
        self.pending = nil
        self.delegate = nil
        switch result {
        case .cancelled:
          promise.resolve(nil)
        case .failed(let message):
          promise.reject("ERR_LAUNCH", message)
        case .scanned(let scan):
          guard scan.pageCount > 0 else {
            promise.reject("ERR_NO_PAGE", "Tidak ada halaman hasil pindai")
            return
          }
          let image = scan.imageOfPage(at: 0)
          guard let data = image.jpegData(compressionQuality: 0.9) else {
            promise.reject("ERR_NO_PAGE", "Gagal menyimpan hasil pindai")
            return
          }
          let url = FileManager.default.temporaryDirectory.appendingPathComponent("arshif-scan-\(UUID().uuidString).jpg")
          do {
            try data.write(to: url)
            promise.resolve(url.absoluteString)
          } catch {
            promise.reject("ERR_NO_PAGE", "Gagal menyimpan hasil pindai: \(error.localizedDescription)")
          }
        }
      }
      self.pending = promise
      self.delegate = delegate
      controller.delegate = delegate
      presenter.present(controller, animated: true)
    }.runOnQueue(.main)
  }
}

private enum ScanResult {
  case scanned(VNDocumentCameraScan)
  case cancelled
  case failed(String)
}

/** VisionKit memegang delegate secara weak: modul menyimpan referensinya sampai hasil diterima. */
private final class ScanDelegate: NSObject, VNDocumentCameraViewControllerDelegate {
  private let done: (ScanResult) -> Void

  init(done: @escaping (ScanResult) -> Void) {
    self.done = done
  }

  func documentCameraViewController(_ controller: VNDocumentCameraViewController, didFinishWith scan: VNDocumentCameraScan) {
    done(.scanned(scan))
  }

  func documentCameraViewControllerDidCancel(_ controller: VNDocumentCameraViewController) {
    done(.cancelled)
  }

  func documentCameraViewController(_ controller: VNDocumentCameraViewController, didFailWithError error: Error) {
    done(.failed(error.localizedDescription))
  }
}

import ExpoModulesCore
import Foundation

/// Opt-in Expo Module bridge to `libarshif_core.a` (C-ABI declared in `include/arshif_core.h`).
/// Kept inside `rust/arshif-core/expo-module/` so default EAS builds without Rust/NDK keep working;
/// link `libarshif_core.a` and copy into `modules/arshif-rust-core` to activate Tier 1 native FFI.
public final class ArshifRustCoreModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ArshifRustCore")

    Function("version") { () -> Int in
      return Int(arshif_version())
    }

    Function("similarity") { (a: String, b: String) -> Double in
      let aBytes = Array(a.utf8)
      let bBytes = Array(b.utf8)
      return aBytes.withUnsafeBufferPointer { aBuf in
        bBytes.withUnsafeBufferPointer { bBuf in
          arshif_similarity(aBuf.baseAddress, aBuf.count, bBuf.baseAddress, bBuf.count)
        }
      }
    }

    Function("cyrb53Hash") { (input: String) -> String in
      let bytes = Array(input.utf8)
      var out = [UInt8](repeating: 0, count: 16)
      let rc = bytes.withUnsafeBufferPointer { buf in
        out.withUnsafeMutableBufferPointer { outBuf in
          arshif_cyrb53_hash(buf.baseAddress, buf.count, outBuf.baseAddress)
        }
      }
      if rc != 0 { return "" }
      return String(bytes: out, encoding: .utf8) ?? ""
    }
  }
}

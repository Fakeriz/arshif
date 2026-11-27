package app.arshif.rustcore

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Opt-in Expo Module bridge to `libarshif_core.so` (JNI/C-ABI from `rust/arshif-core/src/ffi.rs`).
 * Kept inside `rust/arshif-core/expo-module/` so EAS builds without cargo-ndk stay green.
 */
class ArshifRustCoreModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ArshifRustCore")

    Function("version") {
      nativeVersion()
    }

    Function("similarity") { a: String, b: String ->
      nativeSimilarity(a, b)
    }

    Function("cyrb53Hash") { input: String ->
      nativeCyrb53Hash(input)
    }
  }

  private external fun nativeVersion(): Int
  private external fun nativeSimilarity(a: String, b: String): Double
  private external fun nativeCyrb53Hash(input: String): String

  companion object {
    init {
      System.loadLibrary("arshif_core")
    }
  }
}

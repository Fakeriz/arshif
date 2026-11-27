# ArshifRustCore Opt-In Native Expo Module

This folder holds the optional Tier 1 native Expo Module scaffold wrapping `rust/arshif-core`'s C-ABI (`include/arshif_core.h`).

It is intentionally kept outside the top-level `modules/` directory so standard `eas build` and Expo Go workflows do not fail when Rust cross-compilation toolchains (`cargo-ndk` / iOS targets) are not installed.

## Activating Native Tier 1 FFI

1. Build static/shared libraries:
   - iOS: `cargo build --manifest-path rust/arshif-core/Cargo.toml --release --target aarch64-apple-ios`
   - Android: `cargo ndk -t arm64-v8a -t armeabi-v7a -o jniLibs build --manifest-path rust/arshif-core/Cargo.toml --release`
2. Copy this folder into `modules/arshif-rust-core` with the compiled libraries and podspec/CMakeLists bindings.
3. `src/lib/rust/index.ts` automatically detects `ArshifRustCore` via `globalThis.expo?.modules?.ArshifRustCore` or `TurboModuleRegistry.get('ArshifRustCore')` and promotes `activeBackend` to `'native'`.

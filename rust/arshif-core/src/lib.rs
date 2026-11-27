pub mod crypto;
pub mod dedupe;
pub mod money;
pub mod smartlog;

#[cfg(target_arch = "wasm32")]
pub mod wasm;

#[cfg(not(target_arch = "wasm32"))]
pub mod ffi;

/// ABI version reported by both WASM and native C-FFI entrypoints.
pub const ABI_VERSION: u32 = 1;

/// Shared status codes across WASM and C-FFI exports.
pub mod status {
    pub const OK: u32 = 0;
    pub const ERR_NOT_BACKUP: u32 = 1;
    pub const ERR_VERSION: u32 = 2;
    pub const ERR_BAD_KEY: u32 = 3;
    pub const ERR_CORRUPT: u32 = 4;
    pub const ERR_INVALID_INPUT: u32 = 10;
    pub const ERR_OVERFLOW: u32 = 11;
    pub const ERR_OUT_OF_SAFE_RANGE: u32 = 12;
    pub const ERR_ZERO_DENOMINATOR: u32 = 13;
    pub const ERR_UNSAFE_MINOR: u32 = 14;
}

pub(crate) fn alloc_aligned(len: usize) -> *mut u8 {
    if len == 0 {
        return 8usize as *mut u8;
    }
    let Ok(layout) = std::alloc::Layout::from_size_align(len, 8) else {
        return std::ptr::null_mut();
    };
    // SAFETY: `len > 0` and alignment 8 is a valid power of two.
    unsafe { std::alloc::alloc(layout) }
}

/// # Safety
/// `ptr` must have been returned by `alloc_aligned(len)` and not yet freed.
pub(crate) unsafe fn dealloc_aligned(ptr: *mut u8, len: usize) {
    if len == 0 || ptr.is_null() {
        return;
    }
    if let Ok(layout) = std::alloc::Layout::from_size_align(len, 8) {
        std::alloc::dealloc(ptr, layout);
    }
}

pub(crate) fn copy_to_alloc(data: &[u8]) -> (*mut u8, usize) {
    let len = data.len();
    let ptr = alloc_aligned(len);
    if !ptr.is_null() && len > 0 {
        // SAFETY: `ptr` is freshly allocated with at least `len` bytes and does not overlap `data`.
        unsafe {
            std::ptr::copy_nonoverlapping(data.as_ptr(), ptr, len);
        }
    }
    (ptr, len)
}

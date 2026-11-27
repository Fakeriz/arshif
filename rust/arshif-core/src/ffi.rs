use std::slice;

use crate::{
    alloc_aligned, copy_to_alloc,
    crypto::{self, FIXED_PREFIX_LEN},
    dealloc_aligned, dedupe,
    money::{self, ConvertError, CrossRateError, RateError},
    smartlog, status, ABI_VERSION,
};

unsafe fn read_bytes<'a>(ptr: *const u8, len: usize) -> &'a [u8] {
    if len == 0 || ptr.is_null() {
        &[]
    } else {
        slice::from_raw_parts(ptr, len)
    }
}

unsafe fn read_str<'a>(ptr: *const u8, len: usize) -> Option<&'a str> {
    std::str::from_utf8(read_bytes(ptr, len)).ok()
}

unsafe fn write_out_buf(data: &[u8], out_ptr: *mut *mut u8, out_len: *mut usize) -> u32 {
    if out_ptr.is_null() || out_len.is_null() {
        return status::ERR_INVALID_INPUT;
    }
    let (ptr, len) = copy_to_alloc(data);
    if len > 0 && ptr.is_null() {
        return status::ERR_OVERFLOW;
    }
    *out_ptr = ptr;
    *out_len = len;
    status::OK
}

#[no_mangle]
pub extern "C" fn arshif_version() -> u32 {
    ABI_VERSION
}

#[no_mangle]
pub extern "C" fn arshif_alloc(len: usize) -> *mut u8 {
    alloc_aligned(len)
}

/// # Safety
/// `ptr` must have been allocated by `arshif_alloc` or returned by an `arshif_*` out buffer.
#[no_mangle]
pub unsafe extern "C" fn arshif_dealloc(ptr: *mut u8, len: usize) {
    dealloc_aligned(ptr, len);
}

/// # Safety
/// Caller must pass valid buffers and writable `out_ptr`/`out_len`, and free the result via `arshif_dealloc`.
#[no_mangle]
pub unsafe extern "C" fn arshif_seal_backup(
    key_ptr: *const u8,
    key_len: usize,
    header_ptr: *const u8,
    header_len: usize,
    nonce_ptr: *const u8,
    nonce_len: usize,
    plain_ptr: *const u8,
    plain_len: usize,
    out_ptr: *mut *mut u8,
    out_len: *mut usize,
) -> u32 {
    match crypto::seal_backup(
        read_bytes(key_ptr, key_len),
        read_bytes(header_ptr, header_len),
        read_bytes(nonce_ptr, nonce_len),
        read_bytes(plain_ptr, plain_len),
    ) {
        Ok(sealed) => write_out_buf(&sealed, out_ptr, out_len),
        Err(code) => code.as_u32(),
    }
}

/// # Safety
/// Caller must pass a valid file buffer and writable `out_offset`/`out_len`.
#[no_mangle]
pub unsafe extern "C" fn arshif_read_backup_header(
    file_ptr: *const u8,
    file_len: usize,
    out_offset: *mut usize,
    out_len: *mut usize,
) -> u32 {
    if out_offset.is_null() || out_len.is_null() {
        return status::ERR_INVALID_INPUT;
    }
    match crypto::read_backup_header(read_bytes(file_ptr, file_len)) {
        Ok(hdr) => {
            *out_offset = FIXED_PREFIX_LEN;
            *out_len = hdr.len();
            status::OK
        }
        Err(code) => code.as_u32(),
    }
}

/// # Safety
/// Caller must pass valid buffers and writable `out_ptr`/`out_len`, and free the result via `arshif_dealloc`.
#[no_mangle]
pub unsafe extern "C" fn arshif_open_backup(
    key_ptr: *const u8,
    key_len: usize,
    file_ptr: *const u8,
    file_len: usize,
    out_ptr: *mut *mut u8,
    out_len: *mut usize,
) -> u32 {
    match crypto::open_backup(read_bytes(key_ptr, key_len), read_bytes(file_ptr, file_len)) {
        Ok((_hdr, plaintext)) => write_out_buf(&plaintext, out_ptr, out_len),
        Err(code) => code.as_u32(),
    }
}

/// # Safety
/// Caller must pass a valid key buffer and writable `out_ptr`/`out_len`, and free via `arshif_dealloc`.
#[no_mangle]
pub unsafe extern "C" fn arshif_format_recovery_key(
    key_ptr: *const u8,
    key_len: usize,
    out_ptr: *mut *mut u8,
    out_len: *mut usize,
) -> u32 {
    let formatted = crypto::format_recovery_key(read_bytes(key_ptr, key_len));
    write_out_buf(formatted.as_bytes(), out_ptr, out_len)
}

/// # Safety
/// `out_key_32` must point to 32 writable bytes.
#[no_mangle]
pub unsafe extern "C" fn arshif_parse_recovery_key(
    str_ptr: *const u8,
    str_len: usize,
    out_key_32: *mut u8,
) -> u32 {
    if out_key_32.is_null() {
        return status::ERR_INVALID_INPUT;
    }
    let Some(s) = read_str(str_ptr, str_len) else {
        return status::ERR_INVALID_INPUT;
    };
    match crypto::parse_recovery_key(s) {
        Some(key) => {
            std::ptr::copy_nonoverlapping(key.as_ptr(), out_key_32, key.len());
            status::OK
        }
        None => status::ERR_INVALID_INPUT,
    }
}

/// # Safety
/// Caller must pass valid UTF-8 and writable `out_ptr`/`out_len`, and free via `arshif_dealloc`.
#[no_mangle]
pub unsafe extern "C" fn arshif_rate_to_scaled_str(
    rate_ptr: *const u8,
    rate_len: usize,
    out_ptr: *mut *mut u8,
    out_len: *mut usize,
) -> u32 {
    let Some(rate) = read_str(rate_ptr, rate_len) else {
        return status::ERR_INVALID_INPUT;
    };
    match money::rate_to_scaled(rate) {
        Ok(scaled) => {
            let s = scaled.to_string();
            write_out_buf(s.as_bytes(), out_ptr, out_len)
        }
        Err(RateError::Invalid) => status::ERR_INVALID_INPUT,
        Err(RateError::Overflow) => status::ERR_OVERFLOW,
    }
}

/// # Safety
/// Caller must pass valid UTF-8 slices and writable `out_ptr`/`out_len`, and free via `arshif_dealloc`.
#[no_mangle]
pub unsafe extern "C" fn arshif_cross_rate(
    from_ptr: *const u8,
    from_len: usize,
    to_ptr: *const u8,
    to_len: usize,
    out_ptr: *mut *mut u8,
    out_len: *mut usize,
) -> u32 {
    let (Some(from_rate), Some(to_rate)) = (read_str(from_ptr, from_len), read_str(to_ptr, to_len))
    else {
        return status::ERR_INVALID_INPUT;
    };
    match money::cross_rate_from_rates(from_rate, to_rate) {
        Ok(res) => write_out_buf(res.as_bytes(), out_ptr, out_len),
        Err(CrossRateError::InvalidRate) => status::ERR_INVALID_INPUT,
        Err(CrossRateError::ZeroDenominator) => status::ERR_ZERO_DENOMINATOR,
        Err(CrossRateError::Overflow) => status::ERR_OVERFLOW,
    }
}

/// # Safety
/// `out_i64` must be a valid writable pointer.
#[no_mangle]
pub unsafe extern "C" fn arshif_convert_minor(
    minor: i64,
    from_exp: u32,
    to_exp: u32,
    rate_ptr: *const u8,
    rate_len: usize,
    out_i64: *mut i64,
) -> u32 {
    if out_i64.is_null() {
        return status::ERR_INVALID_INPUT;
    }
    let Some(rate) = read_str(rate_ptr, rate_len) else {
        return status::ERR_INVALID_INPUT;
    };
    match money::convert_minor(minor, from_exp, to_exp, rate) {
        Ok(out) => {
            *out_i64 = out;
            status::OK
        }
        Err(ConvertError::UnsafeMinor) => status::ERR_UNSAFE_MINOR,
        Err(ConvertError::InvalidRate) => status::ERR_INVALID_INPUT,
        Err(ConvertError::Overflow) => status::ERR_OVERFLOW,
        Err(ConvertError::OutOfSafeRange) => status::ERR_OUT_OF_SAFE_RANGE,
    }
}

/// # Safety
/// `out_i64` must be a valid writable pointer.
#[no_mangle]
pub unsafe extern "C" fn arshif_convert_major_fixed10(
    fixed10_ptr: *const u8,
    fixed10_len: usize,
    is_negative: u32,
    to_exp: u32,
    rate_ptr: *const u8,
    rate_len: usize,
    out_i64: *mut i64,
) -> u32 {
    if out_i64.is_null() {
        return status::ERR_INVALID_INPUT;
    }
    let (Some(fixed10), Some(rate)) = (
        read_str(fixed10_ptr, fixed10_len),
        read_str(rate_ptr, rate_len),
    ) else {
        return status::ERR_INVALID_INPUT;
    };
    match money::convert_major_fixed10(fixed10, is_negative != 0, to_exp, rate) {
        Ok(out) => {
            *out_i64 = out;
            status::OK
        }
        Err(ConvertError::UnsafeMinor) => status::ERR_UNSAFE_MINOR,
        Err(ConvertError::InvalidRate) => status::ERR_INVALID_INPUT,
        Err(ConvertError::Overflow) => status::ERR_OVERFLOW,
        Err(ConvertError::OutOfSafeRange) => status::ERR_OUT_OF_SAFE_RANGE,
    }
}

/// # Safety
/// `out_i64` must be a valid writable pointer.
#[no_mangle]
pub unsafe extern "C" fn arshif_parse_amount_input(
    text_ptr: *const u8,
    text_len: usize,
    exponent: u32,
    out_i64: *mut i64,
) -> u32 {
    if out_i64.is_null() {
        return status::ERR_INVALID_INPUT;
    }
    let Some(text) = read_str(text_ptr, text_len) else {
        return status::ERR_INVALID_INPUT;
    };
    match money::parse_amount_input(text, exponent) {
        Some(v) => {
            *out_i64 = v;
            status::OK
        }
        None => status::ERR_INVALID_INPUT,
    }
}

/// # Safety
/// `a_ptr` and `b_ptr` must reference readable UTF-8 slices.
#[no_mangle]
pub unsafe extern "C" fn arshif_similarity(
    a_ptr: *const u8,
    a_len: usize,
    b_ptr: *const u8,
    b_len: usize,
) -> f64 {
    let (Some(a), Some(b)) = (read_str(a_ptr, a_len), read_str(b_ptr, b_len)) else {
        return 0.0;
    };
    dedupe::similarity(a, b)
}

/// # Safety
/// `deltas_ptr` must reference `deltas_len` readable `i64` values, and out pointers must be writable.
#[no_mangle]
pub unsafe extern "C" fn arshif_reconcile_balances(
    base_balance: i64,
    closing_balance: i64,
    deltas_ptr: *const i64,
    deltas_len: usize,
    out_projected: *mut i64,
    out_diff: *mut i64,
) -> u32 {
    if out_projected.is_null() || out_diff.is_null() {
        return status::ERR_INVALID_INPUT;
    }
    let deltas = if deltas_len == 0 || deltas_ptr.is_null() {
        &[]
    } else {
        slice::from_raw_parts(deltas_ptr, deltas_len)
    };
    match dedupe::reconcile_balances(base_balance, closing_balance, deltas) {
        Some(res) => {
            *out_projected = res.projected_balance;
            *out_diff = res.difference;
            status::OK
        }
        None => status::ERR_OUT_OF_SAFE_RANGE,
    }
}

/// # Safety
/// `out_i64` must be a valid writable pointer.
#[no_mangle]
pub unsafe extern "C" fn arshif_parse_smartlog_amount(
    raw_ptr: *const u8,
    raw_len: usize,
    exponent: u32,
    out_i64: *mut i64,
) -> u32 {
    if out_i64.is_null() {
        return status::ERR_INVALID_INPUT;
    }
    let Some(raw) = read_str(raw_ptr, raw_len) else {
        return status::ERR_INVALID_INPUT;
    };
    match smartlog::parse_smartlog_amount(raw, exponent) {
        Some(v) => {
            *out_i64 = v;
            status::OK
        }
        None => status::ERR_INVALID_INPUT,
    }
}

/// # Safety
/// `out_hex_16` must point to 16 writable bytes.
#[no_mangle]
pub unsafe extern "C" fn arshif_cyrb53_hash(
    str_ptr: *const u8,
    str_len: usize,
    out_hex_16: *mut u8,
) -> u32 {
    if out_hex_16.is_null() {
        return status::ERR_INVALID_INPUT;
    }
    let Some(s) = read_str(str_ptr, str_len) else {
        return status::ERR_INVALID_INPUT;
    };
    let hex = smartlog::cyrb53_hash(s);
    std::ptr::copy_nonoverlapping(hex.as_ptr(), out_hex_16, hex.len());
    status::OK
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn c_abi_roundtrip_smoke() {
        assert_eq!(arshif_version(), ABI_VERSION);
        let key = [0x2Au8; 32];
        let nonce = [0x07u8; 12];
        let header = br#"{"createdAt":"2026-11-27T00:00:00.000Z","receipts":false}"#;
        let plain = b"arshif-ffi-payload";

        unsafe {
            let mut sealed_ptr: *mut u8 = std::ptr::null_mut();
            let mut sealed_len: usize = 0;
            let rc = arshif_seal_backup(
                key.as_ptr(),
                key.len(),
                header.as_ptr(),
                header.len(),
                nonce.as_ptr(),
                nonce.len(),
                plain.as_ptr(),
                plain.len(),
                &mut sealed_ptr,
                &mut sealed_len,
            );
            assert_eq!(rc, status::OK);

            let mut hdr_off = 0usize;
            let mut hdr_len = 0usize;
            assert_eq!(
                arshif_read_backup_header(sealed_ptr, sealed_len, &mut hdr_off, &mut hdr_len),
                status::OK
            );
            assert_eq!(hdr_off, FIXED_PREFIX_LEN);
            assert_eq!(hdr_len, header.len());

            let mut opened_ptr: *mut u8 = std::ptr::null_mut();
            let mut opened_len: usize = 0;
            assert_eq!(
                arshif_open_backup(
                    key.as_ptr(),
                    key.len(),
                    sealed_ptr,
                    sealed_len,
                    &mut opened_ptr,
                    &mut opened_len
                ),
                status::OK
            );
            assert_eq!(slice::from_raw_parts(opened_ptr, opened_len), plain);

            arshif_dealloc(sealed_ptr, sealed_len);
            arshif_dealloc(opened_ptr, opened_len);

            let mut out_minor = 0i64;
            let rate = b"15873.45";
            assert_eq!(
                arshif_convert_minor(1000, 2, 0, rate.as_ptr(), rate.len(), &mut out_minor),
                status::OK
            );
            assert_eq!(out_minor, 158_735);

            let mut proj = 0i64;
            let mut diff = 0i64;
            let deltas = [-45_000i64, 5_000i64];
            assert_eq!(
                arshif_reconcile_balances(
                    1_000_000,
                    960_000,
                    deltas.as_ptr(),
                    deltas.len(),
                    &mut proj,
                    &mut diff
                ),
                status::OK
            );
            assert_eq!((proj, diff), (960_000, 0));

            let mut hex = [0u8; 16];
            let msg = b"com.bca|hello";
            assert_eq!(arshif_cyrb53_hash(msg.as_ptr(), msg.len(), hex.as_mut_ptr()), status::OK);
            assert_eq!(hex.len(), 16);
        }
    }
}

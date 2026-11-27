use std::slice;

use crate::{
    alloc_aligned, copy_to_alloc,
    crypto::{self, FIXED_PREFIX_LEN},
    dealloc_aligned, dedupe,
    money::{self, ConvertError, CrossRateError, RateError, MAX_SAFE_INT},
    smartlog, status, ABI_VERSION,
};

unsafe fn read_bytes<'a>(ptr: *const u8, len: usize) -> &'a [u8] {
    if len == 0 {
        &[]
    } else {
        slice::from_raw_parts(ptr, len)
    }
}

unsafe fn read_str<'a>(ptr: *const u8, len: usize) -> Option<&'a str> {
    std::str::from_utf8(read_bytes(ptr, len)).ok()
}

unsafe fn write_out_buf(data: &[u8], out_ptr: *mut u32, out_len: *mut u32) -> u32 {
    let (ptr, len) = copy_to_alloc(data);
    if len > 0 && ptr.is_null() {
        return status::ERR_OVERFLOW;
    }
    *out_ptr = ptr as usize as u32;
    *out_len = len as u32;
    status::OK
}

fn f64_to_safe_i64(v: f64) -> Option<i64> {
    if !v.is_finite() || v.fract() != 0.0 || v.abs() > (MAX_SAFE_INT as f64) {
        return None;
    }
    Some(v as i64)
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
/// `ptr` must have been allocated by `arshif_alloc(len)` and not already freed.
#[no_mangle]
pub unsafe extern "C" fn arshif_dealloc(ptr: *mut u8, len: usize) {
    dealloc_aligned(ptr, len);
}

/// # Safety
/// All pointer/length pairs must reference valid readable memory in linear memory,
/// and `out_ptr`/`out_len` must be valid writable pointers.
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
    out_ptr: *mut u32,
    out_len: *mut u32,
) -> u32 {
    let key = read_bytes(key_ptr, key_len);
    let header = read_bytes(header_ptr, header_len);
    let nonce = read_bytes(nonce_ptr, nonce_len);
    let plain = read_bytes(plain_ptr, plain_len);
    match crypto::seal_backup(key, header, nonce, plain) {
        Ok(sealed) => write_out_buf(&sealed, out_ptr, out_len),
        Err(code) => code.as_u32(),
    }
}

/// # Safety
/// `file_ptr`..`file_ptr+file_len` must be readable, and `out_offset`/`out_len` writable.
#[no_mangle]
pub unsafe extern "C" fn arshif_read_backup_header(
    file_ptr: *const u8,
    file_len: usize,
    out_offset: *mut u32,
    out_len: *mut u32,
) -> u32 {
    let file = read_bytes(file_ptr, file_len);
    match crypto::read_backup_header(file) {
        Ok(hdr) => {
            *out_offset = FIXED_PREFIX_LEN as u32;
            *out_len = hdr.len() as u32;
            status::OK
        }
        Err(code) => code.as_u32(),
    }
}

/// # Safety
/// Pointer/length pairs must be valid readable slices and `out_ptr`/`out_len` writable.
#[no_mangle]
pub unsafe extern "C" fn arshif_open_backup(
    key_ptr: *const u8,
    key_len: usize,
    file_ptr: *const u8,
    file_len: usize,
    out_ptr: *mut u32,
    out_len: *mut u32,
) -> u32 {
    let key = read_bytes(key_ptr, key_len);
    let file = read_bytes(file_ptr, file_len);
    match crypto::open_backup(key, file) {
        Ok((_hdr, plaintext)) => write_out_buf(&plaintext, out_ptr, out_len),
        Err(code) => code.as_u32(),
    }
}

/// # Safety
/// `key_ptr`..`key_ptr+key_len` must be readable and `out_ptr`/`out_len` writable.
#[no_mangle]
pub unsafe extern "C" fn arshif_format_recovery_key(
    key_ptr: *const u8,
    key_len: usize,
    out_ptr: *mut u32,
    out_len: *mut u32,
) -> u32 {
    let key = read_bytes(key_ptr, key_len);
    let formatted = crypto::format_recovery_key(key);
    write_out_buf(formatted.as_bytes(), out_ptr, out_len)
}

/// # Safety
/// `str_ptr`..`str_ptr+str_len` must be readable and `out_key_32` must point to 32 writable bytes.
#[no_mangle]
pub unsafe extern "C" fn arshif_parse_recovery_key(
    str_ptr: *const u8,
    str_len: usize,
    out_key_32: *mut u8,
) -> u32 {
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
/// `rate_ptr`..`rate_ptr+rate_len` must be readable and `out_ptr`/`out_len` writable.
#[no_mangle]
pub unsafe extern "C" fn arshif_rate_to_scaled_str(
    rate_ptr: *const u8,
    rate_len: usize,
    out_ptr: *mut u32,
    out_len: *mut u32,
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
/// Input slices must be valid UTF-8 and `out_ptr`/`out_len` writable.
#[no_mangle]
pub unsafe extern "C" fn arshif_cross_rate(
    from_ptr: *const u8,
    from_len: usize,
    to_ptr: *const u8,
    to_len: usize,
    out_ptr: *mut u32,
    out_len: *mut u32,
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
/// `rate_ptr`..`rate_ptr+rate_len` must be readable and `out_f64` writable.
#[no_mangle]
pub unsafe extern "C" fn arshif_convert_minor(
    minor_f64: f64,
    from_exp: u32,
    to_exp: u32,
    rate_ptr: *const u8,
    rate_len: usize,
    out_f64: *mut f64,
) -> u32 {
    let Some(minor) = f64_to_safe_i64(minor_f64) else {
        return status::ERR_UNSAFE_MINOR;
    };
    let Some(rate) = read_str(rate_ptr, rate_len) else {
        return status::ERR_INVALID_INPUT;
    };
    match money::convert_minor(minor, from_exp, to_exp, rate) {
        Ok(out) => {
            *out_f64 = out as f64;
            status::OK
        }
        Err(ConvertError::UnsafeMinor) => status::ERR_UNSAFE_MINOR,
        Err(ConvertError::InvalidRate) => status::ERR_INVALID_INPUT,
        Err(ConvertError::Overflow) => status::ERR_OVERFLOW,
        Err(ConvertError::OutOfSafeRange) => status::ERR_OUT_OF_SAFE_RANGE,
    }
}

/// # Safety
/// `fixed10_ptr` and `rate_ptr` must be readable and `out_f64` writable.
#[no_mangle]
pub unsafe extern "C" fn arshif_convert_major_fixed10(
    fixed10_ptr: *const u8,
    fixed10_len: usize,
    is_negative: u32,
    to_exp: u32,
    rate_ptr: *const u8,
    rate_len: usize,
    out_f64: *mut f64,
) -> u32 {
    let (Some(fixed10), Some(rate)) = (
        read_str(fixed10_ptr, fixed10_len),
        read_str(rate_ptr, rate_len),
    ) else {
        return status::ERR_INVALID_INPUT;
    };
    match money::convert_major_fixed10(fixed10, is_negative != 0, to_exp, rate) {
        Ok(out) => {
            *out_f64 = out as f64;
            status::OK
        }
        Err(ConvertError::UnsafeMinor) => status::ERR_UNSAFE_MINOR,
        Err(ConvertError::InvalidRate) => status::ERR_INVALID_INPUT,
        Err(ConvertError::Overflow) => status::ERR_OVERFLOW,
        Err(ConvertError::OutOfSafeRange) => status::ERR_OUT_OF_SAFE_RANGE,
    }
}

/// # Safety
/// `text_ptr`..`text_ptr+text_len` must be readable and `out_f64` writable.
#[no_mangle]
pub unsafe extern "C" fn arshif_parse_amount_input(
    text_ptr: *const u8,
    text_len: usize,
    exponent: u32,
    out_f64: *mut f64,
) -> u32 {
    let Some(text) = read_str(text_ptr, text_len) else {
        return status::ERR_INVALID_INPUT;
    };
    match money::parse_amount_input(text, exponent) {
        Some(v) => {
            *out_f64 = v as f64;
            status::OK
        }
        None => status::ERR_INVALID_INPUT,
    }
}

/// # Safety
/// `a_ptr` and `b_ptr` must reference readable memory.
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
/// `deltas_ptr` must reference `deltas_len` readable `f64` values, and out pointers must be writable.
#[no_mangle]
pub unsafe extern "C" fn arshif_reconcile_balances(
    base_f64: f64,
    closing_f64: f64,
    deltas_ptr: *const f64,
    deltas_len: usize,
    out_projected_f64: *mut f64,
    out_diff_f64: *mut f64,
) -> u32 {
    let (Some(base), Some(closing)) = (f64_to_safe_i64(base_f64), f64_to_safe_i64(closing_f64))
    else {
        return status::ERR_OUT_OF_SAFE_RANGE;
    };
    let delta_floats = if deltas_len == 0 {
        &[]
    } else {
        slice::from_raw_parts(deltas_ptr, deltas_len)
    };
    let mut deltas = Vec::with_capacity(deltas_len);
    for &d in delta_floats {
        let Some(v) = f64_to_safe_i64(d) else {
            return status::ERR_OUT_OF_SAFE_RANGE;
        };
        deltas.push(v);
    }
    match dedupe::reconcile_balances(base, closing, &deltas) {
        Some(res) => {
            *out_projected_f64 = res.projected_balance as f64;
            *out_diff_f64 = res.difference as f64;
            status::OK
        }
        None => status::ERR_OUT_OF_SAFE_RANGE,
    }
}

/// # Safety
/// `raw_ptr`..`raw_ptr+raw_len` must be readable and `out_f64` writable.
#[no_mangle]
pub unsafe extern "C" fn arshif_parse_smartlog_amount(
    raw_ptr: *const u8,
    raw_len: usize,
    exponent: u32,
    out_f64: *mut f64,
) -> u32 {
    let Some(raw) = read_str(raw_ptr, raw_len) else {
        return status::ERR_INVALID_INPUT;
    };
    match smartlog::parse_smartlog_amount(raw, exponent) {
        Some(v) => {
            *out_f64 = v as f64;
            status::OK
        }
        None => status::ERR_INVALID_INPUT,
    }
}

/// # Safety
/// `str_ptr`..`str_ptr+str_len` must be readable and `out_hex_16` must point to 16 writable bytes.
#[no_mangle]
pub unsafe extern "C" fn arshif_cyrb53_hash(
    str_ptr: *const u8,
    str_len: usize,
    out_hex_16: *mut u8,
) -> u32 {
    let Some(s) = read_str(str_ptr, str_len) else {
        return status::ERR_INVALID_INPUT;
    };
    let hex = smartlog::cyrb53_hash(s);
    std::ptr::copy_nonoverlapping(hex.as_ptr(), out_hex_16, hex.len());
    status::OK
}

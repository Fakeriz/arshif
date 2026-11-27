use crate::money::MAX_SAFE_INT;

/// Parses a SmartLog notification amount token into minor units, matching
/// `src/lib/smartlog/parser.ts` `parseAmount`.
pub fn parse_smartlog_amount(raw: &str, exponent: u32) -> Option<i64> {
    let mut int_part = raw;
    let mut frac_part = "";

    let last_dot = raw.rfind('.');
    let last_comma = raw.rfind(',');

    match (last_dot, last_comma) {
        (Some(ld), Some(lc)) => {
            let cut = ld.max(lc);
            int_part = &raw[..cut];
            frac_part = &raw[cut + 1..];
        }
        (Some(_), None) | (None, Some(_)) => {
            let sep = if last_dot.is_some() { '.' } else { ',' };
            let mut parts = raw.split(sep);
            if let (Some(first), Some(second), None) = (parts.next(), parts.next(), parts.next()) {
                if second.len() != 3 {
                    int_part = first;
                    frac_part = second;
                }
            }
        }
        (None, None) => {}
    }

    let mut groups = int_part.split(|c| c == '.' || c == ',');
    let first_group = groups.next()?;
    let mut digits = String::with_capacity(int_part.len());
    digits.push_str(first_group);
    for g in groups {
        if g.len() != 3 {
            return None;
        }
        digits.push_str(g);
    }

    if digits.is_empty() || !digits.bytes().all(|b| b.is_ascii_digit()) {
        return None;
    }
    if !frac_part.is_empty()
        && (!(1..=2).contains(&frac_part.len()) || !frac_part.bytes().all(|b| b.is_ascii_digit()))
    {
        return None;
    }

    let mut frac_ext = String::with_capacity(frac_part.len() + 2);
    frac_ext.push_str(frac_part);
    frac_ext.push_str("00");
    let exp_usize = exponent as usize;
    let padded = &frac_ext[..exp_usize.min(frac_ext.len())];
    let next_digit = frac_ext
        .as_bytes()
        .get(exp_usize)
        .map(|b| (b - b'0') as u128)
        .unwrap_or(0);

    let trimmed_digits = digits.trim_start_matches('0');
    let mut int_val: u128 = 0;
    for b in trimmed_digits.bytes() {
        int_val = int_val
            .checked_mul(10)?
            .checked_add((b - b'0') as u128)?;
    }

    let mut padded_val: u128 = 0;
    for b in padded.bytes() {
        padded_val = padded_val
            .checked_mul(10)?
            .checked_add((b - b'0') as u128)?;
    }

    let pow10 = 10u128.checked_pow(exponent)?;
    let round_up: u128 = if next_digit >= 5 { 1 } else { 0 };
    let minor = int_val
        .checked_mul(pow10)?
        .checked_add(padded_val)?
        .checked_add(round_up)?;

    if minor > 0 && minor <= MAX_SAFE_INT {
        Some(minor as i64)
    } else {
        None
    }
}

/// Computes the exact UTF-16 `cyrb53` 16-char lowercase hex fingerprint matching
/// `src/lib/smartlog/parser.ts` `hash`.
pub fn cyrb53_hash(input: &str) -> [u8; 16] {
    let mut h1: u32 = 0xdead_beef;
    let mut h2: u32 = 0x41c6_ce57;
    for unit in input.encode_utf16() {
        let ch = unit as u32;
        h1 = (h1 ^ ch).wrapping_mul(2_654_435_761);
        h2 = (h2 ^ ch).wrapping_mul(1_597_334_677);
    }
    h1 = (h1 ^ (h1 >> 16)).wrapping_mul(2_246_822_507)
        ^ (h2 ^ (h2 >> 13)).wrapping_mul(3_266_489_909);
    h2 = (h2 ^ (h2 >> 16)).wrapping_mul(2_246_822_507)
        ^ (h1 ^ (h1 >> 13)).wrapping_mul(3_266_489_909);

    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut out = [0u8; 16];
    for i in 0..8 {
        out[i] = HEX[((h2 >> (28 - i * 4)) & 0xf) as usize];
        out[8 + i] = HEX[((h1 >> (28 - i * 4)) & 0xf) as usize];
    }
    out
}

pub fn cyrb53_hash_string(input: &str) -> String {
    let bytes = cyrb53_hash(input);
    // SAFETY: `cyrb53_hash` emits strictly ASCII hex characters.
    std::str::from_utf8(&bytes).expect("hex").to_owned()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_smartlog_amount_cases() {
        assert_eq!(parse_smartlog_amount("45.000", 0), Some(45_000));
        assert_eq!(parse_smartlog_amount("45.000,00", 0), Some(45_000));
        assert_eq!(parse_smartlog_amount("1.250.000", 0), Some(1_250_000));
        assert_eq!(parse_smartlog_amount("210,000.00", 0), Some(210_000));
        assert_eq!(parse_smartlog_amount("75500", 0), Some(75_500));
        assert_eq!(parse_smartlog_amount("12.50", 2), Some(1_250));
        assert_eq!(parse_smartlog_amount("12,5", 2), Some(1_250));
        assert_eq!(parse_smartlog_amount("1,234.56", 2), Some(123_456));
        assert_eq!(parse_smartlog_amount("45.000,60", 0), Some(45_001));

        assert_eq!(parse_smartlog_amount("1.25.000", 0), None);
        assert_eq!(parse_smartlog_amount("0", 0), None);
        assert_eq!(parse_smartlog_amount("12.345.67", 0), None);
    }

    #[test]
    fn cyrb53_hash_deterministic_and_utf16() {
        let a = cyrb53_hash_string("com.bca|transaksi rp 45.000 ₺ € 💸");
        let b = cyrb53_hash_string("com.bca|transaksi rp 45.000 ₺ € 💸");
        let c = cyrb53_hash_string("com.bca|transaksi rp 45.001 ₺ € 💸");
        assert_eq!(a.len(), 16);
        assert_eq!(a, b);
        assert_ne!(a, c);
    }
}

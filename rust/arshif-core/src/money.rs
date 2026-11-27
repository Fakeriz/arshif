pub const RATE_SCALE: u128 = 1_000_000_000_000;
pub const MAJOR_SCALE: u128 = 10_000_000_000;
pub const MAX_SAFE_INT: u128 = 9_007_199_254_740_991; // 2^53 - 1

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RateError {
    Invalid,
    Overflow,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CrossRateError {
    InvalidRate,
    ZeroDenominator,
    Overflow,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ConvertError {
    UnsafeMinor,
    InvalidRate,
    Overflow,
    OutOfSafeRange,
}

/// Exact unsigned 256-bit integer (little-endian 64-bit limbs) for overflow-free intermediate
/// fixed-point arithmetic across 12-decimal FX rates and 10-decimal major amounts.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct U256([u64; 4]);

impl U256 {
    const fn from_u128(v: u128) -> Self {
        Self([v as u64, (v >> 64) as u64, 0, 0])
    }

    fn mul_u128(self, rhs: u128) -> Option<Self> {
        let mut acc = [0u128; 6];
        let r = [rhs as u64, (rhs >> 64) as u64];
        for i in 0..4 {
            for j in 0..2 {
                let prod = (self.0[i] as u128) * (r[j] as u128);
                let k = i + j;
                acc[k] += prod & 0xFFFF_FFFF_FFFF_FFFF;
                acc[k + 1] += prod >> 64;
            }
        }
        let mut carry = 0u128;
        let mut out = [0u64; 4];
        for k in 0..6 {
            let sum = acc[k] + carry;
            let lo = sum as u64;
            carry = sum >> 64;
            if k < 4 {
                out[k] = lo;
            } else if lo != 0 {
                return None;
            }
        }
        if carry != 0 {
            return None;
        }
        Some(Self(out))
    }

    fn div_rem_u128(self, divisor: u128) -> (Self, u128) {
        debug_assert!(divisor > 0);
        let mut quot = [0u64; 4];
        let mut rem: u128 = 0;
        for bit_idx in (0..256).rev() {
            let limb = bit_idx / 64;
            let shift = bit_idx % 64;
            let bit = ((self.0[limb] >> shift) & 1) as u128;
            let rem_hi = (rem >> 127) != 0;
            let new_rem = (rem << 1) | bit;
            if rem_hi || new_rem >= divisor {
                rem = new_rem.wrapping_sub(divisor);
                quot[limb] |= 1u64 << shift;
            } else {
                rem = new_rem;
            }
        }
        (Self(quot), rem)
    }

    const fn to_u128(self) -> Option<u128> {
        if self.0[2] != 0 || self.0[3] != 0 {
            return None;
        }
        Some((self.0[0] as u128) | ((self.0[1] as u128) << 64))
    }
}

fn parse_u128_digits(digits: &str) -> Result<u128, RateError> {
    if digits.is_empty() || !digits.bytes().all(|b| b.is_ascii_digit()) {
        return Err(RateError::Invalid);
    }
    let trimmed = digits.trim_start_matches('0');
    if trimmed.is_empty() {
        return Ok(0);
    }
    let mut acc: u128 = 0;
    for b in trimmed.bytes() {
        acc = acc
            .checked_mul(10)
            .and_then(|v| v.checked_add((b - b'0') as u128))
            .ok_or(RateError::Overflow)?;
    }
    Ok(acc)
}

/// Parses a decimal FX rate string (`/^(\d+)(?:\.(\d{1,12}))?\d*$/` on `rate.trim()`)
/// into a `u128` scaled by `10^12`, truncating any fractional digits beyond 12.
pub fn rate_to_scaled(rate: &str) -> Result<u128, RateError> {
    let trimmed = rate.trim();
    if trimmed.is_empty() {
        return Err(RateError::Invalid);
    }

    let (int_str, frac_str) = match trimmed.split_once('.') {
        None => (trimmed, ""),
        Some((i, f)) => {
            if f.is_empty() || !f.bytes().all(|b| b.is_ascii_digit()) {
                return Err(RateError::Invalid);
            }
            (i, f)
        }
    };

    let int_val = parse_u128_digits(int_str)?;

    let mut frac_val: u128 = 0;
    let frac_bytes = frac_str.as_bytes();
    for idx in 0..12 {
        let d = if idx < frac_bytes.len() {
            (frac_bytes[idx] - b'0') as u128
        } else {
            0
        };
        frac_val = frac_val * 10 + d;
    }

    int_val
        .checked_mul(RATE_SCALE)
        .and_then(|v| v.checked_add(frac_val))
        .ok_or(RateError::Overflow)
}

/// Computes `fromScaled((rateToScaled(to_per_usd) * 10^12) / rateToScaled(from_per_usd))`
/// with exact integer truncation matching `src/lib/fx.ts` `crossRate`.
pub fn cross_rate_from_rates(
    from_per_usd: &str,
    to_per_usd: &str,
) -> Result<String, CrossRateError> {
    let f_scaled = rate_to_scaled(from_per_usd).map_err(|e| match e {
        RateError::Invalid => CrossRateError::InvalidRate,
        RateError::Overflow => CrossRateError::Overflow,
    })?;
    if f_scaled == 0 {
        return Err(CrossRateError::ZeroDenominator);
    }
    let t_scaled = rate_to_scaled(to_per_usd).map_err(|e| match e {
        RateError::Invalid => CrossRateError::InvalidRate,
        RateError::Overflow => CrossRateError::Overflow,
    })?;

    let numerator = U256::from_u128(t_scaled)
        .mul_u128(RATE_SCALE)
        .ok_or(CrossRateError::Overflow)?;
    let (quot_u256, _) = numerator.div_rem_u128(f_scaled);
    let q = quot_u256.to_u128().ok_or(CrossRateError::Overflow)?;

    let whole = q / RATE_SCALE;
    let frac = q % RATE_SCALE;
    Ok(format!("{whole}.{frac:012}"))
}

fn pow10_u128(exp: u32) -> Option<u128> {
    10u128.checked_pow(exp)
}

/// Converts minor units between currencies using `rate` (`to` per 1 `from`) with
/// half-away-from-zero rounding and JS safe-integer bounds checking.
pub fn convert_minor(
    minor: i64,
    from_exp: u32,
    to_exp: u32,
    rate: &str,
) -> Result<i64, ConvertError> {
    let abs_minor = minor.unsigned_abs() as u128;
    if abs_minor > MAX_SAFE_INT {
        return Err(ConvertError::UnsafeMinor);
    }
    let rate_scaled = rate_to_scaled(rate).map_err(|e| match e {
        RateError::Invalid => ConvertError::InvalidRate,
        RateError::Overflow => ConvertError::Overflow,
    })?;
    let to_pow = pow10_u128(to_exp).ok_or(ConvertError::Overflow)?;
    let from_pow = pow10_u128(from_exp).ok_or(ConvertError::Overflow)?;
    let denominator = from_pow
        .checked_mul(RATE_SCALE)
        .ok_or(ConvertError::Overflow)?;

    let numerator = U256::from_u128(abs_minor)
        .mul_u128(rate_scaled)
        .and_then(|v| v.mul_u128(to_pow))
        .ok_or(ConvertError::Overflow)?;

    let (quot_u256, rem) = numerator.div_rem_u128(denominator);
    let mut result = quot_u256.to_u128().ok_or(ConvertError::OutOfSafeRange)?;
    if rem >= denominator - rem {
        result = result.checked_add(1).ok_or(ConvertError::OutOfSafeRange)?;
    }
    if result > MAX_SAFE_INT {
        return Err(ConvertError::OutOfSafeRange);
    }
    let out = result as i64;
    Ok(if minor < 0 && out != 0 { -out } else { out })
}

/// Converts a non-negative 10-decimal fixed-point major string (`abs.toFixed(10)`) and sign
/// directly to target minor units using `rate` with half-away-from-zero rounding.
pub fn convert_major_fixed10(
    major_fixed10: &str,
    is_negative: bool,
    to_exp: u32,
    rate: &str,
) -> Result<i64, ConvertError> {
    let (int_part, frac_part) = match major_fixed10.trim().split_once('.') {
        Some((i, f)) => (i, f),
        None => (major_fixed10.trim(), ""),
    };
    let int_val = parse_u128_digits(int_part).map_err(|e| match e {
        RateError::Invalid => ConvertError::InvalidRate,
        RateError::Overflow => ConvertError::Overflow,
    })?;
    if !frac_part.bytes().all(|b| b.is_ascii_digit()) {
        return Err(ConvertError::InvalidRate);
    }
    let frac_bytes = frac_part.as_bytes();
    let mut frac_val: u128 = 0;
    for idx in 0..10 {
        let d = if idx < frac_bytes.len() {
            (frac_bytes[idx] - b'0') as u128
        } else {
            0
        };
        frac_val = frac_val * 10 + d;
    }

    let major_scaled = int_val
        .checked_mul(MAJOR_SCALE)
        .and_then(|v| v.checked_add(frac_val))
        .ok_or(ConvertError::Overflow)?;

    let rate_scaled = rate_to_scaled(rate).map_err(|e| match e {
        RateError::Invalid => ConvertError::InvalidRate,
        RateError::Overflow => ConvertError::Overflow,
    })?;
    let to_pow = pow10_u128(to_exp).ok_or(ConvertError::Overflow)?;
    let denominator = MAJOR_SCALE * RATE_SCALE; // 10^22, fits in u128

    let numerator = U256::from_u128(major_scaled)
        .mul_u128(rate_scaled)
        .and_then(|v| v.mul_u128(to_pow))
        .ok_or(ConvertError::Overflow)?;

    let (quot_u256, rem) = numerator.div_rem_u128(denominator);
    let mut result = quot_u256.to_u128().ok_or(ConvertError::OutOfSafeRange)?;
    if rem >= denominator - rem {
        result = result.checked_add(1).ok_or(ConvertError::OutOfSafeRange)?;
    }
    if result > MAX_SAFE_INT {
        return Err(ConvertError::OutOfSafeRange);
    }
    let out = result as i64;
    Ok(if is_negative && out != 0 { -out } else { out })
}

/// Parses user amount input into minor units, matching `src/lib/money.ts` `parseAmountInput`.
pub fn parse_amount_input(text: &str, exponent: u32) -> Option<i64> {
    let cleaned: String = text
        .chars()
        .filter(|c| c.is_ascii_digit() || *c == '.' || *c == ',')
        .collect();
    if !cleaned.bytes().any(|b| b.is_ascii_digit()) {
        return None;
    }

    let mut int_part: &str = &cleaned;
    let mut frac_part: &str = "";

    if exponent > 0 {
        if let Some(sep_idx) = cleaned.rfind(|c| c == '.' || c == ',') {
            let sep = cleaned.as_bytes()[sep_idx];
            let prefix = &cleaned[..sep_idx];
            let suffix = &cleaned[sep_idx + 1..];
            if (1..=2).contains(&suffix.len())
                && suffix.bytes().all(|b| b.is_ascii_digit())
                && !prefix.as_bytes().contains(&sep)
            {
                int_part = prefix;
                frac_part = suffix;
            }
        }
    }

    let mut int_digits: String = int_part
        .chars()
        .filter(|c| c.is_ascii_digit())
        .collect();
    if int_digits.is_empty() {
        int_digits.push('0');
    }

    let mut minor_str = int_digits;
    minor_str.push_str(frac_part);
    let pad_zeros = (exponent as usize).saturating_sub(frac_part.len());
    for _ in 0..pad_zeros {
        minor_str.push('0');
    }

    let value = parse_u128_digits(&minor_str).ok()?;
    if value <= MAX_SAFE_INT {
        Some(value as i64)
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rate_to_scaled_cases() {
        assert_eq!(rate_to_scaled("1"), Ok(1_000_000_000_000));
        assert_eq!(rate_to_scaled("0.000000000001"), Ok(1));
        assert_eq!(rate_to_scaled(" 15873.4521 "), Ok(15_873_452_100_000_000));
        // Truncates fractional digits past 12
        assert_eq!(rate_to_scaled("1.123456789012999"), Ok(1_123_456_789_012));
        assert_eq!(rate_to_scaled("-1"), Err(RateError::Invalid));
        assert_eq!(rate_to_scaled("abc"), Err(RateError::Invalid));
        assert_eq!(rate_to_scaled("1."), Err(RateError::Invalid));
        assert_eq!(rate_to_scaled(".5"), Err(RateError::Invalid));
    }

    #[test]
    fn cross_rate_cases() {
        assert_eq!(
            cross_rate_from_rates("16250", "1").unwrap(),
            "0.000061538461"
        );
        assert_eq!(
            cross_rate_from_rates("1", "16250").unwrap(),
            "16250.000000000000"
        );
        assert_eq!(
            cross_rate_from_rates("0", "1"),
            Err(CrossRateError::ZeroDenominator)
        );
    }

    #[test]
    fn convert_minor_cases() {
        assert_eq!(convert_minor(1000, 2, 0, "15873.45"), Ok(158_735));
        assert_eq!(convert_minor(100_000, 0, 2, "0.000287"), Ok(2_870));
        assert_eq!(convert_minor(100, 2, 2, "0.025"), Ok(3));
        assert_eq!(convert_minor(-100, 2, 2, "0.025"), Ok(-3));
        assert_eq!(convert_minor(123_456, 2, 2, "1"), Ok(123_456));
    }

    #[test]
    fn convert_major_fixed10_cases() {
        assert_eq!(
            convert_major_fixed10("0.0036300000", false, 0, "16000"),
            Ok(58)
        );
        assert_eq!(
            convert_major_fixed10("12.3450000000", true, 2, "1"),
            Ok(-1_235)
        );
        // Huge major amount that overflows u128 intermediate product without U256
        assert_eq!(
            convert_major_fixed10("500000000000000.0000000000", false, 0, "16"),
            Ok(8_000_000_000_000_000)
        );
        assert_eq!(
            convert_major_fixed10("9000000000000000.0000000000", false, 0, "2"),
            Err(ConvertError::OutOfSafeRange)
        );
    }

    #[test]
    fn parse_amount_input_cases() {
        assert_eq!(parse_amount_input("45.000", 0), Some(45_000));
        assert_eq!(parse_amount_input("Rp 1.250.000", 0), Some(1_250_000));
        assert_eq!(parse_amount_input("12.50", 2), Some(1_250));
        assert_eq!(parse_amount_input("12,5", 2), Some(1_250));
        assert_eq!(parse_amount_input("1,234.56", 2), Some(123_456));
        assert_eq!(parse_amount_input("1.234,56", 2), Some(123_456));
        assert_eq!(parse_amount_input("1,000", 2), Some(100_000));
        assert_eq!(parse_amount_input("1..5", 2), Some(1_500));
        assert_eq!(parse_amount_input("abc", 0), None);
        assert_eq!(parse_amount_input("99999999999999999999", 0), None);
    }
}

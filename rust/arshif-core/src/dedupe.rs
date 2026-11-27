use std::collections::BTreeSet;
use unicode_normalization::UnicodeNormalization;

use crate::money::MAX_SAFE_INT;

fn extract_words(s: &str) -> BTreeSet<String> {
    let mut mapped = String::with_capacity(s.len());
    for ch in s.chars() {
        match ch {
            'ı' | 'İ' => mapped.push('i'),
            _ => mapped.push(ch),
        }
    }

    let mut normalized = String::with_capacity(mapped.len());
    for ch in mapped.nfkd() {
        if ('\u{0300}'..='\u{036F}').contains(&ch) {
            continue;
        }
        for lower in ch.to_lowercase() {
            if lower.is_ascii_lowercase() || lower.is_ascii_digit() || lower.is_whitespace() {
                normalized.push(lower);
            } else {
                normalized.push(' ');
            }
        }
    }

    normalized
        .split_whitespace()
        .filter(|w| w.len() >= 3)
        .map(str::to_owned)
        .collect()
}

/// Unicode-normalized word Jaccard similarity (0.0..=1.0), matching `src/lib/dedupe.ts`.
pub fn similarity(a: &str, b: &str) -> f64 {
    let wa = extract_words(a);
    let wb = extract_words(b);
    if wa.is_empty() || wb.is_empty() {
        return 0.0;
    }
    let shared = wa.intersection(&wb).count();
    let union = wa.len() + wb.len() - shared;
    (shared as f64) / (union as f64)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ReconcileBalances {
    pub closing_balance: i64,
    pub projected_balance: i64,
    pub difference: i64,
    pub matched: bool,
}

/// Computes exact statement balance projection and closing difference with safe-integer checks.
pub fn reconcile_balances(
    base_balance: i64,
    closing_balance: i64,
    deltas: &[i64],
) -> Option<ReconcileBalances> {
    if (base_balance.unsigned_abs() as u128) > MAX_SAFE_INT
        || (closing_balance.unsigned_abs() as u128) > MAX_SAFE_INT
    {
        return None;
    }
    let mut selected_delta: i128 = 0;
    for &d in deltas {
        selected_delta = selected_delta.checked_add(d as i128)?;
    }
    let projected = (base_balance as i128).checked_add(selected_delta)?;
    let difference = (closing_balance as i128).checked_sub(projected)?;
    if projected.unsigned_abs() > MAX_SAFE_INT || difference.unsigned_abs() > MAX_SAFE_INT {
        return None;
    }
    Some(ReconcileBalances {
        closing_balance,
        projected_balance: projected as i64,
        difference: difference as i64,
        matched: difference == 0,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn similarity_matches_reference() {
        assert_eq!(similarity("APOTEK K-24 KEMANG", "Apotek K-24"), 0.5);
        assert_eq!(similarity("Sewa kos", "Bioskop XXI"), 0.0);
        assert_eq!(similarity("", "x"), 0.0);
        assert_eq!(similarity("İstanbul Kahvesı", "istanbul kahvesi"), 1.0);
        assert_eq!(similarity("Café Résumé", "cafe resume"), 1.0);
    }

    #[test]
    fn reconcile_balances_cases() {
        let matched = reconcile_balances(1_000_000, 955_000, &[-45_000]).unwrap();
        assert_eq!(matched.projected_balance, 955_000);
        assert_eq!(matched.difference, 0);
        assert!(matched.matched);

        let diff = reconcile_balances(1_000_000, 900_000, &[-45_000, 10_000]).unwrap();
        assert_eq!(diff.projected_balance, 965_000);
        assert_eq!(diff.difference, -65_000);
        assert!(!diff.matched);

        assert!(reconcile_balances(MAX_SAFE_INT as i64, 0, &[1]).is_none());
    }
}

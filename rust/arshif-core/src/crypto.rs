use aes_gcm::{
    aead::{Aead, KeyInit, Payload},
    Aes256Gcm, Nonce,
};

use crate::status;

pub const MAGIC: &[u8; 8] = b"ARSHIFBK";
pub const VERSION: u8 = 1;
pub const NONCE_LEN: usize = 12;
pub const TAG_LEN: usize = 16;
pub const KEY_LEN: usize = 32;
pub const FIXED_PREFIX_LEN: usize = MAGIC.len() + 1 + 4;

const CROCKFORD_ALPHABET: &[u8; 32] = b"0123456789ABCDEFGHJKMNPQRSTVWXYZ";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u32)]
pub enum BackupErrorCode {
    NotBackup = status::ERR_NOT_BACKUP,
    Version = status::ERR_VERSION,
    BadKey = status::ERR_BAD_KEY,
    Corrupt = status::ERR_CORRUPT,
}

impl BackupErrorCode {
    pub fn as_u32(self) -> u32 {
        self as u32
    }
}

/// Encrypts `.arshif` v1 backup bytes using AES-256-GCM with the header prefix bound as AAD.
/// Binary layout: `"ARSHIFBK"` | `VERSION` (1) | `header_len` (u32 BE) | `header_json` | `nonce` (12) | ciphertext+tag.
pub fn seal_backup(
    key: &[u8],
    header_json: &[u8],
    nonce_bytes: &[u8],
    plaintext: &[u8],
) -> Result<Vec<u8>, BackupErrorCode> {
    if key.len() != KEY_LEN {
        return Err(BackupErrorCode::BadKey);
    }
    let nonce_arr: [u8; NONCE_LEN] = nonce_bytes
        .try_into()
        .map_err(|_| BackupErrorCode::Corrupt)?;
    let header_len_u32 =
        u32::try_from(header_json.len()).map_err(|_| BackupErrorCode::Corrupt)?;

    let prefix_len = FIXED_PREFIX_LEN
        .checked_add(header_json.len())
        .ok_or(BackupErrorCode::Corrupt)?;
    let mut prefix = Vec::with_capacity(prefix_len);
    prefix.extend_from_slice(MAGIC);
    prefix.push(VERSION);
    prefix.extend_from_slice(&header_len_u32.to_be_bytes());
    prefix.extend_from_slice(header_json);

    let cipher = Aes256Gcm::new_from_slice(key).map_err(|_| BackupErrorCode::BadKey)?;
    let nonce = Nonce::from(nonce_arr);
    let sealed = cipher
        .encrypt(
            &nonce,
            Payload {
                msg: plaintext,
                aad: &prefix,
            },
        )
        .map_err(|_| BackupErrorCode::Corrupt)?;

    let mut out = Vec::with_capacity(prefix.len() + NONCE_LEN + sealed.len());
    out.extend_from_slice(&prefix);
    out.extend_from_slice(&nonce_arr);
    out.extend_from_slice(&sealed);
    Ok(out)
}

/// Validates `.arshif` v1 magic, version, and length bounds and returns the raw UTF-8 header JSON slice.
pub fn read_backup_header(file: &[u8]) -> Result<&[u8], BackupErrorCode> {
    if file.len() < FIXED_PREFIX_LEN || &file[..MAGIC.len()] != MAGIC {
        return Err(BackupErrorCode::NotBackup);
    }
    if file[MAGIC.len()] != VERSION {
        return Err(BackupErrorCode::Version);
    }
    let header_len = u32::from_be_bytes([
        file[MAGIC.len() + 1],
        file[MAGIC.len() + 2],
        file[MAGIC.len() + 3],
        file[MAGIC.len() + 4],
    ]) as usize;
    let end = FIXED_PREFIX_LEN
        .checked_add(header_len)
        .ok_or(BackupErrorCode::Corrupt)?;
    let min_len = end
        .checked_add(NONCE_LEN + TAG_LEN)
        .ok_or(BackupErrorCode::Corrupt)?;
    if min_len > file.len() {
        return Err(BackupErrorCode::Corrupt);
    }
    Ok(&file[FIXED_PREFIX_LEN..end])
}

/// Validates and decrypts an `.arshif` v1 backup, returning `(header_json_slice, plaintext)`.
pub fn open_backup<'a>(
    key: &[u8],
    file: &'a [u8],
) -> Result<(&'a [u8], Vec<u8>), BackupErrorCode> {
    let header_slice = read_backup_header(file)?;
    let end = FIXED_PREFIX_LEN + header_slice.len();
    let nonce_arr: [u8; NONCE_LEN] = file[end..end + NONCE_LEN]
        .try_into()
        .map_err(|_| BackupErrorCode::Corrupt)?;
    let aad = &file[..end];
    let ciphertext = &file[end + NONCE_LEN..];

    let cipher = Aes256Gcm::new_from_slice(key).map_err(|_| BackupErrorCode::BadKey)?;
    let nonce = Nonce::from(nonce_arr);
    let plaintext = cipher
        .decrypt(
            &nonce,
            Payload {
                msg: ciphertext,
                aad,
            },
        )
        .map_err(|_| BackupErrorCode::BadKey)?;
    Ok((header_slice, plaintext))
}

/// Formats a byte key (typically 32 bytes) as Crockford Base32 in dash-separated groups of 4.
pub fn format_recovery_key(key: &[u8]) -> String {
    let mut bits: u32 = 0;
    let mut value: u32 = 0;
    let mut encoded = Vec::with_capacity((key.len() * 8).div_ceil(5));
    for &byte in key {
        value = (value << 8) | (byte as u32);
        bits += 8;
        while bits >= 5 {
            encoded.push(CROCKFORD_ALPHABET[((value >> (bits - 5)) & 31) as usize]);
            bits -= 5;
        }
    }
    if bits > 0 {
        encoded.push(CROCKFORD_ALPHABET[((value << (5 - bits)) & 31) as usize]);
    }

    let mut out = String::with_capacity(encoded.len() + encoded.len() / 4);
    for (idx, chunk) in encoded.chunks(4).enumerate() {
        if idx > 0 {
            out.push('-');
        }
        // SAFETY: `CROCKFORD_ALPHABET` contains strictly ASCII bytes.
        out.push_str(std::str::from_utf8(chunk).expect("ascii alphabet"));
    }
    out
}

fn crockford_decode_char(ch: char) -> Option<u32> {
    let b = match ch {
        '0' | 'O' => b'0',
        '1' | 'I' | 'L' => b'1',
        c if c.is_ascii() => c as u8,
        _ => return None,
    };
    match b {
        b'0'..=b'9' => Some((b - b'0') as u32),
        b'A'..=b'H' => Some((b - b'A' + 10) as u32),
        b'J' | b'K' => Some((b - b'J' + 18) as u32),
        b'M' | b'N' => Some((b - b'M' + 20) as u32),
        b'P'..=b'T' => Some((b - b'P' + 22) as u32),
        b'V'..=b'Z' => Some((b - b'V' + 27) as u32),
        _ => None,
    }
}

/// Parses a Crockford Base32 recovery key back to its 32-byte key.
/// Accepts lowercase, spaces, hyphens, and ambiguous O/I/L substitutions.
pub fn parse_recovery_key(input: &str) -> Option<[u8; KEY_LEN]> {
    let mut values = [0u32; 52];
    let mut count = 0usize;

    for raw_ch in input.chars() {
        if raw_ch.is_whitespace() || raw_ch == '-' {
            continue;
        }
        for up in raw_ch.to_uppercase() {
            if up.is_whitespace() || up == '-' {
                continue;
            }
            if count >= 52 {
                return None;
            }
            values[count] = crockford_decode_char(up)?;
            count += 1;
        }
    }

    if count != 52 {
        return None;
    }

    let mut out = [0u8; KEY_LEN];
    let mut bits: u32 = 0;
    let mut value: u32 = 0;
    let mut out_idx = 0usize;

    for v in values {
        value = (value << 5) | v;
        bits += 5;
        if bits >= 8 {
            if out_idx < KEY_LEN {
                out[out_idx] = ((value >> (bits - 8)) & 255) as u8;
                out_idx += 1;
            }
            bits -= 8;
        }
    }

    if out_idx == KEY_LEN {
        Some(out)
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn seal_and_open_roundtrip_and_aad_integrity() {
        let key = [0x42u8; 32];
        let nonce = [0x11u8; 12];
        let header = br#"{"createdAt":"2026-11-21T03:00:00.000Z","receipts":true}"#;
        let plaintext = br#"{"transactions":[{"merchant":"Indomaret"}]}"#;

        let sealed = seal_backup(&key, header, &nonce, plaintext).expect("seal");
        assert_eq!(&sealed[..8], MAGIC);
        assert_eq!(sealed[8], VERSION);

        let read_hdr = read_backup_header(&sealed).expect("read header");
        assert_eq!(read_hdr, header);

        let (hdr2, opened) = open_backup(&key, &sealed).expect("open");
        assert_eq!(hdr2, header);
        assert_eq!(opened, plaintext);

        // Wrong key
        let wrong_key = [0x99u8; 32];
        assert_eq!(open_backup(&wrong_key, &sealed), Err(BackupErrorCode::BadKey));

        // Tampered ciphertext
        let mut tampered_ct = sealed.clone();
        let last = tampered_ct.len() - 1;
        tampered_ct[last] ^= 1;
        assert_eq!(open_backup(&key, &tampered_ct), Err(BackupErrorCode::BadKey));

        // Tampered header AAD
        let mut tampered_aad = sealed.clone();
        tampered_aad[14] ^= 1;
        assert_eq!(open_backup(&key, &tampered_aad), Err(BackupErrorCode::BadKey));
    }

    #[test]
    fn header_error_codes() {
        assert_eq!(read_backup_header(b"PK zip"), Err(BackupErrorCode::NotBackup));

        let mut bad_ver = Vec::from(&b"ARSHIFBK"[..]);
        bad_ver.push(2);
        bad_ver.extend_from_slice(&0u32.to_be_bytes());
        assert_eq!(read_backup_header(&bad_ver), Err(BackupErrorCode::Version));

        let mut truncated = Vec::from(&b"ARSHIFBK"[..]);
        truncated.push(1);
        truncated.extend_from_slice(&100u32.to_be_bytes());
        assert_eq!(read_backup_header(&truncated), Err(BackupErrorCode::Corrupt));
    }

    #[test]
    fn recovery_key_format_and_sloppy_parse() {
        let mut key = [0u8; 32];
        for (i, b) in key.iter_mut().enumerate() {
            *b = ((i * 17 + 7) & 0xff) as u8;
        }
        let formatted = format_recovery_key(&key);
        assert_eq!(formatted.split('-').count(), 13);
        assert_eq!(formatted.replace('-', "").len(), 52);
        assert_eq!(parse_recovery_key(&formatted), Some(key));

        let sloppy = formatted
            .to_lowercase()
            .replace('-', " ")
            .replace('0', "o")
            .replace('1', "l");
        assert_eq!(parse_recovery_key(&sloppy), Some(key));

        assert_eq!(parse_recovery_key(&formatted[..formatted.len() - 1]), None);
        let bad_char = format!("{}U", &formatted[..formatted.len() - 1]);
        assert_eq!(parse_recovery_key(&bad_char), None);
    }
}

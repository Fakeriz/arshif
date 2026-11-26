import { HttpError } from './http.ts';

const PDF_HEADER = '%PDF-';

/** Checks PDF header, encryption dictionary anywhere in buffer, and estimated page count ceiling. */
export function inspectPdf(bytes: Uint8Array, maxPages: number): { pages: number } {
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, Math.min(bytes.length, 1024)));
  if (!head.startsWith(PDF_HEADER)) throw new HttpError('unreadable', 422, { message: 'not_pdf' });

  // Scan the entire PDF byte stream (Latin-1 preserves single-byte offsets) so /Encrypt in middle objects is never missed.
  const text = new TextDecoder('latin1').decode(bytes);
  if (/\/Encrypt\b/.test(text)) throw new HttpError('encrypted_pdf', 422);

  const pageMatches = text.match(/\/Type\s*\/Page\b(?!s\b)/g);
  const pages = pageMatches ? pageMatches.length : 0;
  if (pages > maxPages) throw new HttpError('too_large', 413, { message: 'too_many_pages' });
  return { pages };
}

const matches = (bytes: Uint8Array, sig: number[], offset = 0): boolean => {
  if (bytes.length < offset + sig.length) return false;
  for (let i = 0; i < sig.length; i++) {
    if (bytes[offset + i] !== sig[i]) return false;
  }
  return true;
};

/** Validates magic bytes for supported receipt images against the declared extension. */
export function inspectImageMime(bytes: Uint8Array, ext: string): 'image/jpeg' | 'image/png' | 'image/webp' | 'image/heic' {
  const e = ext.toLowerCase();
  if ((e === 'jpg' || e === 'jpeg') && matches(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (e === 'png' && matches(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (e === 'webp' && matches(bytes, [0x52, 0x49, 0x46, 0x46]) && matches(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return 'image/webp';
  if (e === 'heic' && bytes.length >= 12 && matches(bytes, [0x66, 0x74, 0x79, 0x70], 4)) return 'image/heic';
  throw new HttpError('unreadable', 422, { message: 'invalid_image' });
}

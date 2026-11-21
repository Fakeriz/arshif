/** Nama tampilan pengguna: nama yang diisi, atau bagian depan email bila kosong. */
export function profileName(displayName: string | null, email: string): string {
  return displayName?.trim() || email.split('@')[0] || '';
}

/** Maks 2 huruf awal kata ("rani.pratiwi" -> "RP"). */
export function initialsOf(name: string): string {
  return name.split(/[\s._-]+/).filter(Boolean).map((p) => p[0]!.toUpperCase()).slice(0, 2).join('');
}

export const NAME_MAX = 80;

/** Nama untuk disimpan: dirapikan, kosong = null (kembali ke nama dari email). Terlalu panjang = 'too_long'. */
export function cleanName(input: string): string | null | 'too_long' {
  const name = input.trim().replace(/\s+/g, ' ');
  if (name.length > NAME_MAX) return 'too_long';
  return name || null;
}

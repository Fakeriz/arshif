/** Preset sampul profil (monokrom, mengikuti palet). Urutan = urutan di pemilih; yang pertama = bawaan. */
export const COVER_PRESETS = ['tinta', 'batu', 'garis', 'lingkar'] as const;
export type CoverPreset = (typeof COVER_PRESETS)[number];

export type Cover = { kind: 'preset'; key: CoverPreset } | { kind: 'photo'; path: string };

const PREFIX = 'preset:';

export const presetValue = (key: CoverPreset) => `${PREFIX}${key}`;

/** Nilai kolom cover_path -> sampul. Kosong atau preset tak dikenal (versi app lebih baru) = bawaan. */
export function parseCover(value: string | null): Cover {
  if (!value) return { kind: 'preset', key: COVER_PRESETS[0] };
  if (value.startsWith(PREFIX)) {
    const key = value.slice(PREFIX.length);
    return { kind: 'preset', key: (COVER_PRESETS as readonly string[]).includes(key) ? (key as CoverPreset) : COVER_PRESETS[0] };
  }
  return { kind: 'photo', path: value };
}

/** Path berkas di storage bila sampul berupa foto (untuk dibuang saat diganti), selain itu null. */
export function coverFile(value: string | null): string | null {
  const c = parseCover(value);
  return c.kind === 'photo' ? c.path : null;
}

import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';

import { parseCover, type CoverPreset } from '@/lib/cover';
import { useTheme } from '@/theme/ThemeProvider';
import { inkCard, type ColorScheme } from '@/theme/tokens';

import { useSignedUrl } from './ProfileAvatar';

// Pola digambar di kanvas 300x100 (rasio sampul 3:1) lalu di-"slice" ke ukuran sebenarnya.
const PHOTO_FALLBACK = '#262626';
const LINES = Array.from({ length: 28 }, (_, i) => i * 14);
const RINGS = Array.from({ length: 12 }, (_, i) => 24 + i * 22);

/**
 * Sampul profil. Preset memakai warna kartu tinta (ikut terbalik di tema gelap) supaya tetap satu titik paling kontras
 * di layar; garis tipis memakai warna track tinta (dekoratif, tanpa teks di atasnya). Foto gagal dimuat = preset bawaan.
 */
export function ProfileCover({ value, uri, preset, scrim }: { value?: string | null; uri?: string | null; preset?: CoverPreset; scrim?: boolean }) {
  const { scheme, colors } = useTheme();
  const ink = inkCard[scheme];
  const cover = preset ? ({ kind: 'preset', key: preset } as const) : parseCover(value ?? null);
  const remote = useSignedUrl(cover.kind === 'photo' ? cover.path : null);
  const [failed, setFailed] = useState<string | null>(null);
  const src = uri ?? remote;

  if (src && failed !== src) {
    return (
      <View style={styles.fill} accessible={false}>
        <Image source={{ uri: src }} style={styles.fill} contentFit="cover" onError={() => setFailed(src)} transition={150} />
        {/* Redup tetap di atas foto: teks nama di atasnya tetap 4.5:1 walau fotonya putih (#FFF x 0.4 = #666, #F4F4F4 = 5.4:1). */}
        {scrim ? <View style={[StyleSheet.absoluteFill, styles.scrim]} /> : null}
      </View>
    );
  }
  // Foto yang masih dimuat atau gagal: latar gelap tetap, karena teks di atasnya sudah memakai warna terang untuk foto.
  const key = cover.kind === 'preset' ? cover.key : null;
  const bg = key === 'batu' ? colors.textSecondary : key ? ink.bg : PHOTO_FALLBACK;
  return (
    <View style={[styles.fill, { backgroundColor: bg }]} accessible={false}>
      {key === 'garis' || key === 'lingkar' ? (
        <Svg width="100%" height="100%" viewBox="0 0 300 100" preserveAspectRatio="xMidYMid slice">
          {key === 'garis'
            ? LINES.map((x) => <Line key={x} x1={x} y1={0} x2={x - 100} y2={100} stroke={ink.track} strokeWidth={1} />)
            : RINGS.map((r) => <Circle key={r} cx={270} cy={100} r={r} stroke={ink.track} strokeWidth={1} fill="none" />)}
        </Svg>
      ) : null}
    </View>
  );
}

/**
 * Warna teks di atas sampul. Tinta/garis/lingkar = teks kartu tinta (ikut terbalik di tema gelap).
 * Batu: teks redup kartu tinta gagal kontras (±2.9:1), jadi nama dan email sama-sama memakai teks utama.
 * Foto: teks terang di atas redup (lihat scrim).
 */
export function coverTextColors(value: string | null, scheme: ColorScheme): { text: string; muted: string } {
  const ink = inkCard[scheme];
  const c = parseCover(value);
  if (c.kind === 'photo') return { text: '#F4F4F4', muted: '#E0E0E0' };
  if (c.kind === 'preset' && c.key === 'batu') return { text: ink.text, muted: ink.text };
  return { text: ink.text, muted: ink.textMuted };
}

const styles = StyleSheet.create({
  fill: { width: '100%', height: '100%' },
  scrim: { backgroundColor: 'rgba(10, 10, 10, 0.6)' },
});

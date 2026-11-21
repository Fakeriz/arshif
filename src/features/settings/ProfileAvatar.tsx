import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { avatarUrl } from '@/data/remote/api';
import { initialsOf, profileName } from '@/lib/profile';
import { useStore } from '@/state/AppStore';
import { useTheme } from '@/theme/ThemeProvider';
import { radius } from '@/theme/tokens';

// Signed URL berlaku 1 jam; dipakai ulang 50 menit supaya Beranda, Pengaturan, dan Profil tidak meminta ulang tiap render.
const cache = new Map<string, { url: string; until: number }>();
const TTL_MS = 50 * 60 * 1000;

function cachedUrl(path: string): string | null {
  const hit = cache.get(path);
  return hit && hit.until > Date.now() ? hit.url : null;
}

/** Signed URL foto profil; null selama memuat, saat gagal, atau tanpa foto (tampil inisial). */
export function useAvatarUrl(path: string | null): string | null {
  // Hasil ambil disimpan bersama path-nya: path berganti = hasil lama otomatis tidak dipakai.
  const [fetched, setFetched] = useState<{ path: string; url: string } | null>(null);
  const hit = path ? cachedUrl(path) : null;
  useEffect(() => {
    if (!path || cachedUrl(path)) return;
    let alive = true;
    avatarUrl(path)
      .then((u) => {
        cache.set(path, { url: u, until: Date.now() + TTL_MS });
        if (alive) setFetched({ path, url: u });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [path]);
  return hit ?? (fetched && fetched.path === path ? fetched.url : null);
}

/** Foto profil bulat, atau inisial nama bila belum ada foto / foto gagal dimuat. `uri` = pratinjau lokal saat mengunggah. */
export function ProfileAvatar({ size, uri }: { size: number; uri?: string | null }) {
  const { colors } = useTheme();
  const { state } = useStore();
  const remote = useAvatarUrl(state.avatarPath);
  const [failed, setFailed] = useState<string | null>(null);
  const src = uri ?? remote;
  const box = { width: size, height: size, borderRadius: radius.full, backgroundColor: colors.accentSoft };
  if (src && failed !== src) {
    // Dekoratif: nama selalu tampil sebagai teks di sebelahnya.
    return <Image source={{ uri: src }} style={box} contentFit="cover" accessible={false} onError={() => setFailed(src)} transition={150} />;
  }
  // Inisial ±28% dari ukuran (56 -> 16), sama dengan kartu profil lama.
  const font = Math.round(size * 0.28);
  return (
    <View style={[box, styles.center]} accessible={false}>
      <AppText variant="h2" tone="accent" style={{ fontSize: font, lineHeight: Math.round(font * 1.25) }}>
        {initialsOf(profileName(state.displayName, state.email))}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
});

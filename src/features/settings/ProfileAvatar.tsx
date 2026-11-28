import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { initialsOf, profileName } from '@/lib/profile';
import { useSignedUrl } from '@/lib/signedAvatarUrl';
import { useStore } from '@/state/AppStore';
import { useTheme } from '@/theme/ThemeProvider';
import { radius } from '@/theme/tokens';

export { useSignedUrl } from '@/lib/signedAvatarUrl';

/** Foto profil bulat, atau inisial nama bila belum ada foto / foto gagal dimuat. `uri` = pratinjau lokal saat mengunggah. */
export function ProfileAvatar({ size, uri }: { size: number; uri?: string | null }) {
  const { colors } = useTheme();
  const { state } = useStore();
  const remote = useSignedUrl(state.avatarPath);
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

import { Plus } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { useT } from '@/i18n';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, type CategoryHue } from '@/theme/tokens';

import { AppText } from './AppText';
import { Icon } from './Icon';
import { PopOnMount } from './PopIn';
import { PressableScale } from './PressableScale';

const HUES: CategoryHue[] = ['rose', 'jade', 'coral', 'sky', 'saffron', 'plum', 'teal'];

export type AvatarStackProps = {
  names: string[];
  /** Jumlah avatar yang ditampilkan; sisanya diringkas "+N". */
  max?: number;
  size?: number;
  /** Warna di belakang tumpukan (untuk cincin pemisah); bawaan warna kartu. */
  ringColor?: string;
  onAdd?: () => void;
  addLabel?: string;
};

/** Tumpukan avatar inisial. Anggota baru meletup masuk; warna mengikuti rona kategori (15% latar, penuh di huruf). */
export function AvatarStack({ names, max = 4, size = 36, ringColor, onAdd, addLabel }: AvatarStackProps) {
  const { colors, hues } = useTheme();
  const t = useT();
  const ring = ringColor ?? colors.surface;
  const shown = names.slice(0, max);
  const rest = names.length - shown.length;
  const bubble = { width: size, height: size, borderColor: ring };

  return (
    <View accessible accessibilityLabel={names.join(', ')} style={styles.row}>
      {shown.map((name, i) => {
        const hue = hues[HUES[i % HUES.length]];
        return (
          <PopOnMount key={name} style={i > 0 && { marginLeft: -size * 0.28 }}>
            {/* Latar buram dulu (warna kartu), baru tinta rona 15% di atasnya, supaya avatar di bawahnya tidak tembus. */}
            <View style={[styles.bubble, bubble, { backgroundColor: ring }]}>
              <View style={[styles.tint, { backgroundColor: `${hue}26` }]} />
              <AppText variant="caption" style={{ color: hue, fontWeight: '700' }}>
                {name.trim().charAt(0).toUpperCase()}
              </AppText>
            </View>
          </PopOnMount>
        );
      })}
      {rest > 0 && (
        <PopOnMount key={`rest-${rest}`} style={{ marginLeft: -size * 0.28 }}>
          <View accessibilityLabel={t('common.ui.more', { n: rest })} style={[styles.bubble, bubble, { backgroundColor: colors.surfaceSunken }]}>
            <AppText variant="overline" tone="secondary" numeric>
              +{rest}
            </AppText>
          </View>
        </PopOnMount>
      )}
      {onAdd && (
        <PressableScale accessibilityLabel={addLabel ?? t('common.ui.increase')} onPress={onAdd} focusRadius={radius.full} containerStyle={{ marginLeft: -size * 0.28 }} style={[styles.bubble, bubble, { backgroundColor: colors.surfaceSunken }]}>
          <Icon icon={Plus} color={colors.text} size={16} />
        </PressableScale>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  bubble: { borderRadius: radius.full, borderWidth: 2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  tint: { ...StyleSheet.absoluteFill },
});

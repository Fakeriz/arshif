import { View } from 'react-native';

import { categoryLabel, useT } from '@/i18n';
import { getCategory } from '@/constants/categories';
import { useTheme } from '@/theme/ThemeProvider';
import { radius } from '@/theme/tokens';

import { Icon } from './Icon';

export type CategoryIconProps = {
  category: string;
  size?: number;
};

/** Ikon kategori dalam lingkaran: warna kategori penuh di ikon, 15% di latar. */
export function CategoryIcon({ category, size = 40 }: CategoryIconProps) {
  const { hues } = useTheme();
  const t = useT();
  const def = getCategory(category);
  const color = hues[def.hue];

  return (
    <View
      accessibilityLabel={categoryLabel(t, def.key)}
      style={{
        width: size,
        height: size,
        borderRadius: radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: hexWithAlpha(color, 0.15),
      }}
    >
      <Icon icon={def.icon} color={color} size={Math.round(size * 0.5)} />
    </View>
  );
}

function hexWithAlpha(hex: string, alpha: number): string {
  const a = Math.round(alpha * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hex}${a}`;
}

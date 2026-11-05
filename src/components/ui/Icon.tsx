import type { LucideIcon } from 'lucide-react-native';

import { layout } from '@/theme/tokens';

type IconProps = {
  icon: LucideIcon;
  color: string;
  size?: number;
};

/** Satu-satunya pintu ikon: Lucide, stroke 1.75. */
export function Icon({ icon: Glyph, color, size = layout.iconSize.md }: IconProps) {
  return <Glyph color={color} size={size} strokeWidth={layout.iconStroke} />;
}

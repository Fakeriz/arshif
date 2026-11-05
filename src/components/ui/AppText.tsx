import { Text, type TextProps, type TextStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { type as typeScale, type Palette, type TypeVariant } from '@/theme/tokens';

export type TextTone =
  | 'primary'
  | 'secondary'
  | 'muted'
  | 'accent'
  | 'positive'
  | 'negative'
  | 'warning'
  | 'info'
  | 'onAccent';

const toneKey: Record<TextTone, keyof Palette> = {
  primary: 'text',
  secondary: 'textSecondary',
  muted: 'textMuted',
  accent: 'accentText',
  positive: 'positive',
  negative: 'negative',
  warning: 'warning',
  info: 'info',
  onAccent: 'onAccent',
};

export type AppTextProps = TextProps & {
  variant?: TypeVariant;
  tone?: TextTone;
  /** Angka tabular agar digit tidak "goyang" saat berubah. */
  numeric?: boolean;
  align?: TextStyle['textAlign'];
  uppercase?: boolean;
};

export function AppText({
  variant = 'body',
  tone = 'primary',
  numeric,
  align,
  uppercase,
  style,
  maxFontSizeMultiplier = 1.4,
  ...rest
}: AppTextProps) {
  const { colors } = useTheme();
  return (
    <Text
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      style={[
        typeScale[variant],
        { color: colors[toneKey[tone]] },
        numeric && { fontVariant: ['tabular-nums'] },
        align && { textAlign: align },
        uppercase && { textTransform: 'uppercase' },
        style,
      ]}
      {...rest}
    />
  );
}

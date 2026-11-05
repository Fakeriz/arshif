import type { LucideIcon } from 'lucide-react-native';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { fonts, layout, radius, space } from '@/theme/tokens';

import { AppText, type TextTone } from './AppText';
import { Icon } from './Icon';
import { PressableScale } from './PressableScale';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'lg' | 'md' | 'sm';

export type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  accessibilityHint?: string;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  icon,
  loading,
  disabled,
  fullWidth,
  accessibilityHint,
}: ButtonProps) {
  const { colors } = useTheme();
  const looks: Record<ButtonVariant, { bg: string; border: string; fg: string; tone: TextTone }> = {
    primary: { bg: colors.accent, border: colors.accent, fg: colors.onAccent, tone: 'onAccent' },
    secondary: { bg: colors.track, border: colors.glassBorder, fg: colors.text, tone: 'primary' },
    ghost: { bg: 'transparent', border: 'transparent', fg: colors.accentText, tone: 'accent' },
    danger: { bg: colors.negativeSoft, border: 'transparent', fg: colors.negative, tone: 'negative' },
  };
  const look = looks[variant];

  const height = layout.buttonHeight[size];
  const iconSize = size === 'sm' ? layout.iconSize.sm : layout.iconSize.md;

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || loading}
      hapticOnPress={variant === 'primary'}
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      aria-disabled={!!(disabled || loading)} aria-busy={!!loading}
      focusRadius={radius.md}
      style={[
        styles.base,
        {
          height,
          backgroundColor: look.bg,
          borderColor: look.border,
          paddingHorizontal: size === 'sm' ? space.md : space.xl,
        },
        fullWidth && styles.full,
      ]}
    >
      <View style={styles.row}>
        {loading ? (
          <ActivityIndicator size="small" color={look.fg} />
        ) : (
          icon && <Icon icon={icon} color={look.fg} size={iconSize} />
        )}
        <AppText
          variant={size === 'sm' ? 'caption' : 'button'}
          tone={look.tone}
          numberOfLines={1}
          style={size === 'sm' && styles.smLabel}
        >
          {label}
        </AppText>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    borderWidth: layout.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  full: { alignSelf: 'stretch' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  smLabel: { fontFamily: fonts.semibold },
});

import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { layout, radius, space } from '@/theme/tokens';

import { PressableScale } from './PressableScale';

export type CardProps = {
  children: ReactNode;
  variant?: 'surface' | 'raised' | 'outline';
  padding?: keyof typeof space | 0;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

export function Card({
  children,
  variant = 'surface',
  padding = 'lg',
  onPress,
  accessibilityLabel,
  style,
}: CardProps) {
  const { colors } = useTheme();
  const look: ViewStyle = {
    backgroundColor:
      variant === 'outline' ? 'transparent' : variant === 'raised' ? colors.surfaceRaised : colors.surface,
    borderColor: variant === 'outline' ? colors.borderStrong : colors.border,
    padding: padding === 0 ? 0 : space[padding],
  };

  if (onPress) {
    return (
      <PressableScale
        onPress={onPress}
        accessibilityLabel={accessibilityLabel}
        focusRadius={radius.lg}
        scaleTo={0.985}
        style={[styles.base, look, style]}
      >
        {children}
      </PressableScale>
    );
  }
  return (
    <View accessibilityLabel={accessibilityLabel} style={[styles.base, look, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.lg,
    borderWidth: layout.hairline,
    overflow: 'hidden',
  },
});

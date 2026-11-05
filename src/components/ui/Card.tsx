import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { layout, radius, space } from '@/theme/tokens';

import { GlassView } from './GlassView';
import { PressableScale } from './PressableScale';

export type CardProps = {
  children: ReactNode;
  /** glass = panel kaca (bawaan, PRD Bab 11); outline = garis saja untuk konten sekunder. */
  variant?: 'glass' | 'outline';
  padding?: keyof typeof space | 0;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

export function Card({ children, variant = 'glass', padding = 'lg', onPress, accessibilityLabel, style }: CardProps) {
  const { colors } = useTheme();
  const pad: ViewStyle = { padding: padding === 0 ? 0 : space[padding] };
  const body =
    variant === 'glass' ? (
      <GlassView radius={radius.lg} style={[pad, style]} accessibilityLabel={onPress ? undefined : accessibilityLabel}>
        {children}
      </GlassView>
    ) : (
      <View
        accessibilityLabel={onPress ? undefined : accessibilityLabel}
        style={[{ borderRadius: radius.lg, borderWidth: layout.hairline, borderColor: colors.borderStrong }, pad, style]}
      >
        {children}
      </View>
    );

  if (!onPress) return body;
  return (
    <PressableScale onPress={onPress} accessibilityLabel={accessibilityLabel} focusRadius={radius.lg} scaleTo={0.985}>
      {body}
    </PressableScale>
  );
}

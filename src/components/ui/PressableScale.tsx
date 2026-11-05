import { useState, type ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { haptic, useMotion } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';
import { motion } from '@/theme/tokens';

export type PressableScaleProps = Omit<PressableProps, 'style' | 'children'> & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Gaya layout untuk pembungkus luar (mis. flex: 1 di dalam baris). */
  containerStyle?: StyleProp<ViewStyle>;
  /** Radius ring fokus; samakan dengan radius elemen. */
  focusRadius?: number;
  hapticOnPress?: boolean;
  scaleTo?: number;
};

/** Dasar semua elemen yang bisa ditekan: efek tekan scale 0.97 + ring fokus terlihat. */
export function PressableScale({
  children,
  style,
  containerStyle,
  focusRadius = 14,
  hapticOnPress,
  scaleTo = motion.pressScale,
  disabled,
  onPress,
  onPressIn,
  onPressOut,
  onFocus,
  onBlur,
  ...rest
}: PressableScaleProps) {
  const { colors } = useTheme();
  const { spring } = useMotion();
  const scale = useSharedValue(1);
  const [focused, setFocused] = useState(false);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      style={containerStyle}
      onPressIn={(e) => {
        scale.value = spring(scaleTo);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = spring(1);
        onPressOut?.(e);
      }}
      onPress={(e) => {
        if (hapticOnPress) haptic('tap');
        onPress?.(e);
      }}
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        onBlur?.(e);
      }}
      {...rest}
    >
      <Animated.View
        style={[
          style,
          animated,
          disabled && { opacity: 0.45 },
          focused && {
            outlineColor: colors.focus,
            outlineWidth: 2,
            outlineOffset: 2,
            outlineStyle: 'solid',
            borderRadius: focusRadius,
          },
        ]}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
}

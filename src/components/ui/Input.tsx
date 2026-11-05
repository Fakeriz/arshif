import { CircleAlert, Eye, EyeOff, type LucideIcon } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { layout, radius, space, type as typeScale } from '@/theme/tokens';

import { AppText } from './AppText';
import { Icon } from './Icon';

export type InputProps = Omit<TextInputProps, 'style' | 'editable'> & {
  label: string;
  error?: string;
  hint?: string;
  icon?: LucideIcon;
  trailing?: ReactNode;
  disabled?: boolean;
};

export function Input({
  label,
  error,
  hint,
  icon,
  trailing,
  disabled,
  secureTextEntry,
  onFocus,
  onBlur,
  ...rest
}: InputProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);
  const borderColor = error ? colors.negative : focused ? colors.accent : colors.border;

  return (
    <View style={[styles.wrap, disabled && styles.disabled]}>
      <AppText variant="caption" tone="secondary">
        {label}
      </AppText>
      <View
        style={[
          styles.field,
          { backgroundColor: colors.surfaceSunken, borderColor },
          focused && styles.focusedBorder,
        ]}
      >
        {icon && <Icon icon={icon} color={colors.textMuted} />}
        <TextInput
          accessibilityLabel={label}
          accessibilityHint={error ?? hint}
          editable={!disabled}
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.accent}
          secureTextEntry={secureTextEntry && hidden}
          style={[styles.input, typeScale.body, { color: colors.text }]}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...rest}
        />
        {secureTextEntry && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Tampilkan kata sandi' : 'Sembunyikan kata sandi'}
            onPress={() => setHidden((h) => !h)}
            hitSlop={12}
          >
            <Icon icon={hidden ? Eye : EyeOff} color={colors.textMuted} />
          </Pressable>
        )}
        {trailing}
      </View>
      {error ? (
        <View style={styles.message} accessibilityLiveRegion="polite">
          <Icon icon={CircleAlert} color={colors.negative} size={layout.iconSize.sm} />
          <AppText variant="caption" tone="negative" style={styles.flex}>
            {error}
          </AppText>
        </View>
      ) : hint ? (
        <AppText variant="caption" tone="muted">
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs + 2 },
  disabled: { opacity: 0.5 },
  field: {
    minHeight: layout.inputHeight,
    borderRadius: radius.md,
    borderWidth: layout.hairline,
    paddingHorizontal: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  focusedBorder: { borderWidth: 1.5 },
  input: { flex: 1, paddingVertical: space.md, outlineStyle: 'none' } as object,
  message: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  flex: { flex: 1 },
});

import { CircleAlert } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, TextInput, View } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

import { useMotion } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';
import { layout, radius, space } from '@/theme/tokens';

import { AppText } from './AppText';
import { Icon } from './Icon';
import { PopOnMount } from './PopIn';

export type OtpInputProps = {
  value: string;
  /** Menerima teks mentah (tempel/autofill bisa membawa spasi); pemanggil yang menyaring digit. */
  onChangeText: (text: string) => void;
  label: string;
  length?: number;
  error?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  onSubmitEditing?: () => void;
};

/**
 * Kode sekali pakai dalam kotak per digit. Satu TextInput transparan menutupi semua kotak, jadi
 * tempel, autofill SMS/email, dan pembaca layar bekerja seperti input biasa. Digit meletup saat
 * masuk, kotak aktif berkaret kedip, dan baris bergetar saat error.
 */
export function OtpInput({ value, onChangeText, label, length = 6, error, disabled, autoFocus, onSubmitEditing }: OtpInputProps) {
  const { colors } = useTheme();
  const { reduced } = useMotion();
  const [focused, setFocused] = useState(!!autoFocus);
  const shake = useSharedValue(0);
  const hadError = useRef(false);

  useEffect(() => {
    if (error && !hadError.current && !reduced) {
      shake.value = withSequence(withTiming(-6, { duration: 50 }), withTiming(6, { duration: 70 }), withTiming(-4, { duration: 70 }), withTiming(0, { duration: 60 }));
    }
    hadError.current = !!error;
  }, [error, reduced, shake]);
  const row = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));

  const digits = value.replace(/\D/g, '').slice(0, length);
  return (
    <View style={[styles.wrap, disabled && styles.off]}>
      <AppText variant="caption" tone="secondary">
        {label}
      </AppText>
      <Animated.View style={[styles.row, row]}>
        {Array.from({ length }, (_, i) => {
          const active = focused && i === Math.min(digits.length, length - 1) && digits.length < length;
          const borderColor = error ? colors.negative : active ? colors.accent : digits[i] ? colors.borderStrong : colors.border;
          return (
            <View key={i} aria-hidden style={[styles.box, { backgroundColor: colors.surfaceSunken, borderColor }, active && styles.activeBox]}>
              {digits[i] ? (
                <PopOnMount key={digits[i]}>
                  <AppText variant="h2" numeric>
                    {digits[i]}
                  </AppText>
                </PopOnMount>
              ) : (
                active && <Caret />
              )}
            </View>
          );
        })}
        <TextInput
          accessibilityLabel={label}
          accessibilityHint={error}
          value={digits}
          onChangeText={onChangeText}
          editable={!disabled}
          autoFocus={autoFocus}
          keyboardType="number-pad"
          inputMode="numeric"
          // Web: beri ruang untuk tempelan berspasi; pemanggil memotong ke `length`.
          maxLength={Platform.OS === 'web' ? 32 : length}
          textContentType="oneTimeCode"
          autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
          returnKeyType="done"
          caretHidden
          onSubmitEditing={onSubmitEditing}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={styles.input}
        />
      </Animated.View>
      {error && (
        <View style={styles.message} aria-live="polite">
          <Icon icon={CircleAlert} color={colors.negative} size={layout.iconSize.sm} />
          <AppText variant="caption" tone="negative" style={styles.flex}>
            {error}
          </AppText>
        </View>
      )}
    </View>
  );
}

function Caret() {
  const { colors } = useTheme();
  const { reduced } = useMotion();
  const o = useSharedValue(1);
  useEffect(() => {
    if (reduced) return;
    o.value = withRepeat(withTiming(0, { duration: 520 }), -1, true);
    return () => cancelAnimation(o);
  }, [o, reduced]);
  const style = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[styles.caret, { backgroundColor: colors.text }, style]} />;
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs + 2 },
  off: { opacity: 0.5 },
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: space.sm },
  box: { flex: 1, maxWidth: 56, height: 52, borderRadius: radius.md, borderWidth: layout.hairline, alignItems: 'center', justifyContent: 'center' },
  activeBox: { borderWidth: 1.5 },
  caret: { width: 2, height: 22, borderRadius: 1 },
  // Hampir transparan (bukan 0) supaya tetap bisa difokus dan ditempeli di semua platform.
  input: { ...StyleSheet.absoluteFill, opacity: 0.011, fontSize: 1, color: 'transparent' },
  message: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
});

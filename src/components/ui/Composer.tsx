import { ArrowUp } from 'lucide-react-native';
import { StyleSheet, TextInput, View } from 'react-native';

import { useT } from '@/i18n';
import { useTheme } from '@/theme/ThemeProvider';
import { layout, radius, space, type as typeScale } from '@/theme/tokens';

import { Icon } from './Icon';
import { PopIn } from './PopIn';
import { PressableScale } from './PressableScale';

export type ComposerProps = { value: string; onChangeText: (text: string) => void; onSend: (text: string) => void; placeholder: string; disabled?: boolean };

/** Kolom pesan satu baris (Tanya Coach, catat lewat teks). Tombol kirim baru meletup saat ada isi. */
export function Composer({ value, onChangeText, onSend, placeholder, disabled }: ComposerProps) {
  const { colors } = useTheme();
  const t = useT();
  const ready = value.trim().length > 0 && !disabled;
  const send = () => {
    if (ready) onSend(value.trim());
  };

  return (
    <View style={[styles.field, { backgroundColor: colors.surfaceSunken, borderColor: colors.border }, disabled && styles.off]}>
      <TextInput
        accessibilityLabel={placeholder}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        selectionColor={colors.accent}
        editable={!disabled}
        returnKeyType="send"
        onSubmitEditing={send}
        style={[styles.input, typeScale.body, { color: colors.text }]}
      />
      <PopIn visible={ready} from={0.3}>
        <PressableScale accessibilityLabel={t('common.ui.send')} onPress={send} hapticOnPress focusRadius={radius.full} style={[styles.send, { backgroundColor: colors.accent }]}>
          <Icon icon={ArrowUp} color={colors.onAccent} size={18} />
        </PressableScale>
      </PopIn>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 48, paddingLeft: space.lg, paddingRight: space.xs + 2, borderRadius: radius.control, borderWidth: layout.hairline },
  off: { opacity: 0.5 },
  input: { flex: 1, paddingVertical: space.md, outlineStyle: 'none' } as object,
  send: { width: 36, height: 36, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
});

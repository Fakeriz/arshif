import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { layout, radius, space } from '@/theme/tokens';

import { AppText } from './AppText';
import { GlassView } from './GlassView';
import { Icon } from './Icon';
import { PressableScale } from './PressableScale';

export type PromoCardProps = {
  icon: LucideIcon;
  title: string;
  message: string;
  onPress: () => void;
  accessibilityHint?: string;
};

/**
 * Kartu bertinta aksen untuk satu ajakan kontekstual Arshif (tips fitur, sisa kuota,
 * tagihan terdekat). Satu per layar: inilah "momen aksen" di luar tombol utama.
 */
export function PromoCard({ icon, title, message, onPress, accessibilityHint }: PromoCardProps) {
  const { colors } = useTheme();
  return (
    <PressableScale onPress={onPress} accessibilityLabel={`${title}. ${message}`} accessibilityHint={accessibilityHint} focusRadius={radius.lg} scaleTo={0.985}>
      <GlassView radius={radius.lg}>
        <View style={[styles.row, { backgroundColor: colors.accentSoft }]}>
          <View style={[styles.icon, { backgroundColor: colors.accentSoft, borderColor: colors.glassBorder }]}>
            <Icon icon={icon} color={colors.accentText} size={layout.iconSize.lg} />
          </View>
          <View style={styles.text}>
            <AppText variant="bodyStrong">{title}</AppText>
            <AppText variant="caption" tone="secondary">
              {message}
            </AppText>
          </View>
          <Icon icon={ChevronRight} color={colors.textMuted} size={layout.iconSize.md} />
        </View>
      </GlassView>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
  icon: { width: 48, height: 48, borderRadius: radius.md, borderWidth: layout.hairline, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, minWidth: 0, gap: space.xxs },
});

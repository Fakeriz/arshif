import { Check } from 'lucide-react-native';
import { View } from 'react-native';

import { BottomSheet, Icon, ListItem } from '@/components/ui';
import { LANGS, useI18n } from '@/i18n';
import { useTheme } from '@/theme/ThemeProvider';

/** Pilih bahasa (FR-SET-1). Nama bahasa ditulis dalam bahasanya sendiri agar selalu bisa dikenali. */
export function LanguageSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { lang, setLang, t } = useI18n();
  const { colors } = useTheme();
  return (
    <BottomSheet visible={visible} onClose={onClose} title={t('settings.languagePick')}>
      <View accessibilityRole="radiogroup">
        {LANGS.map((l, i) => (
          <ListItem
            key={l.key}
            title={l.nativeName}
            trailing={l.key === lang ? <Icon icon={Check} color={colors.accentText} /> : undefined}
            divider={i < LANGS.length - 1}
            onPress={() => {
              setLang(l.key);
              onClose();
            }}
          />
        ))}
      </View>
    </BottomSheet>
  );
}

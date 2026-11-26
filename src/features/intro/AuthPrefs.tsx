import { Check, Globe, Moon, Sun } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { HeaderButton, HeaderMenu } from '@/components/shell/HeaderActions';
import { AppText, Icon, PressableScale } from '@/components/ui';
import { LANGS, useI18n } from '@/i18n';
import { haptic } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';
import { layout, radius, space } from '@/theme/tokens';
import { withThemeTransition } from '@/theme/viewTransition';

/**
 * Bahasa + tema sebelum login (Sambut, Masuk). Bola dunia membuka menu bahasa melayang di bawahnya;
 * matahari/bulan langsung membalik tema. Keduanya disimpan di perangkat dan ikut ke profil saat akun dibuat.
 */
export function AuthPrefs() {
  const { t, lang, setLang } = useI18n();
  const { colors, scheme, setMode } = useTheme();
  const dark = scheme === 'dark';
  const current = LANGS.find((l) => l.key === lang);

  return (
    <View style={styles.row}>
      <HeaderMenu trigger={(show, open) => <HeaderButton label={`${t('auth.prefs.language')}: ${current?.nativeName ?? lang}`} icon={Globe} onPress={show} selected={open} />}>
        {(close) =>
          LANGS.map((l, i) => {
            const selected = l.key === lang;
            return (
              <PressableScale
                key={l.key}
                accessibilityRole="button"
                accessibilityLabel={l.nativeName}
                accessibilityState={{ selected }}
                onPress={() => {
                  if (!selected) {
                    haptic('selection');
                    setLang(l.key);
                  }
                  close();
                }}
                focusRadius={radius.sm}
                scaleTo={0.985}
              >
                <View style={[styles.item, i < LANGS.length - 1 && { borderBottomWidth: layout.hairline, borderBottomColor: colors.border }]}>
                  <AppText variant={selected ? 'bodyStrong' : 'body'} style={styles.flex} numberOfLines={1}>
                    {l.nativeName}
                  </AppText>
                  {selected && <Icon icon={Check} color={colors.text} size={layout.iconSize.md} />}
                </View>
              </PressableScale>
            );
          })
        }
      </HeaderMenu>
      <HeaderButton
        label={dark ? t('auth.prefs.toLight') : t('auth.prefs.toDark')}
        icon={dark ? Sun : Moon}
        onPress={() => {
          haptic('selection');
          withThemeTransition(() => setMode(dark ? 'light' : 'dark'));
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.sm },
  item: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 48, paddingVertical: space.sm },
  flex: { flex: 1 },
});

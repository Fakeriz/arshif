import { Check } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppText, Icon, PressableScale } from '@/components/ui';
import { BANK_COUNTRIES, BANKS } from '@/constants/banks';
import { bankName, useT } from '@/i18n';
import { useTheme } from '@/theme/ThemeProvider';
import { layout, radius, space } from '@/theme/tokens';

/** Grid desain kartu per bank (FR-ACC-2), dikelompokkan per negara. Grup radio. */
export function BankGrid({ value, onChange }: { value: string; onChange: (bank: string) => void }) {
  const t = useT();
  const { colors } = useTheme();
  return (
    <View style={styles.groups}>
      {BANK_COUNTRIES.map((country) => (
        <View key={country} style={styles.group}>
          <AppText variant="caption" tone="secondary" accessibilityRole="header">
            {t(`settings.accounts.country.${country}`)}
          </AppText>
          <View accessibilityRole="radiogroup" style={styles.grid}>
            {BANKS.filter((b) => b.country === country).map((b) => {
              const selected = b.key === value;
              const name = bankName(t, b.key);
              return (
                <PressableScale
                  key={b.key}
                  accessibilityRole="radio"
                  aria-checked={selected}
                  accessibilityLabel={name}
                  onPress={() => onChange(b.key)}
                  containerStyle={styles.cell}
                  focusRadius={radius.md}
                  style={[styles.tile, { backgroundColor: b.color, borderColor: selected ? colors.text : colors.glassBorder }, selected && styles.selected]}
                >
                  <AppText variant="caption" numberOfLines={1} style={[styles.name, { color: b.onColor }]}>
                    {name}
                  </AppText>
                  {selected && <Icon icon={Check} color={b.onColor} size={layout.iconSize.sm} />}
                </PressableScale>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  groups: { gap: space.lg },
  group: { gap: space.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  cell: { flexBasis: '31%', flexGrow: 1, maxWidth: '33%' },
  tile: { minHeight: 48, borderRadius: radius.md, borderWidth: layout.hairline, paddingHorizontal: space.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.xs },
  selected: { borderWidth: 2 },
  name: { fontWeight: '700', flexShrink: 1 },
});

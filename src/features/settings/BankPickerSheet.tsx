import { Check } from 'lucide-react-native';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { AppText, BankCard, BottomSheet, Icon, PressableScale } from '@/components/ui';
import { BANK_COUNTRIES, BANKS } from '@/constants/banks';
import type { Account } from '@/data/types';
import { bankName, useT } from '@/i18n';
import { useTheme } from '@/theme/ThemeProvider';
import { layout, radius, space } from '@/theme/tokens';

type Props = {
  account: Account | null;
  balance: number;
  onSelect: (bank: string) => void;
  onClose: () => void;
};

/**
 * Pilih desain kartu per bank (FR-ACC-2): warna khas + nama bank, tanpa logo resmi.
 * Pratinjau di atas memakai kartu yang sama dengan Beranda supaya pilihan terlihat apa adanya.
 */
export function BankPickerSheet({ account, balance, onSelect, onClose }: Props) {
  const t = useT();
  const { colors } = useTheme();
  const { height } = useWindowDimensions();
  return (
    <BottomSheet visible={account !== null} onClose={onClose} title={t('settings.accounts.pickTitle')} subtitle={t('settings.accounts.pickSub')}>
      {account && (
        <>
          <View style={styles.preview}>
            <BankCard bank={account.bank} accountType={t(`domain.accountType.${account.type}`)} last4={account.last4} balance={balance} currency={account.currency} />
          </View>
          <ScrollView style={{ maxHeight: height * 0.4 }} contentContainerStyle={styles.groups}>
            {BANK_COUNTRIES.map((country) => (
              <View key={country} style={styles.group}>
                <AppText variant="caption" tone="secondary" accessibilityRole="header">
                  {t(`settings.accounts.country.${country}`)}
                </AppText>
                <View accessibilityRole="radiogroup" style={styles.grid}>
                  {BANKS.filter((b) => b.country === country).map((b) => {
                    const selected = b.key === account.bank;
                    const name = bankName(t, b.key);
                    return (
                      <PressableScale
                        key={b.key}
                        accessibilityRole="radio"
                        aria-checked={selected}
                        accessibilityLabel={name}
                        onPress={() => onSelect(b.key)}
                        containerStyle={styles.cell}
                        focusRadius={radius.md}
                        style={[styles.tile, { backgroundColor: b.color, borderColor: selected ? colors.text : colors.glassBorder }, selected && styles.tileSelected]}
                      >
                        <AppText variant="caption" numberOfLines={1} style={[styles.tileName, { color: b.onColor }]}>
                          {name}
                        </AppText>
                        {selected && <Icon icon={Check} color={b.onColor} size={layout.iconSize.sm} />}
                      </PressableScale>
                    );
                  })}
                </View>
              </View>
            ))}
          </ScrollView>
        </>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  preview: { alignItems: 'center', marginBottom: space.lg },
  groups: { gap: space.lg, paddingBottom: space.sm },
  group: { gap: space.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  cell: { flexBasis: '31%', flexGrow: 1, maxWidth: '33%' },
  tile: {
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: layout.hairline,
    paddingHorizontal: space.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.xs,
  },
  tileSelected: { borderWidth: 2 },
  tileName: { fontWeight: '700', flexShrink: 1 },
});

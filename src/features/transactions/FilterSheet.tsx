import { StyleSheet, View } from 'react-native';

import { categoryLabel, useT } from '@/i18n';
import { AppText, BottomSheet, Button, Chip } from '@/components/ui';
import { CATEGORIES } from '@/constants/categories';
import type { TxFilter } from '@/lib/transactions';
import type { AccountWithBalance } from '@/state/AppStore';
import { space } from '@/theme/tokens';

export type FilterSheetProps = {
  visible: boolean;
  onClose: () => void;
  filter: TxFilter;
  onChange: (next: TxFilter) => void;
  accounts: AccountWithBalance[];
};

export function FilterSheet({ visible, onClose, filter, onChange, accounts }: FilterSheetProps) {
  const t = useT();
  return (
    <BottomSheet visible={visible} onClose={onClose} title={t('tx.sheet.title')}>
      <AppText variant="overline" tone="secondary">
        {t('tx.sheet.account')}
      </AppText>
      <View style={styles.wrap}>
        <Chip label={t('tx.sheet.allAccounts')} selected={!filter.accountId} onPress={() => onChange({ ...filter, accountId: null })} />
        {accounts.map((a) => (
          <Chip key={a.id} label={a.name} selected={filter.accountId === a.id} onPress={() => onChange({ ...filter, accountId: filter.accountId === a.id ? null : a.id })} />
        ))}
      </View>
      <AppText variant="overline" tone="secondary" style={styles.gap}>
        {t('tx.sheet.category')}
      </AppText>
      <View style={styles.wrap}>
        <Chip label={t('tx.sheet.allCategories')} selected={!filter.categoryKey} onPress={() => onChange({ ...filter, categoryKey: null })} />
        {CATEGORIES.map((c) => (
          <Chip key={c.key} label={categoryLabel(t, c.key)} selected={filter.categoryKey === c.key} onPress={() => onChange({ ...filter, categoryKey: filter.categoryKey === c.key ? null : c.key })} />
        ))}
      </View>
      <View style={styles.actions}>
        <Button label={t('tx.sheet.reset')} variant="secondary" size="md" onPress={() => onChange({ ...filter, accountId: null, categoryKey: null })} />
        <View style={styles.flex}>
          <Button label={t('tx.sheet.done')} size="md" fullWidth onPress={onClose} />
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm },
  gap: { marginTop: space.xl },
  actions: { flexDirection: 'row', gap: space.md, marginTop: space.xl },
  flex: { flex: 1 },
});

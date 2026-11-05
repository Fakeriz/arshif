import { ScrollView, StyleSheet, View } from 'react-native';

import { categoryLabel, useT } from '@/i18n';
import { AppText, Chip } from '@/components/ui';
import { CATEGORIES } from '@/constants/categories';
import type { TxType } from '@/data/types';
import type { AccountWithBalance } from '@/state/AppStore';
import { space } from '@/theme/tokens';

type PickerShell = { label: string; error?: string; warning?: string; scroll?: boolean; children: React.ReactNode };

function Shell({ label, error, warning, scroll, children }: PickerShell) {
  return (
    <View style={styles.shell} accessibilityRole="radiogroup" accessibilityLabel={label}>
      <AppText variant="caption" tone="secondary">
        {label}
      </AppText>
      {scroll ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {children}
        </ScrollView>
      ) : (
        <View style={styles.wrap}>{children}</View>
      )}
      {error && (
        <AppText variant="caption" tone="negative" aria-live="polite">
          {error}
        </AppText>
      )}
      {!error && warning && (
        <AppText variant="caption" tone="warning">
          {warning}
        </AppText>
      )}
    </View>
  );
}

export function AccountPicker({ label, accounts, value, onChange, error }: { label: string; accounts: AccountWithBalance[]; value: string | null; onChange: (id: string) => void; error?: string }) {
  return (
    <Shell label={label} error={error}>
      {accounts.map((a) => (
        <Chip key={a.id} label={`${a.name} · ${a.currency}`} selected={value === a.id} onPress={() => onChange(a.id)} />
      ))}
    </Shell>
  );
}

const INCOME_KEYS = ['salary', 'investment_income', 'other'];

/** Pemasukan dan pengeluaran memakai daftar kategori yang berbeda. */
export function categoriesFor(type: TxType) {
  return CATEGORIES.filter((c) => (type === 'income' ? INCOME_KEYS.includes(c.key) : !['salary', 'investment_income'].includes(c.key)));
}

export function CategoryPicker({ type, value, onChange, error, warning, scroll }: { type: TxType; value: string | null; onChange: (key: string) => void; error?: string; warning?: string; scroll?: boolean }) {
  const t = useT();
  return (
    <Shell label={t('tx.form.category')} error={error} warning={warning} scroll={scroll}>
      {categoriesFor(type).map((c) => (
        <Chip key={c.key} label={categoryLabel(t, c.key)} selected={value === c.key} onPress={() => onChange(c.key)} />
      ))}
    </Shell>
  );
}

const styles = StyleSheet.create({
  shell: { gap: space.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  row: { flexDirection: 'row', gap: space.sm },
});

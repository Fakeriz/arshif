import { ScrollView, StyleSheet, View } from 'react-native';

import { categoryLabel, useT } from '@/i18n';
import { AppText, Chip, IconGrid } from '@/components/ui';
import { categoriesFor } from '@/constants/categories';
import type { TxType } from '@/data/types';
import type { AccountWithBalance } from '@/state/AppStore';
import { useTheme } from '@/theme/ThemeProvider';
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

/** Kategori sebagai grid ikon berwarna yang digeser per halaman; nama yang terpilih tampil di samping label. */
export function CategoryPicker({ type, value, onChange, error, warning }: { type: TxType; value: string | null; onChange: (key: string) => void; error?: string; warning?: string }) {
  const t = useT();
  const { hues } = useTheme();
  const label = t('tx.form.category');
  const items = categoriesFor(type === 'income' ? 'income' : 'expense', value).map((c) => ({ key: c.key, icon: c.icon, label: categoryLabel(t, c.key), tint: hues[c.hue] }));
  return (
    <View style={styles.shell}>
      <View style={styles.head}>
        <AppText variant="caption" tone="secondary">
          {label}
        </AppText>
        {value ? (
          <AppText variant="caption" numberOfLines={1} style={styles.flex}>
            {categoryLabel(t, value)}
          </AppText>
        ) : null}
      </View>
      <IconGrid items={items} value={value} onChange={onChange} accessibilityLabel={label} />
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

const styles = StyleSheet.create({
  shell: { gap: space.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  row: { flexDirection: 'row', gap: space.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1, textAlign: 'right' },
});

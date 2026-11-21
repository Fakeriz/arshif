import { Plus } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { HeaderButton } from '@/components/shell/HeaderActions';
import { AppText, CategoryIcon, Group, ListCard, ListItem, Tabs, Toggle, useToast } from '@/components/ui';
import { builtinFor, MAX_CUSTOM_CATEGORIES, type CustomCategory, type TxKind } from '@/constants/categories';
import { CategorySheet } from '@/features/settings/CategorySheet';
import { SettingsScreen } from '@/features/settings/kit';
import { categoryLabel, useT } from '@/i18n';
import { useStore } from '@/state/AppStore';
import { space } from '@/theme/tokens';

/**
 * Menu Kategori: kategori buatan sendiri (tambah, ubah, hapus) dan kategori bawaan (tampil/sembunyi di picker).
 * Hapus = tandai deleted: hilang dari menu dan picker, transaksi lama tetap punya nama dan ikonnya.
 */
export default function KategoriScreen() {
  const t = useT();
  const { show } = useToast();
  const { state, dispatch } = useStore();
  const [type, setType] = useState<TxKind>('expense');
  // undefined = sheet tertutup, null = kategori baru.
  const [editing, setEditing] = useState<CustomCategory | null | undefined>(undefined);
  const { custom, hidden } = state.categories;
  const live = custom.filter((c) => !c.deleted);
  const mine = live.filter((c) => c.type === type);
  const save = (value: typeof state.categories) => dispatch({ type: 'prefs/categories', value });

  const add = () => (live.length >= MAX_CUSTOM_CATEGORIES ? show({ tone: 'error', title: t('settings.categories.limit', { max: MAX_CUSTOM_CATEGORIES }) }) : setEditing(null));
  // Nama ganda dicek terhadap kategori sendiri dan label bawaan dengan jenis yang sama.
  const taken = [...live.filter((c) => c.type === type && c.key !== editing?.key).map((c) => c.name), ...builtinFor(type).map((c) => categoryLabel(t, c.key))].map((n) => n.toLowerCase());

  return (
    <SettingsScreen title={t('settings.categories.title')} right={<HeaderButton label={t('settings.categories.add')} icon={Plus} onPress={add} />}>
      <Tabs
        accessibilityLabel={t('settings.categories.title')}
        value={type}
        onChange={setType}
        items={[
          { key: 'expense', label: t('common.expense') },
          { key: 'income', label: t('common.income') },
        ]}
      />

      <Group label={t('settings.categories.mine')}>
        {mine.length === 0 ? (
          <AppText variant="caption" tone="muted" style={styles.note}>
            {t('settings.categories.mineEmpty')}
          </AppText>
        ) : (
          <ListCard>
            {mine.map((c, i) => (
              <ListItem
                key={c.key}
                leading={<CategoryIcon category={c.key} size={40} />}
                title={c.name}
                subtitle={c.bucket ? t(`domain.bucket.${c.bucket}`) : undefined}
                chevron
                divider={i < mine.length - 1}
                onPress={() => setEditing(c)}
              />
            ))}
          </ListCard>
        )}
      </Group>

      <Group label={t('settings.categories.builtin')}>
        <AppText variant="caption" tone="muted" style={styles.note}>
          {t('settings.categories.builtinHint')}
        </AppText>
        <ListCard>
          {builtinFor(type).map((c, i, list) => {
            const name = categoryLabel(t, c.key);
            // "Lainnya" = cadangan untuk kategori yang tidak dikenali, jadi selalu tampil.
            const locked = c.key === 'other';
            return (
              <ListItem
                key={c.key}
                leading={<CategoryIcon category={c.key} size={40} />}
                title={name}
                subtitle={locked ? t('settings.categories.otherLocked') : undefined}
                divider={i < list.length - 1}
                trailing={
                  <Toggle
                    value={!hidden.includes(c.key)}
                    disabled={locked}
                    accessibilityLabel={t('settings.categories.show', { name })}
                    onChange={(on) => save({ custom, hidden: on ? hidden.filter((k) => k !== c.key) : [...hidden, c.key] })}
                  />
                }
              />
            );
          })}
        </ListCard>
      </Group>

      {editing !== undefined && (
        <CategorySheet
          key={editing?.key ?? `new-${type}`}
          visible
          editing={editing}
          type={type}
          taken={taken}
          onClose={() => setEditing(undefined)}
          onSave={(c) => {
            save({ custom: custom.some((x) => x.key === c.key) ? custom.map((x) => (x.key === c.key ? c : x)) : [...custom, c], hidden });
            setEditing(undefined);
            show({ tone: 'success', title: t('settings.categories.saved') });
          }}
          onDelete={(c) => {
            save({ custom: custom.map((x) => (x.key === c.key ? { ...x, deleted: true } : x)), hidden });
            setEditing(undefined);
            show({ tone: 'success', title: t('settings.categories.deleted') });
          }}
        />
      )}
    </SettingsScreen>
  );
}

const styles = StyleSheet.create({
  note: { paddingHorizontal: space.xs },
});
